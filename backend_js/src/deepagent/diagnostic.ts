/**
 * 参考注释：
 * - "诊断模块 — 记录 Agent 每步 LLM 调用的完整上下文。"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/diagnostic.py:1-13
 */
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * 参考注释：
 * - "Agent 执行诊断记录器"
 * - "系统提示词已保存"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/diagnostic.py:79-100
 */
export class DiagnosticManager {
  constructor(private readonly enabled = false, private readonly root = ".diagnostics") {}

  async saveSystemPrompt(prompt: string): Promise<void> {
    if (!this.enabled) return
    await mkdir(this.root, { recursive: true })
    const target = join(this.root, `system_prompt_${Date.now()}.txt`)
    await writeFile(target, prompt, "utf-8")
  }
}

let singleton: DiagnosticManager | null = null

export function getDiagnosticManager(enabled = false): DiagnosticManager {
  if (!singleton) singleton = new DiagnosticManager(enabled)
  return singleton
}
