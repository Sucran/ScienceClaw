/**
 * 参考注释：
 * - "SSE 监控中间件 — 基于 sample/monitoring_v2.py 的模式。"
 * - "通过 wrap_tool_call 拦截工具执行的前后，在工具执行层捕获："
 * - "  - 工具调用前：工具名称、输入参数、开始时间"
 * - "  - 工具执行后：返回结果、执行耗时"
 * - "  - Todolist 变化：对比前后 todolist 的增删改"
 * - "产生的事件存储在 sse_events 列表中，由 runner.py 在 stream 循环中轮询并 yield。"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/sse_middleware.py:1-394
 */
import { EventType, ToolCategory, getProtocolManager } from "./sse-protocol.js"

export interface ToolRuntime {
  name?: string
  args?: Record<string, unknown>
  id?: string
  tool_call?: { name?: string; id?: string; args?: Record<string, unknown> }
}

export type EmitFn = (event: string, data: unknown) => Promise<void> | void

interface MiddlewareEvent {
  event: string
  data: Record<string, unknown>
}

interface TodoChange {
  content: string
  status: string
}

interface TodoChanges {
  added: TodoChange[]
  removed: TodoChange[]
  status_changed: { content: string; old_status: string; new_status: string }[]
  unchanged: TodoChange[]
}

const STATUS_EMOJI: Record<string, string> = {
  pending: "⏳",
  in_progress: "🔄",
  completed: "✅"
}

/**
 * SSE 监控中间件 — 拦截工具执行前后的参数和结果。
 *
 * 核心机制：
 *   1. 工具执行前：提取 tool_name, tool_args，记录 start_time
 *   2. 调用 handler(request) 执行实际工具
 *   3. 工具执行后：计算 duration_ms，提取结果
 *   4. 生成 SSE 事件存入事件队列
 *   5. runner 在每个 stream chunk 后轮询 drainEvents()
 */
export class SSEMonitoringMiddleware {
  readonly name = "SSEMonitoringMiddleware"
  private readonly events: MiddlewareEvent[] = []
  private readonly eventsLock = { locked: false }
  private readonly executionLog: Record<string, unknown>[] = []
  private readonly toolCallsLog: Record<string, unknown>[] = []
  private readonly todosLog: Record<string, unknown>[] = []
  private previousTodos: Record<string, unknown>[] = []

  // 统计
  private totalToolCalls = 0
  private totalToolDurationMs = 0
  private inputTokens = 0
  private outputTokens = 0

  constructor(
    private readonly emit: EmitFn,
    private readonly agentName = "agent",
    private readonly parentAgent?: string,
    private readonly verbose = false
  ) {}

  private getAgentPath(): string {
    return this.parentAgent ? `${this.parentAgent} -> ${this.agentName}` : this.agentName
  }

  private extractToolInfo(request: ToolRuntime): { name: string | null; args: Record<string, unknown>; callId: string } {
    let name: string | undefined
    let args: Record<string, unknown> = {}
    let callId = ""

    if (request.tool_call) {
      name = request.tool_call.name
      args = request.tool_call.args ?? {}
      callId = request.tool_call.id ?? ""
    } else {
      name = request.name
      args = request.args ?? {}
      callId = request.id ?? ""
    }

    return { name: name ?? null, args, callId }
  }

  private extractResultSummary(result: unknown): string {
    try {
      if (result === null || result === undefined) return "(no output)"
      if (typeof result === "string") return result.slice(0, 200) + (result.length > 200 ? "..." : "")
      if (typeof result === "object") {
        const s = JSON.stringify(result)
        return s.slice(0, 200) + (s.length > 200 ? "..." : "")
      }
      return String(result).slice(0, 200)
    } catch {
      return "(error extracting result)"
    }
  }

  private appendEvent(event: string, data: Record<string, unknown>): void {
    this.events.push({ event, data })
  }

  private compareTodos(oldTodos: Record<string, unknown>[], newTodos: Record<string, unknown>[]): TodoChanges {
    const oldMap = new Map(oldTodos.map(t => [String(t.content || ""), t]))
    const newMap = new Map(newTodos.map(t => [String(t.content || ""), t]))

    const changes: TodoChanges = {
      added: [],
      removed: [],
      status_changed: [],
      unchanged: []
    }

    for (const [content, newTodo] of newMap.entries()) {
      if (!oldMap.has(content)) {
        changes.added.push({ content, status: String(newTodo.status || "unknown") })
      } else {
        const oldStatus = String(oldMap.get(content)?.status || "unknown")
        const newStatus = String(newTodo.status || "unknown")
        if (oldStatus !== newStatus) {
          changes.status_changed.push({ content, old_status: oldStatus, new_status: newStatus })
        } else {
          changes.unchanged.push({ content, status: newStatus })
        }
      }
    }

    for (const [content, oldTodo] of oldMap.entries()) {
      if (!newMap.has(content)) {
        changes.removed.push({ content, status: String(oldTodo.status || "unknown") })
      }
    }

    return changes
  }

  private handleTodosChange(toolArgs: Record<string, unknown> | null): void {
    if (!toolArgs || !("todos" in toolArgs)) return
    const newTodos = toolArgs.todos
    if (!Array.isArray(newTodos)) return

    const changes = this.compareTodos(this.previousTodos, newTodos)

    const entry = {
      agent: this.agentName,
      phase: "todos_update",
      timestamp: Date.now() / 1000,
      todos: newTodos,
      changes
    }
    this.todosLog.push(entry)

    this.appendEvent("middleware_todos_update", {
      todos: newTodos,
      changes,
      agent: this.agentName,
      timestamp: Date.now() / 1000
    })

    if (this.verbose) {
      this.printTodosChanges(changes, newTodos)
    }

    this.previousTodos = newTodos.map(t => ({ ...t }))
  }

  private printTodosChanges(changes: TodoChanges, allTodos: unknown[]): void {
    console.info(`[${this.getAgentPath()}] TODOLIST UPDATE:`)
    for (const item of changes.added) {
      const emoji = STATUS_EMOJI[item.status] || ""
      console.info(`  + ${emoji} [${item.status}] ${item.content}`)
    }
    for (const item of changes.status_changed) {
      const oldEmoji = STATUS_EMOJI[item.old_status] || ""
      const newEmoji = STATUS_EMOJI[item.new_status] || ""
      console.info(`  ${oldEmoji} [${item.old_status}] → ${newEmoji} [${item.new_status}] ${item.content}`)
    }
    console.info(`  Total: ${allTodos.length} todos`)
  }

  private beforeTool(request: ToolRuntime): {
    name: string | null
    args: Record<string, unknown>
    callId: string
    startTime: number
  } {
    const { name, args, callId } = this.extractToolInfo(request)
    const startTime = Date.now() / 1000
    const protocol = getProtocolManager()

    if (name) {
      this.totalToolCalls++
      const toolMeta = protocol.getToolMeta(name)
      this.appendEvent("middleware_tool_start", {
        tool_call_id: callId,
        function: name,
        args: args ?? {},
        tool_meta: toolMeta,
        timestamp: startTime
      })
      this.toolCallsLog.push({
        agent: this.agentName,
        tool_name: name,
        tool_args: args,
        tool_call_id: callId,
        start_time: startTime,
        phase: "start"
      })
      if (this.verbose) {
        const icon = (toolMeta as Record<string, string>)?.icon || "🔧"
        console.info(`[${this.getAgentPath()}] TOOL START: ${icon} ${name} | args=${JSON.stringify(args ?? {}).slice(0, 200)}`)
      }
    }

    return { name, args, callId, startTime }
  }

  private afterTool(
    result: unknown,
    name: string | null,
    args: Record<string, unknown>,
    callId: string,
    startTime: number
  ): unknown {
    const durationMs = Math.round((Date.now() / 1000 - startTime) * 1000)
    this.totalToolDurationMs += durationMs
    const protocol = getProtocolManager()

    if (name) {
      const resultSummary = this.extractResultSummary(result)
      const toolMeta = protocol.getToolMeta(name)
      this.appendEvent("middleware_tool_complete", {
        tool_call_id: callId,
        function: name,
        duration_ms: durationMs,
        tool_meta: toolMeta,
        result_summary: resultSummary,
        timestamp: Date.now() / 1000
      })
      this.toolCallsLog.push({
        agent: this.agentName,
        tool_name: name,
        tool_call_id: callId,
        duration_ms: durationMs,
        phase: "complete"
      })
      if (this.verbose) {
        const icon = (toolMeta as Record<string, string>)?.icon || "🔧"
        console.info(`[${this.getAgentPath()}] TOOL COMPLETE: ${icon} ${name} | duration=${durationMs}ms`)
      }
    }

    // 检测 write_todos 工具
    if (name === "write_todos" || name === "todos") {
      this.handleTodosChange(args)
    }

    return result
  }

  /**
   * 同步版本 — 拦截工具执行前后
   */
  wrapToolCall<T>(runtime: ToolRuntime, handler: () => T): T {
    const { name, args, callId, startTime } = this.beforeTool(runtime)
    const result = handler()
    return this.afterTool(result, name, args, callId, startTime) as T
  }

  /**
   * 异步版本 — 拦截工具执行前后
   */
  async wrapToolCallAsync<T>(runtime: ToolRuntime, handler: () => Promise<T>): Promise<T> {
    const { name, args, callId, startTime } = this.beforeTool(runtime)
    const result = await handler()
    return this.afterTool(result, name, args, callId, startTime) as T
  }

  /**
   * 取出所有待处理事件并清空队列
   */
  drainEvents(): Array<{ event: string; data: Record<string, unknown> }> {
    const events = [...this.events]
    this.events.length = 0
    return events
  }

  /**
   * 清空所有状态
   */
  clear(): void {
    this.events.length = 0
    this.executionLog.length = 0
    this.toolCallsLog.length = 0
    this.todosLog.length = 0
    this.previousTodos = []
    this.totalToolCalls = 0
    this.totalToolDurationMs = 0
    this.inputTokens = 0
    this.outputTokens = 0
  }

  /**
   * 累积 token 使用量
   */
  addTokens(inputTokens = 0, outputTokens = 0): void {
    if (inputTokens > 0) this.inputTokens += inputTokens
    if (outputTokens > 0) this.outputTokens += outputTokens
  }

  /**
   * 获取执行统计
   */
  getStatistics(): Record<string, unknown> {
    return {
      total_tool_calls: this.totalToolCalls,
      total_tool_duration_ms: this.totalToolDurationMs,
      todos_updates: this.todosLog.length,
      input_tokens: this.inputTokens,
      output_tokens: this.outputTokens,
      total_tokens: this.inputTokens + this.outputTokens
    }
  }

  categorize(toolName: string): ToolCategory {
    const lower = toolName.toLowerCase()
    if (["read", "write", "edit", "glob", "grep", "ls", "file"].some((k) => lower.includes(k))) return ToolCategory.FILE
    if (["execute", "run", "command", "shell", "terminal"].some((k) => lower.includes(k))) return ToolCategory.EXECUTION
    if (["search"].some((k) => lower.includes(k))) return ToolCategory.SEARCH
    if (["crawl", "fetch", "http", "web"].some((k) => lower.includes(k))) return ToolCategory.NETWORK
    if (["todo", "plan"].some((k) => lower.includes(k))) return ToolCategory.PLANNING
    return ToolCategory.OTHER
  }
}
