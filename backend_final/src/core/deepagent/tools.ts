/**
 * 参考注释：
 * - "DeepAgents 内置工具集 — 网页搜索与爬取。"
 * - "支持多输入、异步并行"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/tools.py:1-10
 */
import { request } from "undici"

export interface WebSearchItem {
  title: string
  url: string
  snippet: string
}

export interface WebSearchResult {
  query: string
  results: WebSearchItem[]
}

export interface ToolContext {
  webSearchUrl?: string
  webCrawlUrl?: string
}

/**
 * 参考代码：
 * - web_search 多 query 拆分: /ScienceClaw/backend/deepagent/tools.py:85-114
 */
export function splitQueries(input: string): string[] {
  return input
    .split("|")
    .map((q) => q.trim())
    .filter(Boolean)
}

/**
 * 参考注释：
 * - "Search the internet for real-time information..."
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/tools.py:84-114
 */
export async function webSearch(input: string, ctx: ToolContext = {}): Promise<WebSearchResult[]> {
  const endpoint = ctx.webSearchUrl ?? process.env.WEB_SEARCH_URL ?? ""
  if (!endpoint) throw new Error("WEB_SEARCH_URL is required")
  const queries = splitQueries(input)
  const all = await Promise.all(
    queries.map(async (query) => {
      const res = await request(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query })
      })
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`web_search failed: ${res.statusCode}`)
      }
      const data = (await res.body.json()) as { results?: WebSearchItem[] }
      return { query, results: data.results ?? [] }
    })
  )
  return all
}

/**
 * 参考代码：
 * - crawl_urls 批量爬取: /ScienceClaw/backend/deepagent/tools.py:56-70
 */
export async function webCrawl(url: string, ctx: ToolContext = {}): Promise<string> {
  const endpoint = ctx.webCrawlUrl ?? process.env.WEB_CRAWL_URL ?? ""
  if (!endpoint) throw new Error("WEB_CRAWL_URL is required")
  const res = await request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url })
  })
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`web_crawl failed: ${res.statusCode}`)
  }
  const data = (await res.body.json()) as { markdown?: string; content?: string }
  return data.markdown ?? data.content ?? ""
}

/**
 * 参考代码：
 * - propose_skill_save: /ScienceClaw/backend/deepagent/tools.py:116-127
 */
export async function proposeSkillSave(name: string, summary: string): Promise<string> {
  return JSON.stringify({ action: "propose_skill_save", name, summary }, null, 2)
}

/**
 * 参考代码：
 * - propose_tool_save: /ScienceClaw/backend/deepagent/tools.py:129-145
 */
export async function proposeToolSave(name: string, summary: string): Promise<string> {
  return JSON.stringify({ action: "propose_tool_save", name, summary }, null, 2)
}

/**
 * 参考代码：
 * - eval_skill: /ScienceClaw/backend/deepagent/tools.py:147-220
 */
export async function evalSkill(name: string): Promise<string> {
  return JSON.stringify({ action: "eval_skill", name, status: "queued" }, null, 2)
}

/**
 * 参考代码：
 * - grade_eval: /ScienceClaw/backend/deepagent/tools.py (对应同名函数定义段)
 */
export async function gradeEval(evalId: string): Promise<string> {
  return JSON.stringify({ action: "grade_eval", evalId, status: "queued" }, null, 2)
}
