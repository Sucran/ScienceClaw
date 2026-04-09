/**
 * 参考注释：
 * - "runner.py — SSE 流式执行器。"
 * - "中间件事件与 stream 事件合并，一起 yield 给前端"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/runner.py:1-892
 */
import { deepAgent, type TaskSettingsLike } from "./agent.js"
import type { ModelConfig } from "./engine.js"
import { EventType, getProtocolManager } from "./sse-protocol.js"
import { SSEMonitoringMiddleware } from "./sse-middleware.js"
import {
  asyncAppendSessionEvent,
  asyncGetScienceSession,
  asyncUpdateScienceSession,
  type ScienceSession
} from "./sessions.js"
import { normalizePlanSteps, type PlanStep } from "./plan-types.js"
import { executeHooks, getGlobalRegistry } from "../plugins/index.js"
import { AIMessage, AIMessageChunk } from "@langchain/core/messages"
import shortuuid from "short-uuid"

// Hook execution helper
async function runHooks(
  event: string,
  eventData: unknown,
  context: { sessionId: string; userId?: string | null }
): Promise<void> {
  const registry = getGlobalRegistry()
  if (registry) {
    await executeHooks(registry, event, eventData, {
      sessionId: context.sessionId,
      userId: context.userId ?? undefined,
    })
  }
}

export interface StreamChunk {
  event: string
  data: unknown
}

export interface RunInput {
  sessionId: string
  userMessage: string
  modelConfig?: ModelConfig
  userId?: string | null
  taskSettings?: TaskSettingsLike
  language?: string
}

const THINK_TAG_RE = /<think>[\s\S]*?<\/think>/gi
const THINK_CONTENT_RE = /<think>([\s\S]*?)<\/think>/gi

// Token estimation: ~1.5 chars per token for mixed CJK/English
function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.floor(text.length * 2 / 3))
}

/**
 * 从消息中提取思考内容和干净的正文
 * 支持三种模型格式：
 * 1. DeepSeek (OpenAI 兼容 API): additional_kwargs["reasoning_content"]
 * 2. Claude: content blocks 中 type="thinking" 的块
 * 3. DeepSeek/Qwen (原生 API): <think>...</think> 标签
 */
function extractThinking(msg: Record<string, unknown>): { thinking: string; cleanText: string } {
  let thinking = ""

  // ① additional_kwargs.reasoning_content (DeepSeek via OpenAI API)
  const additionalKwargs = (msg.additional_kwargs || {}) as Record<string, unknown>
  const reasoning = additionalKwargs.reasoning_content
  if (typeof reasoning === "string" && reasoning.trim()) {
    thinking = reasoning.trim()
  }

  const content = msg.content
  if (!content) {
    return { thinking, cleanText: "" }
  }

  // ② content 是 list (Claude 风格 content blocks)
  if (Array.isArray(content)) {
    const thinkingParts: string[] = []
    const textParts: string[] = []
    for (const block of content) {
      if (typeof block === "object" && block !== null) {
        const b = block as Record<string, unknown>
        const btype = String(b.type || "")
        if (btype === "thinking") {
          thinkingParts.push(String(b.thinking || ""))
        } else if (btype === "text") {
          textParts.push(String(b.text || ""))
        }
      } else if (typeof block === "string") {
        textParts.push(block)
      }
    }
    if (thinkingParts.length > 0 && !thinking) {
      thinking = thinkingParts.filter(Boolean).join("\n")
    }
    return { thinking, cleanText: textParts.join("").trim() }
  }

  // ③ content 是 str (可能含 <think> 标签)
  if (typeof content === "string") {
    if (!thinking) {
      const matches = THINK_CONTENT_RE.exec(content)
      if (matches) {
        thinking = matches[1].trim()
      }
    }
    const clean = content.replace(THINK_TAG_RE, "").trim()
    return { thinking, cleanText: clean }
  }

  return { thinking, cleanText: String(content) }
}

/**
 * 计算历史消息的 token 预算
 * Formula: history_budget = context_window × (1 - safety_margin) - reserved
 */
function computeHistoryTokenBudget(
  contextWindow: number,
  outputReserve = 16384,
  systemPromptTokens = 4000,
  toolsTokens = 6000,
  currentQueryTokens = 1000,
  safetyMargin = 0.15
): number {
  const usable = Math.floor(contextWindow * (1 - safetyMargin))
  const reserved = outputReserve + systemPromptTokens + toolsTokens + currentQueryTokens
  return Math.max(usable - reserved, 8000)
}

/**
 * 估算单条消息的 token 数
 */
function estimateMessageTokens(msg: Record<string, unknown>): number {
  let tokens = 4 // message overhead
  const content = msg.content
  if (typeof content === "string") {
    tokens += estimateTokens(content)
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === "object" && block !== null) {
        const b = block as Record<string, unknown>
        tokens += estimateTokens(String(b.text || b.content || ""))
      } else if (typeof block === "string") {
        tokens += estimateTokens(block)
      }
    }
  }
  return tokens
}

/**
 * 截断工具调用参数
 */
function truncateToolArgs(args: Record<string, unknown>, maxChars = 500): Record<string, unknown> {
  const truncated: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string" && v.length > maxChars) {
      truncated[k] = v.slice(0, maxChars) + `... (${v.length} chars total, truncated)`
    } else {
      truncated[k] = v
    }
  }
  return truncated
}

const ASSISTANT_CONTENT_MAX_LEN = 3000
const TOOL_RESULT_MAX_LEN = 2000
const TOOL_ARGS_MAX_LEN = 500

/**
 * 从 session.events 构建历史消息
 */
function buildHistoryMessages(
  session: ScienceSession,
  currentQuery: string = "",
  maxRounds = 6,
  maxHistoryTokens = 60000
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = []
  const pendingToolCalls: Array<Record<string, unknown>> = []

  function flushPendingCalls() {
    if (pendingToolCalls.length === 0) return
    const toolCalls = pendingToolCalls.map((tc) => ({
      id: String(tc.tool_call_id || ""),
      name: String(tc.function || "unknown"),
      args: truncateToolArgs((tc.args as Record<string, unknown>) || {}, TOOL_ARGS_MAX_LEN),
      type: "tool_call" as const
    }))
    messages.push({ role: "assistant", content: "" })
    pendingToolCalls.length = 0
  }

  for (const evt of session.events) {
    const eventType = String((evt as Record<string, unknown>).event || "")
    const data = ((evt as Record<string, unknown>).data || {}) as Record<string, unknown>

    if (eventType === "message") {
      flushPendingCalls()
      const role = String(data.role || "")
      let content = data.content
      if (!content) continue
      if (typeof content !== "string") {
        content = JSON.stringify(content)
      }
      if (role === "user") {
        messages.push({ role: "user", content: String(content) })
      } else if (role === "assistant") {
        let text = String(content)
        if (text.length > ASSISTANT_CONTENT_MAX_LEN) {
          text = text.slice(0, ASSISTANT_CONTENT_MAX_LEN) + `\n... (response truncated, ${text.length} chars total)`
        }
        messages.push({ role: "assistant", content: text })
      }
    } else if (eventType === "tool") {
      const status = String(data.status || "")

      if (status === "calling") {
        pendingToolCalls.push(data)
      } else if (status === "called") {
        flushPendingCalls()
        let content: unknown = data.content
        if (typeof content === "object") {
          content = JSON.stringify(content)
        } else if (typeof content !== "string") {
          content = String(content)
        }
        if (typeof content === "string" && content.length > TOOL_RESULT_MAX_LEN) {
          content = content.slice(0, TOOL_RESULT_MAX_LEN) + "\n... (truncated)"
        }
      }
    }
  }

  flushPendingCalls()

  // Remove duplicate query
  if (currentQuery && messages.length > 0) {
    const last = messages[messages.length - 1]
    if (last.role === "user" && last.content.trim() === currentQuery.trim()) {
      messages.pop()
    }
  }

  // Pass 1: 按轮次截取
  const userIndices = messages.map((m, i) => (m.role === "user" ? i : -1)).filter((i) => i >= 0)
  if (userIndices.length > maxRounds) {
    const startIdx = userIndices[-maxRounds]
    messages.splice(0, startIdx)
  }

  // Pass 2: 按 token 估算截取
  let totalTokens = messages.reduce((sum, m) => sum + estimateMessageTokens({ content: m.content }), 0)
  if (totalTokens > maxHistoryTokens) {
    console.warn(`[History] Estimated ${totalTokens} tokens exceeds budget ${maxHistoryTokens}, trimming oldest rounds`)
    const userIdxs = messages.map((m, i) => (m.role === "user" ? i : -1)).filter((i) => i >= 0)
    while (totalTokens > maxHistoryTokens && userIdxs.length > 1) {
      const cutEnd = userIdxs[1]
      messages.splice(0, cutEnd)
      totalTokens = messages.reduce((sum, m) => sum + estimateMessageTokens({ content: m.content }), 0)
      userIdxs.splice(0, userIdxs.length)
    }
  }

  // Pass 3: 确保不以 ToolMessage 开头
  while (messages.length > 0 && messages[0].role === "assistant" && !messages[0].content) {
    messages.shift()
  }

  return messages
}

function buildPlan(description: string): PlanStep[] {
  return normalizePlanSteps([{
    id: "S1",
    content: description,
    status: "pending",
    tools: ["web_search", "web_crawl", "terminal_execute", "file_write", "file_read"]
  }])
}

/**
 * 从流式 AIMessageChunk 中提取可展示正文（与 Python runner._extract_chunk_text 对齐）
 */
function extractChunkTextFromAiChunk(msgChunk: AIMessageChunk): string {
  const content = msgChunk.content
  if (!content) return ""
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const block of content) {
      if (typeof block === "object" && block !== null) {
        const b = block as Record<string, unknown>
        if (b.type === "text") parts.push(String(b.text ?? ""))
        else if (typeof b.text === "string") parts.push(b.text)
      } else if (typeof block === "string") {
        parts.push(block)
      }
    }
    return parts.join("")
  }
  if (typeof content === "string") {
    return content.replace(THINK_TAG_RE, "").trim()
  }
  return String(content)
}

function todosToPlanSteps(todos: Array<Record<string, unknown>>): PlanStep[] {
  return todos.map((todo, i) => {
    const content = String(todo.content || "")
    const status = String(todo.status || "pending")
    let stepStatus: PlanStep["status"] = "pending"
    if (status === "completed" || status === "done") {
      stepStatus = "completed"
    } else if (status === "in_progress" || status === "running") {
      stepStatus = "in_progress"
    }
    return {
      id: String(todo.id || `T${i + 1}`),
      content,
      description: content,
      status: stepStatus,
      tools: [],
      files: [],
      priority: "medium",
      inputs: {},
      outputs: {},
      created_at: Date.now()
    }
  })
}

/**
 * 参考注释：
 * - "使用 deep_agent 执行对话，以 SSE 事件格式 yield。"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/runner.py:384-499
 */
export async function* runScienceTaskStream(input: RunInput): AsyncGenerator<StreamChunk, void, unknown> {
  const protocol = getProtocolManager()
  const session = await asyncGetScienceSession(input.sessionId)

  // 与 Python runner 一致：不在此处用持久化 status 拒绝整轮对话；REST 已在 POST /chat 将 Mongo 标为 running 并 invalidate 缓存。

  yield { event: EventType.AGENT_STEP, data: protocol.createEvent(EventType.AGENT_STEP, { content: "start" }) }

  // Run before_agent_start hook
  await runHooks("before_agent_start", { sessionId: input.sessionId }, { sessionId: input.sessionId, userId: input.userId })

  console.log("[Runner] Creating deepAgent...")
  // 创建 agent（内部已包含 middleware）
  const { agent: runtime, sseMiddleware: middleware, contextWindow } = await deepAgent(
    input.sessionId,
    input.modelConfig,
    input.userId,
    input.taskSettings,
    false,
    input.language
  )
  console.log("[Runner] deepAgent created successfully")

  // 确保 middleware 状态干净
  middleware.clear()

  // 计算历史 token 预算
  const historyTokenBudget = computeHistoryTokenBudget(contextWindow)

  // 构建历史消息
  const historyMessages = buildHistoryMessages(
    session,
    input.userMessage,
    input.taskSettings?.max_tokens ? Math.floor(input.taskSettings.max_tokens / 1000) : 6,
    historyTokenBudget
  )

  // 初始化 plan
  const initialPlan = buildPlan(input.userMessage.slice(0, 200))
  let currentPlan = initialPlan
  yield { event: EventType.PLAN_UPDATE, data: { plan: currentPlan.map(s => ({ ...s, description: s.content })) } }

  // Todo list 追踪
  let currentTodos: Array<Record<string, unknown>> = []
  // Match Python runner: history + user only. createDeepAgent injects systemPrompt;
  // an extra system line breaks MiniMax (400 invalid chat setting / 2013).
  console.log("[Runner] Starting stream (messages + updates)...")
  const stream = await runtime.stream(
    {
      messages: [
        ...historyMessages.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: input.userMessage }
      ]
    },
    {
      streamMode: ["messages", "updates"],
      configurable: { thread_id: session.thread_id }
    }
  )

  let finalContent = ""
  let lastThinking = ""
  let streamOk = true
  let chunksHadReasoning = false
  let chunksHadText = false
  let streamedAssistantDeltas = false

  try {
    for await (const chunk of stream) {
      // 每次迭代都轮询中间件事件（确保 todos/tool 事件不延迟）
      for (const mwEvt of middleware.drainEvents()) {
        const mwType = String(mwEvt.event || "")
        const mwData = mwEvt.data || {}
        const callId = String(mwData.tool_call_id || "")

        if (mwType === "middleware_tool_start") {
          // Run before_tool_call hook
          await runHooks("before_tool_call", { function: mwData.function, args: mwData.args }, { sessionId: input.sessionId, userId: input.userId })

          yield {
            event: EventType.AGENT_TOOL_START,
            data: protocol.createEvent(EventType.AGENT_TOOL_START, {
              tool_call_id: callId,
              function: mwData.function,
              args: mwData.args,
              tool_meta: mwData.tool_meta
            })
          }
        } else if (mwType === "middleware_tool_complete") {
          // Run after_tool_call hook
          await runHooks("after_tool_call", { function: mwData.function, args: mwData.args, result: mwData.result }, { sessionId: input.sessionId, userId: input.userId })

          yield {
            event: EventType.AGENT_TOOL_END,
            data: protocol.createEvent(EventType.AGENT_TOOL_END, {
              tool_call_id: callId,
              function: mwData.function,
              success: true,
              duration_ms: mwData.duration_ms,
              tool_meta: mwData.tool_meta
            })
          }
        } else if (mwType === "middleware_todos_update") {
          const newTodos = mwData.todos as Array<Record<string, unknown>>
          if (newTodos && newTodos.length > 0) {
            currentTodos = newTodos
            const planSteps = todosToPlanSteps(newTodos)
            yield { event: EventType.PLAN_UPDATE, data: { plan: planSteps } }
          }
        }
      }

      // LangGraph：streamMode 为数组时，每项为 [mode, payload]（见 @langchain/langgraph Pregel._streamIterator）
      let mode: string | null = null
      let payload: unknown = chunk
      if (
        Array.isArray(chunk)
        && chunk.length === 2
        && typeof chunk[0] === "string"
      ) {
        mode = chunk[0] as string
        payload = chunk[1]
      }

      if (mode === "messages") {
        const pair = payload as [unknown, Record<string, unknown>?]
        const msgChunk = pair[0]
        const metadata = pair[1] ?? {}
        const nodeName = String(metadata.langgraph_node ?? "")
        if (nodeName.includes("Middleware")) continue

        if (AIMessageChunk.isInstance(msgChunk)) {
          const ak = (msgChunk.additional_kwargs ?? {}) as Record<string, unknown>
          const reasoning = ak.reasoning_content
          if (typeof reasoning === "string" && reasoning.trim()) {
            chunksHadReasoning = true
            lastThinking = reasoning.trim()
            yield {
              event: EventType.AGENT_THINKING,
              data: protocol.createEvent(EventType.AGENT_THINKING, { content: lastThinking })
            }
          }
          if (msgChunk.tool_call_chunks && msgChunk.tool_call_chunks.length > 0) continue

          const tokenText = extractChunkTextFromAiChunk(msgChunk)
          if (tokenText) {
            let out = tokenText
            if (out.length > 2 && !out.trim() && out.includes("\n")) out = "\n"
            chunksHadText = true
            streamedAssistantDeltas = true
            finalContent += out
            yield {
              event: EventType.AGENT_RESPONSE_CHUNK,
              data: protocol.createEvent(EventType.AGENT_RESPONSE_CHUNK, { content: out })
            }
          }
        }
        continue
      }

      if (mode === "updates" || mode === null) {
        const updateChunk = (mode === "updates" ? payload : chunk) as Record<string, unknown>
        if (!updateChunk || typeof updateChunk !== "object" || Array.isArray(updateChunk)) continue

        for (const [nodeName, nodeOutput] of Object.entries(updateChunk)) {
          if (nodeName.includes("Middleware")) continue

          let messages: unknown[] = []
          if (nodeOutput && typeof nodeOutput === "object" && !Array.isArray(nodeOutput)) {
            const mo = nodeOutput as Record<string, unknown>
            if (Array.isArray(mo.messages)) messages = mo.messages
          } else if (Array.isArray(nodeOutput)) {
            messages = nodeOutput
          }

          for (const msg of messages) {
            if (!AIMessage.isInstance(msg)) continue

            const rec: Record<string, unknown> = {
              content: msg.content,
              additional_kwargs: msg.additional_kwargs ?? {}
            }
            const { thinking, cleanText } = extractThinking(rec)

            if (thinking) lastThinking = thinking
            if (thinking && !chunksHadReasoning) {
              yield {
                event: EventType.AGENT_THINKING,
                data: protocol.createEvent(EventType.AGENT_THINKING, { content: thinking })
              }
            }
            if (msg.tool_calls?.length && cleanText && !chunksHadText) {
              yield {
                event: EventType.AGENT_THINKING,
                data: protocol.createEvent(EventType.AGENT_THINKING, { content: cleanText })
              }
            }

            chunksHadReasoning = false
            chunksHadText = false

            if (msg.tool_calls?.length) {
              for (const tc of msg.tool_calls) {
                const t = tc as { id?: string; name?: string; args?: Record<string, unknown> }
                const fnName = String(t.name ?? "unknown")
                const fnArgs = t.args ?? {}
                const toolMeta = protocol.getToolMeta(fnName)
                yield {
                  event: EventType.AGENT_ACTION,
                  data: protocol.createEvent(EventType.AGENT_ACTION, {
                    tool_call_id: t.id || crypto.randomUUID(),
                    function: fnName,
                    args: fnArgs,
                    description: `${fnName}: ${JSON.stringify(fnArgs).slice(0, 200)}`,
                    tool_meta: toolMeta
                  })
                }
              }
            } else if (cleanText) {
              finalContent = cleanText
            }
          }
        }
      }
    }
  } catch (exc) {
    streamOk = false
    const errMsg = String(exc)
    console.error("[Runner] Exception details:", exc)
    const errPayload = (msg: string) => ({
      event_id: shortuuid.generate(),
      timestamp: Math.floor(Date.now() / 1000),
      error: msg
    })
    if (errMsg.toLowerCase().includes("context length") || errMsg.toLowerCase().includes("context_length")) {
      yield { event: EventType.ERROR, data: errPayload("对话上下文过长，超出模型上下文窗口限制。请开启新会话继续。") }
    } else if (errMsg.toLowerCase().includes("connection") || errMsg.toLowerCase().includes("timeout")) {
      yield { event: EventType.ERROR, data: errPayload("网络连接异常，请检查网络后重试。") }
    } else {
      yield { event: EventType.ERROR, data: errPayload(`任务执行出错：${errMsg}`) }
    }
  }

  // 更新 plan 状态
  if (currentTodos.length > 0) {
    const finalPlan = todosToPlanSteps(currentTodos)
    if (streamOk) {
      for (const step of finalPlan) {
        if (step.status !== "completed") step.status = "completed"
      }
    } else {
      for (const step of finalPlan) {
        if (step.status === "in_progress") step.status = "failed"
      }
    }
    yield { event: EventType.PLAN_UPDATE, data: { plan: finalPlan } }
  } else {
    const endStatus = streamOk ? "completed" : "failed"
    currentPlan = normalizePlanSteps([{ ...currentPlan[0], status: endStatus }])
    yield { event: EventType.PLAN_UPDATE, data: { plan: currentPlan.map(s => ({ ...s, description: s.content })) } }
  }

  // 若未走 messages 流式增量，在这里补发整段正文（避免重复推送已流式输出过的全文）
  if (!streamedAssistantDeltas && finalContent) {
    yield {
      event: EventType.AGENT_RESPONSE_CHUNK,
      data: protocol.createEvent(EventType.AGENT_RESPONSE_CHUNK, { content: finalContent })
    }
  } else if (!streamedAssistantDeltas && lastThinking) {
    yield {
      event: EventType.AGENT_RESPONSE_CHUNK,
      data: protocol.createEvent(EventType.AGENT_RESPONSE_CHUNK, { content: lastThinking })
    }
  }

  // 发送统计信息
  const stats = middleware.getStatistics()
  yield {
    event: EventType.DONE,
    data: protocol.createEvent(EventType.DONE, {
      session_id: input.sessionId,
      statistics: stats
    })
  }

  // Run session_end hook
  await runHooks("session_end", { sessionId: input.sessionId, success: streamOk }, { sessionId: input.sessionId, userId: input.userId })

  await asyncUpdateScienceSession(input.sessionId, { status: "active" })
}
