/**
 * 参考注释：
 * - "FullSandboxBackend — 全沙盒后端实现。"
 * - "所有操作（文件管理、命令执行、搜索等）均通过远程 Sandbox API 完成。"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/full_sandbox_backend.py:1-577
 */
import { request } from "undici"
import type {
  EditResult,
  ExecuteResponse,
  FileData,
  FileDownloadResponse,
  FileInfo,
  FileOperationError,
  FileUploadResponse,
  GrepMatch,
  WriteResult
} from "deepagents"

export interface CommandResult {
  output: string
  exitCode: number
}

export interface SandboxConfig {
  sessionId: string
  restUrl: string
  initialCwd?: string
  timeoutMs?: number
  maxOutputChars?: number
}

const CIRCUIT_BREAKER_THRESHOLD = 3
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000
const DEFAULT_MAX_OUTPUT_CHARS = 50_000

/**
 * 参考注释：
 * - "全沙盒后端：完全依赖远程 API 进行计算和存储。"
 * - "使用共享 HTTP 客户端连接池"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/full_sandbox_backend.py:89-140
 */
export class FullSandboxBackend {
  private cwd: string
  private readonly timeoutMs: number
  private readonly sessionId: string
  private readonly maxOutputChars: number
  private shellSessionId: string | null = null
  private envContext: Record<string, unknown> | null = null
  private consecutiveErrors = 0
  private circuitOpenUntil = 0

  constructor(private readonly config: SandboxConfig) {
    this.sessionId = config.sessionId
    this.cwd = config.initialCwd ?? "/workspace"
    this.timeoutMs = config.timeoutMs ?? 120_000
    this.maxOutputChars = config.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS
  }

  get id(): string {
    return `full-sandbox-${this.sessionId}`
  }

  get workspace(): string {
    return this.cwd
  }

  private get baseUrl(): string {
    return this.config.restUrl.replace(/\/$/, "")
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown, timeoutMs?: number): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const options = {
      method,
      headers: { "content-type": "application/json" },
      bodyTimeout: timeoutMs ?? this.timeoutMs,
      headersTimeout: timeoutMs ?? this.timeoutMs
    } as Record<string, unknown>
    if (body) {
      options.body = JSON.stringify(body)
    }
    const res = await request(url, options as Parameters<typeof request>[1])
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const text = await res.body.text()
      throw new Error(`Sandbox call failed: ${res.statusCode} ${text}`)
    }
    return (await res.body.json()) as T
  }

  /**
   * 参考代码：
   * - get_context: /ScienceClaw/backend/deepagent/full_sandbox_backend.py:143-155
   */
  async getContext(): Promise<Record<string, unknown>> {
    if (this.envContext) return this.envContext
    try {
      const body = await this.call<{ data?: Record<string, unknown> }>("GET", "/v1/sandbox", undefined, 10_000)
      this.envContext = body?.data ?? body
      return this.envContext
    } catch (exc) {
      return { success: false, message: String(exc) }
    }
  }

  private checkCircuitBreaker(): ExecuteResponse | null {
    if (this.circuitOpenUntil <= 0) return null

    const remaining = this.circuitOpenUntil - Date.now()
    if (remaining <= 0) {
      this.consecutiveErrors = 0
      this.circuitOpenUntil = 0
      return null
    }

    const remainingSeconds = Math.max(1, Math.ceil(remaining / 1000))
    return {
      output: `[error] Sandbox execution is temporarily disabled for this session after ${this.consecutiveErrors} consecutive malformed responses. Retry after ${remainingSeconds}s, and stop issuing further shell commands until the sandbox health/logs have been checked.`,
      exitCode: -1,
      truncated: false
    }
  }

  private recordMalformedResponse(command: string, response: ExecuteResponse): ExecuteResponse {
    this.consecutiveErrors++

    let guidance: string
    if (this.consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS
      guidance = `Sandbox returned malformed execution data ${this.consecutiveErrors} times in a row. Circuit breaker opened for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s. Stop retrying commands and inspect sandbox health/logs.`
    } else {
      guidance = `Sandbox returned malformed execution data (${this.consecutiveErrors}/${CIRCUIT_BREAKER_THRESHOLD} consecutive failures). If this continues, stop retrying commands and inspect sandbox health/logs.`
    }

    const outputParts = [response.output.trim(), `[error] ${guidance}`].filter(Boolean)
    return {
      output: outputParts.join("\n"),
      exitCode: -1,
      truncated: response.truncated
    }
  }

  private resetErrorState(): void {
    if (this.consecutiveErrors > 0 || this.circuitOpenUntil > 0) {
      this.consecutiveErrors = 0
      this.circuitOpenUntil = 0
    }
  }

  private isSessionExpired(respJson: Record<string, unknown>): boolean {
    if (respJson["success"] === false) {
      const msg = (String(respJson["message"] || "")).toLowerCase()
      return msg.includes("session not found") || msg.includes("session expired")
    }
    return false
  }

  private async ensureShellSession(forceNew = false): Promise<string> {
    if (this.shellSessionId && !forceNew) return this.shellSessionId

    if (forceNew) {
      this.shellSessionId = null
    }

    await this.getContext()

    const body = await this.call<{ data?: { session_id?: string } }>("POST", "/v1/shell/sessions/create", {
      id: this.sessionId,
      exec_dir: this.cwd
    })
    const sid = body?.data?.session_id
    if (!sid) throw new Error("Failed to create shell session")
    this.shellSessionId = sid
    return sid
  }

  private parseExecResponse(result: Record<string, unknown>): { response: ExecuteResponse; isMalformed: boolean } {
    const rawData = result["data"]
    const data = rawData as Record<string, unknown> | undefined

    if (rawData !== null && typeof rawData !== "object") {
      const errorMsg = String(rawData).trim() || "Sandbox returned an unexpected response format."
      return {
        response: { output: `[error] ${errorMsg}`, exitCode: -1, truncated: false },
        isMalformed: true
      }
    }

    let output = String(data?.["output"] ?? "")
    const exitCode = Number(data?.["exit_code"] ?? 0)
    let truncated = false

    if (output.length > this.maxOutputChars) {
      output = output.slice(0, this.maxOutputChars) + "\n...(truncated)...\n"
      truncated = true
    }

    return {
      response: { output, exitCode, truncated },
      isMalformed: false
    }
  }

  /**
   * 参考代码：
   * - execute / aexecute: /ScienceClaw/backend/deepagent/full_sandbox_backend.py:287-348
   */
  async execute(command: string, timeoutMs?: number): Promise<ExecuteResponse> {
    const effectiveTimeout = timeoutMs ?? this.timeoutMs

    const circuitResponse = this.checkCircuitBreaker()
    if (circuitResponse) return circuitResponse

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const sid = await this.ensureShellSession(attempt > 0)
        const body = await this.call<Record<string, unknown>>(
          "POST",
          "/v1/shell/exec",
          {
            id: sid,
            command,
            async_mode: false,
            exec_dir: this.cwd
          },
          effectiveTimeout + 10_000
        )

        if (this.isSessionExpired(body)) {
          if (attempt === 0) {
            continue
          }
          return { output: "[error] Shell session expired and recreation failed", exitCode: 1, truncated: false }
        }

        const { response, isMalformed } = this.parseExecResponse(body)
        if (isMalformed) {
          return this.recordMalformedResponse(command, response)
        }

        this.resetErrorState()
        return response
      } catch (exc) {
        if (attempt === 0 && (String(exc).toLowerCase().includes("connection") || String(exc).toLowerCase().includes("connect"))) {
          this.shellSessionId = null
          continue
        }
        return { output: `[error] ${exc}`, exitCode: 1, truncated: false }
      }
    }

    return { output: "[error] Execute failed after retries", exitCode: 1, truncated: false }
  }

  /**
   * 参考代码：
   * - read / aread: /ScienceClaw/backend/deepagent/full_sandbox_backend.py:374-390
   */
  async read(filePath: string, offset = 0, limit = 2000): Promise<string> {
    try {
      const body = await this.call<{ data?: { content?: string } }>("POST", "/v1/file/read", {
        file: filePath,
        start_line: offset,
        end_line: offset + limit
      })
      return body?.data?.content ?? ""
    } catch (exc) {
      return `Error reading file '${filePath}': ${exc}`
    }
  }

  async readAsync(filePath: string, offset = 0, limit = 2000): Promise<string> {
    return this.read(filePath, offset, limit)
  }

  async readRaw(filePath: string): Promise<FileData> {
    const content = await this.read(filePath, 0, 200000)
    return {
      content: content.split("\n"),
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString()
    }
  }

  /**
   * 参考代码：
   * - write / awrite: /ScienceClaw/backend/deepagent/full_sandbox_backend.py:391-404
   */
  async write(filePath: string, content: string): Promise<WriteResult> {
    try {
      await this.call("POST", "/v1/file/write", { file: filePath, content })
      return { path: filePath, error: undefined, filesUpdate: null }
    } catch (exc) {
      return { path: filePath, error: `Error writing file '${filePath}': ${exc}`, filesUpdate: null }
    }
  }

  async writeAsync(filePath: string, content: string): Promise<WriteResult> {
    return this.write(filePath, content)
  }

  async edit(filePath: string, oldString: string, newString: string, replaceAll = false): Promise<EditResult> {
    try {
      await this.call("POST", "/v1/file/str_replace_editor", {
        command: "str_replace",
        path: filePath,
        old_str: oldString,
        new_str: newString,
        replace_all: replaceAll
      })
      return { path: filePath, error: undefined, filesUpdate: null, occurrences: 1 }
    } catch (exc) {
      return { path: filePath, error: `Error editing file '${filePath}': ${exc}`, filesUpdate: null, occurrences: 0 }
    }
  }

  async editAsync(filePath: string, oldString: string, newString: string, replaceAll = false): Promise<EditResult> {
    return this.edit(filePath, oldString, newString, replaceAll)
  }

  /**
   * 参考代码：
   * - ls_info / als_info: /ScienceClaw/backend/deepagent/full_sandbox_backend.py:351-373
   */
  async lsInfo(path = "."): Promise<FileInfo[]> {
    try {
      const body = await this.call<{ data?: { files?: Array<Record<string, unknown>>; items?: Array<Record<string, unknown>> } }>(
        "POST",
        "/v1/file/list",
        { path, recursive: false }
      )
      const list = body?.data?.files ?? body?.data?.items ?? []
      return list.map((raw) => ({
        path: String(raw.path ?? ""),
        is_dir: Boolean(raw.is_dir ?? raw.is_directory ?? false),
        size: Number(raw.size ?? 0),
        modified_at: String(raw.modified_at ?? raw.modified_time ?? "")
      }))
    } catch {
      return []
    }
  }

  async lsInfoAsync(path = "."): Promise<FileInfo[]> {
    return this.lsInfo(path)
  }

  /**
   * 参考代码：
   * - glob_info / aglob_info: /ScienceClaw/backend/deepagent/full_sandbox_backend.py:499-520
   */
  async globInfo(pattern: string, path = "."): Promise<FileInfo[]> {
    try {
      const body = await this.call<{ data?: { files?: Array<Record<string, unknown>>; items?: Array<Record<string, unknown>> } }>(
        "POST",
        "/v1/file/find",
        { path, glob: pattern }
      )
      const list = body?.data?.files ?? body?.data?.items ?? []
      return list.map((raw) => ({
        path: String(raw.path ?? ""),
        is_dir: Boolean(raw.is_dir ?? raw.is_directory ?? false),
        size: Number(raw.size ?? 0),
        modified_at: String(raw.modified_at ?? raw.modified_time ?? "")
      }))
    } catch {
      return []
    }
  }

  async globInfoAsync(pattern: string, path = "."): Promise<FileInfo[]> {
    return this.globInfo(pattern, path)
  }

  /**
   * 参考代码：
   * - grep_raw / agrep_raw: /ScienceClaw/backend/deepagent/full_sandbox_backend.py:429-498
   * - _grep_via_shell: /ScienceClaw/backend/deepagent/full_sandbox_backend.py:471-492
   */
  async grepRaw(pattern: string, path = ".", glob?: string | null): Promise<GrepMatch[] | string> {
    const target = path || this.cwd
    try {
      const body = await this.call<{ success?: boolean; data?: { file?: string; matches?: unknown[]; line_numbers?: number[] } }>(
        "POST",
        "/v1/file/search",
        { file: target, regex: pattern, glob: glob ?? undefined }
      )

      if (body?.success === false) {
        return this.grepViaShell(pattern, target, glob)
      }

      const matches = body?.data?.matches ?? []
      const file = body?.data?.file ?? target
      const lineNumbers = body?.data?.line_numbers ?? []
      return matches
        .map((m, i) => {
          if (typeof m === "string") {
            return { path: String(file), line: Number(lineNumbers[i] ?? 0), text: m }
          }
          if (m && typeof m === "object") {
            const row = m as Record<string, unknown>
            return {
              path: String(row.path ?? file),
              line: Number(row.line ?? row.line_number ?? 0),
              text: String(row.text ?? row.content ?? "")
            }
          }
          return null
        })
        .filter((v): v is GrepMatch => Boolean(v))
    } catch (exc) {
      try {
        return this.grepViaShell(pattern, target, glob)
      } catch {
        return `Error searching pattern '${pattern}': ${exc}`
      }
    }
  }

  async grepRawAsync(pattern: string, path = ".", glob?: string | null): Promise<GrepMatch[] | string> {
    return this.grepRaw(pattern, path, glob)
  }

  private async grepViaShell(pattern: string, targetPath: string, glob?: string | null): Promise<GrepMatch[]> {
    const globFlag = glob ? `--include=${glob} ` : ""
    const escapedPattern = pattern.replace(/'/g, "'\\''")
    const escapedTarget = targetPath.replace(/'/g, "'\\''")
    const cmd = `grep -rn ${globFlag}'${escapedPattern}' '${escapedTarget}' 2>/dev/null || true`
    const result = await this.execute(cmd, 30_000)

    const matches: GrepMatch[] = []
    for (const line of result.output.split("\n")) {
      const colonIdx = line.indexOf(":")
      if (colonIdx > 0) {
        const path = line.slice(0, colonIdx)
        const rest = line.slice(colonIdx + 1)
        const secondColonIdx = rest.indexOf(":")
        if (secondColonIdx > 0) {
          const lineNum = parseInt(rest.slice(0, secondColonIdx), 10)
          const text = rest.slice(secondColonIdx + 1)
          if (!isNaN(lineNum)) {
            matches.push({ path, line: lineNum, text })
          }
        }
      }
    }
    return matches
  }

  getCwd(): string {
    return this.cwd
  }

  async setCwd(path: string): Promise<void> {
    this.cwd = path
  }

  async close(): Promise<void> {
    // No persistent client to close with undici
  }

  /**
   * 参考代码：
   * - upload_files: /ScienceClaw/backend/deepagent/full_sandbox_backend.py:524-532
   */
  async uploadFiles(files: Array<[string, Uint8Array | string]>): Promise<FileUploadResponse[]> {
    const results: FileUploadResponse[] = []
    for (const [path, content] of files) {
      try {
        const contentStr = typeof content === "string" ? content : new TextDecoder().decode(content)
        await this.call("POST", "/v1/file/write", { file: path, content: contentStr })
        results.push({ path, error: null })
      } catch {
        results.push({ path, error: "invalid_path" as FileOperationError })
      }
    }
    return results
  }

  /**
   * 参考代码：
   * - download_files: /ScienceClaw/backend/deepagent/full_sandbox_backend.py:547-553
   */
  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const results: FileDownloadResponse[] = []
    for (const path of paths) {
      try {
        const content = await this.read(path)
        const encoder = new TextEncoder()
        results.push({ path, content: encoder.encode(content), error: null })
      } catch {
        results.push({ path, content: null, error: "file_not_found" as FileOperationError })
      }
    }
    return results
  }
}