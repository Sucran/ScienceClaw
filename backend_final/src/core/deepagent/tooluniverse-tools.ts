/**
 * 参考注释：
 * - "ToolUniverse LangChain 工具 — 直接在后端进程内调用 ToolUniverse SDK。"
 * - "工具列表：tooluniverse_search / tooluniverse_info / tooluniverse_run"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/tooluniverse_tools.py:1-13
 */
import { request } from "undici"

const baseUrl = (process.env.TOOLUNIVERSE_API_BASE_URL ?? "https://tooluniverse.ai").replace(/\/$/, "")

async function call(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await request(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`tooluniverse failed: ${res.statusCode}`)
  }
  return res.body.json()
}

/**
 * 参考代码：
 * - tooluniverse_search: /ScienceClaw/backend/deepagent/tooluniverse_tools.py:34-70
 */
export async function tooluniverseSearch(query: string): Promise<unknown> {
  return call("/api/tool/search", { query, limit: 5 })
}

/**
 * 参考代码：
 * - tooluniverse_info: /ScienceClaw/backend/deepagent/tooluniverse_tools.py:72-94
 */
export async function tooluniverseInfo(toolName: string): Promise<unknown> {
  return call("/api/tool/info", { tool_name: toolName })
}

/**
 * 参考代码：
 * - tooluniverse_run: /ScienceClaw/backend/deepagent/tooluniverse_tools.py:96-141
 */
export async function tooluniverseRun(toolName: string, params: Record<string, unknown>): Promise<unknown> {
  return call("/api/tool/run", { tool_name: toolName, params })
}
