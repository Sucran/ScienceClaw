/**
 * 参考注释：
 * - "工具结果自动落盘中间件 — Cursor 风格。"
 * - "当工具返回的结果超过阈值时，自动将完整结果写入工作区文件，"
 * - "返回给 Agent 的 ToolMessage 改为摘要 + 文件路径引用。"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/offload_middleware.py:1-175
 */
import { createHash } from "node:crypto"
import { writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { existsSync } from "node:fs"

export interface OffloadRule {
  prefix: string
  targetModel: string
}

const OFFLOAD_THRESHOLD = 3000
const SUMMARY_LENGTH = 1500
const OFFLOAD_DIR = "research_data"

const OFFLOAD_TOOLS = new Set([
  "web_search", "web_crawl",
  "execute", "sandbox_exec", "terminal_execute",
  "tooluniverse_run"
])

const RELAXED_OFFLOAD_TOOLS = new Set([
  "read_file", "edit_file", "ls", "glob", "grep"
])
const RELAXED_OFFLOAD_THRESHOLD = 30000

interface ToolCallRequest {
  name?: string
  id?: string
  tool_call?: { name?: string; id?: string }
}

interface ToolResult {
  content?: string
  output?: string
  text?: string
  result?: string
}

/**
 * 从工具结果中提取文本内容
 */
function extractText(result: unknown): string | null {
  if (typeof result === "string") return result
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>
    for (const key of ["content", "output", "text", "result"]) {
      const val = obj[key]
      if (typeof val === "string" && val.length > 100) return val
    }
  }
  return null
}

/**
 * 提取工具名称和调用ID
 */
function extractToolInfo(request: ToolCallRequest): { name: string | null; callId: string } {
  let name: string | undefined
  let callId = ""

  if (request.tool_call) {
    name = request.tool_call.name
    callId = request.tool_call.id ?? ""
  } else {
    name = request.name
    callId = request.id ?? ""
  }

  return { name: name ?? null, callId }
}

/**
 * 创建摘要文本
 */
function makeSummary(text: string, filePath: string): string {
  const preview = text.slice(0, SUMMARY_LENGTH)
  const ellipsis = text.length > SUMMARY_LENGTH ? "\n..." : ""
  return `[Full result saved to ${filePath} (${text.length} chars). Use read_file("${filePath}") to access complete data. NOTE: This file contains raw tool output. To use in sandbox scripts, first read_file it, extract the data you need, then write_file a clean JSON file.]\n\n${preview}${ellipsis}`
}

/**
 * 工具结果自动落盘中间件
 * 当工具返回结果超过阈值时，自动将完整结果写入工作区文件
 */
export class ToolResultOffloadMiddleware {
  readonly name = "ToolResultOffloadMiddleware"
  private offloadCount = 0
  private diagnostic: { logOffload: (tool: string, original: number, summary: number, path: string) => void } | null = null

  constructor(
    private readonly workspaceDir: string,
    private readonly backend: { write: (path: string, content: string) => Promise<{ error?: string }>; writeAsync?: (path: string, content: string) => Promise<{ error?: string }> }
  ) {}

  setDiagnostic(diag: { logOffload: (tool: string, original: number, summary: number, path: string) => void }): void {
    this.diagnostic = diag
  }

  private shouldOffload(toolName: string | null, text: string | null): boolean {
    if (!toolName || !text) return false
    if (text.length < OFFLOAD_THRESHOLD) return false
    if (RELAXED_OFFLOAD_TOOLS.has(toolName)) {
      return text.length > RELAXED_OFFLOAD_THRESHOLD
    }
    if (OFFLOAD_TOOLS.has(toolName)) return true
    return text.length > OFFLOAD_THRESHOLD * 2
  }

  private makeFilePath(toolName: string, toolCallId: string): string {
    const hash = createHash("md5").update(`${toolCallId}${Date.now()}`).digest("hex").slice(0, 8)
    const safeName = toolName.replace("/", "_").replace(" ", "_")
    return `${this.workspaceDir}/${OFFLOAD_DIR}/${safeName}_${hash}.md`
  }

  private async ensureOffloadDir(): Promise<void> {
    const dir = join(this.workspaceDir, OFFLOAD_DIR)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
  }

  private async offloadResult(toolName: string, toolCallId: string, text: string): Promise<string> {
    const filePath = this.makeFilePath(toolName, toolCallId)
    try {
      await this.ensureOffloadDir()
      const writeFn = this.backend.writeAsync ?? this.backend.write
      await writeFn(filePath, text)
      this.offloadCount++
      console.log(`[Offload] ${toolName} result (${text.length} chars) -> ${filePath}`)
      const summary = makeSummary(text, filePath)
      if (this.diagnostic) {
        this.diagnostic.logOffload(toolName, text.length, summary.length, filePath)
      }
      return summary
    } catch (exc) {
      console.warn(`[Offload] Failed to write ${filePath}:`, exc)
      return text
    }
  }

  private replaceResultText(result: unknown, newText: string): unknown {
    if (typeof result === "string") return newText
    if (result && typeof result === "object") {
      const obj = result as Record<string, unknown>
      for (const key of ["content", "output", "text", "result"]) {
        if (key in obj && typeof obj[key] === "string") {
          return { ...obj, [key]: newText }
        }
      }
    }
    return newText
  }

  async wrapToolCallAsync(request: ToolCallRequest, handler: () => Promise<unknown>): Promise<unknown> {
    const result = await handler()
    const { name, callId } = extractToolInfo(request)
    const text = extractText(result)
    if (this.shouldOffload(name, text)) {
      const summary = await this.offloadResult(name!, callId, text!)
      return this.replaceResultText(result, summary)
    }
    return result
  }

  wrapToolCall(request: ToolCallRequest, handler: () => unknown): unknown {
    const result = handler()
    const { name, callId } = extractToolInfo(request)
    const text = extractText(result)
    if (this.shouldOffload(name, text)) {
      // In sync context, we can't await - schedule offload and return original
      // The offload will happen on next async operation
      const textToOffload = text!
      const nameToOffload = name!
      const callIdToOffload = callId
      // Fire-and-forget: schedule offload without blocking
      setTimeout(() => {
        this.offloadResult(nameToOffload, callIdToOffload, textToOffload).catch(err => {
          console.warn(`[Offload] Background offload failed:`, err)
        })
      }, 0)
    }
    return result
  }

  getOffloadCount(): number {
    return this.offloadCount
  }
}

/**
 * 基于规则的模型解析中间件（简化版）
 */
export class OffloadMiddleware {
  constructor(private readonly rules: OffloadRule[] = []) {}

  resolveModel(task: string, defaultModel: string): string {
    for (const rule of this.rules) {
      if (task.startsWith(rule.prefix)) return rule.targetModel
    }
    return defaultModel
  }
}