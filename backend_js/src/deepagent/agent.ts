/**
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:1-587
 */
import { CompositeBackend, createDeepAgent, FilesystemBackend } from "deepagents"
import { getDiagnosticManager } from "./diagnostic.js"
import { createModel, getLlmModel, resolveContextWindow, type ModelConfig } from "./engine.js"
import { config } from "../config.js"
import { FilteredFilesystemBackend } from "./filtered-backend.js"
import { FullSandboxBackend } from "./full-sandbox-backend.js"
import { webSearch, webCrawl, proposeSkillSave, proposeToolSave, evalSkill, gradeEval } from "./tools.js"
import { tooluniverseInfo, tooluniverseRun, tooluniverseSearch } from "./tooluniverse-tools.js"
import { SSEMonitoringMiddleware } from "./sse-middleware.js"
import { ToolResultOffloadMiddleware } from "./offload-middleware.js"
import { existsSync, mkdirSync, chmodSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { getGlobalRegistry, getAllTools } from "../plugins/index.js"
import type { OpenClawPluginToolDefinition } from "../plugins/sdk/core.js"

/**
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:49-66 (外部扩展工具加载)
 */
interface ExternalTool {
  name: string
  description?: string
  fn?: (...args: unknown[]) => unknown
}

let externalTools: ExternalTool[] = []
let externalToolsLoaded = false

function loadExternalTools(): void {
  if (externalToolsLoaded) return
  externalToolsLoaded = true
  try {
    // Dynamic import for external tools - requires a Tools package
    // This is a no-op in TypeScript since we can't dynamically import without knowing the module
    console.log("[Agent] External tool loading skipped in TypeScript")
  } catch {
    console.log("[Agent] No external Tools package found, skipping external tool loading")
  }
}

// Ensure external tools are loaded
loadExternalTools()

/**
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:71-76
 */
const BUILTIN_SKILLS_DIR = process.env.BUILTIN_SKILLS_DIR ?? "/app/builtin_skills"
const EXTERNAL_SKILLS_DIR = process.env.EXTERNAL_SKILLS_DIR ?? "/app/Skills"
const BUILTIN_SKILLS_ROUTE = "/builtin-skills/"
const EXTERNAL_SKILLS_ROUTE = "/skills/"
const WORKSPACE_DIR = process.env.WORKSPACE_DIR ?? "/home/scienceclaw"
const SANDBOX_REST_URL = process.env.SANDBOX_REST_URL ?? "http://localhost:18080"

/**
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:118-173
 */
const SYSTEM_PROMPT_TEMPLATE = `You are ScienceClaw, a proactive personal AI assistant designed to help users solve problems, conduct research, and complete tasks efficiently.

Current date and time: {current_datetime}.

## Language
Always respond in {language_instruction}.

## Core Principles
- Adapt to the conversation. Chat naturally for casual topics, but take concrete actions when the user asks for tasks or problem-solving.
- Prefer execution over explanation. If a task can be solved through code or tools, implement and execute the solution instead of only describing it.
- **Real-time information**: For any question involving current or up-to-date information, you MUST use \`web_search\` — NEVER answer from training data alone.
- **Write files, not chat**: When the user asks to write, create, or generate code/scripts/files, ALWAYS use \`write_file\` to create real files — never just paste code in chat.
- **Write → Execute → Fix loop**: After writing ANY executable script, you MUST immediately run it via \`execute\` to verify correctness. If it fails, fix and re-run.
- **Skill-first approach**: ALWAYS check available skills (\`/builtin-skills/\` and \`/skills/\`) before starting any task. If a skill matches, \`read_file\` its SKILL.md and follow the workflow. Do NOT reinvent what a skill already provides.
- **Research tasks**: When the user's request involves research, reports, reviews, surveys, literature analysis, discoveries, or any deep investigation topic, ALWAYS check and consider \`/skills/deep-research/SKILL.md\` first.
- **SKILL.md files are instruction documents** — use \`read_file\` to read them, NEVER \`execute\` them as scripts.
- Solve problems proactively. Only ask questions when the intent or requirements are truly unclear.

## Workspace
Your workspace directory is {workspace_dir}/.
- All files should be created under this directory using absolute paths.
- The workspace is shared between the file system and the execution sandbox.

## Sandbox Boundary
The sandbox is an isolated execution environment. Scripts running in the sandbox CANNOT import or call your tools directly (\`from functions import ...\` will FAIL with \`ModuleNotFoundError\`).

**Data flow**: Use YOUR tools (web_search, web_crawl, tooluniverse_run, etc.) to gather data → save results to workspace files via \`write_file\` → write sandbox scripts that READ those files. NEVER call your tools from within sandbox scripts.

**Large tool results** are automatically saved to \`research_data/\` files (raw format). To use them in sandbox scripts: \`read_file\` the data → write a clean JSON file via a Python script with \`json.dump()\` → sandbox scripts read that clean file.

## Task Completion Strategy

### Step 1: Understand & Plan
- Identify ALL deliverables, requirements, and output format.
- For any task involving 2+ steps, call \`write_todos\` BEFORE starting.
- Check Memory: **AGENTS.md** and **CONTEXT.md**.
- **Check Available Skills (MANDATORY)** — review the skills catalog. If ANY skill matches the task, \`read_file\` that SKILL.md and follow its workflow. Do NOT skip this step.

### Step 2: Execute
- If a skill matched → follow the skill's workflow completely.
- Otherwise, use tools directly. Priority: existing skills > built-in tools > ToolUniverse > web_search.
- **Before \`propose_tool_save\`**: read \`/builtin-skills/tool-creator/SKILL.md\` first.
- **Before \`propose_skill_save\`**: read \`/builtin-skills/skill-creator/SKILL.md\` first.
- Build incrementally — one component per tool call. Test via \`execute\` after writing.

### Step 3: Verify & Deliver
- Re-read the user's original request. Check all deliverables are produced.
- If a script fails, fix the specific error — do NOT rewrite from scratch. If it fails 2+ times, simplify.

### Step 4: Reflect & Capture
After completing a non-trivial task:
- **Reusable workflow** → Suggest saving as a **skill** via skill-creator.
- **Reusable function** → Suggest saving as a **tool** via tool-creator.
- **User preference learned** → Update **AGENTS.md** via \`edit_file\`.
- **Project context learned** → Update **CONTEXT.md** via \`edit_file\`.
`

const EVAL_SYSTEM_PROMPT_TEMPLATE = `You are ScienceClaw, a proactive personal AI assistant designed to help users solve problems, conduct research, and complete tasks efficiently.

Current date and time: {current_datetime}

## Core Principles
- Prefer execution over explanation. If a task can be solved through code or tools, implement and execute the solution instead of only describing it.
- Always respond in the same language the user uses.
- When the user asks to write, create, or generate code/scripts/files, ALWAYS use write_file to create real files.
- Use sandbox execution whenever it can produce verifiable results.

## Workspace
Your workspace directory is {workspace_dir}/.
- All files should be created under this directory using absolute paths.
- The workspace is shared between the file system and the execution sandbox.
`

const LANGUAGE_MAP: Record<string, [string, string]> = {
  zh: ["Chinese (Simplified)", "你必须使用简体中文回复所有内容。所有生成的报告、文档标题和正文也必须使用简体中文。"],
  en: ["English", "You must respond in English. All generated reports, document titles and body text must also be in English."]
}

export interface TaskSettingsLike {
  max_tokens?: number
  sandbox_exec_timeout?: number
  max_output_chars?: number
}

export interface DeepAgentRuntime {
  invoke: (input: { messages: { role: string; content: string }[] }) => Promise<unknown>
  stream: (input: { messages: { role: string; content: string }[] }) => AsyncIterable<unknown>
}

/**
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:199-219
 */
export function getSystemPrompt(workspaceDir: string, sandboxEnv?: string | null, language?: string): string {
  const now = new Date().toISOString()
  const code = (language ?? "").trim().toLowerCase()
  const langInstruction = LANGUAGE_MAP[code]
    ? `- The user has set preferred language to ${LANGUAGE_MAP[code][0]}.\n- ${LANGUAGE_MAP[code][1]}`
    : "- Always respond in the same language the user uses."
  let prompt = SYSTEM_PROMPT_TEMPLATE
    .replace("{current_datetime}", now)
    .replace("{workspace_dir}", workspaceDir)
    .replace("{language_instruction}", langInstruction)
  if (sandboxEnv) {
    prompt += `\n\n## Sandbox Environment Information\n${sandboxEnv}`
  }
  return prompt
}

function getEvalSystemPrompt(workspaceDir: string, sandboxEnv?: string | null): string {
  const now = new Date().toISOString()
  let prompt = EVAL_SYSTEM_PROMPT_TEMPLATE
    .replace("{current_datetime}", now)
    .replace("{workspace_dir}", workspaceDir)
  if (sandboxEnv) {
    prompt += `\n\n## Sandbox Environment Information\n${sandboxEnv}`
  }
  return prompt
}

/**
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:277-308 (屏蔽列表查询)
 * TypeScript version uses REST API instead of MongoDB
 */
export async function getBlockedSkills(userId?: string | null): Promise<Set<string>> {
  // In TypeScript, we use a REST API or return empty set
  // The actual implementation would call a REST endpoint
  return new Set()
}

export async function getBlockedTools(userId?: string | null): Promise<Set<string>> {
  // In TypeScript, we use a REST API or return empty set
  return new Set()
}

/**
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:244-270
 */
function collectTools(blockedTools: Set<string>): Array<(...args: unknown[]) => unknown> {
  // Collect built-in tools
  const builtinTools: Array<(...args: unknown[]) => unknown> = [
    webSearch as (...args: unknown[]) => unknown,
    webCrawl as (...args: unknown[]) => unknown,
    proposeSkillSave as (...args: unknown[]) => unknown,
    proposeToolSave as (...args: unknown[]) => unknown,
    evalSkill as (...args: unknown[]) => unknown,
    gradeEval as (...args: unknown[]) => unknown,
    tooluniverseSearch as (...args: unknown[]) => unknown,
    tooluniverseInfo as (...args: unknown[]) => unknown,
    tooluniverseRun as (...args: unknown[]) => unknown,
    ...externalTools.map(t => t.fn).filter((fn): fn is (...args: unknown[]) => unknown => typeof fn === "function")
  ]

  // Collect plugin tools from registry
  const registry = getGlobalRegistry()
  let pluginTools: Array<(...args: unknown[]) => unknown> = []
  if (registry) {
    const allPluginTools = getAllTools(registry)
    pluginTools = allPluginTools.map(tool => {
      const toolName = tool.name
      // Create a wrapper function that executes the plugin tool
      return (async (...args: unknown[]) => {
        const input = args[0]
        const context = {
          config: {},
          runtimeConfig: {},
        }
        return tool.execute(input, context)
      }) as (...args: unknown[]) => unknown
    })
  }

  const all = [...builtinTools, ...pluginTools]
  return all.filter((t) => !blockedTools.has((t as { name?: string }).name ?? ""))
}

/**
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:82-111
 */
function buildBackend(sandbox: FullSandboxBackend, blockedSkills: Set<string>) {
  const routes: Record<string, FilesystemBackend | FilteredFilesystemBackend> = {}
  if (existsSync(BUILTIN_SKILLS_DIR)) {
    routes[BUILTIN_SKILLS_ROUTE] = new FilesystemBackend({
      rootDir: BUILTIN_SKILLS_DIR,
      virtualMode: true
    })
  }
  if (existsSync(EXTERNAL_SKILLS_DIR)) {
    routes[EXTERNAL_SKILLS_ROUTE] = new FilteredFilesystemBackend({
      rootDir: EXTERNAL_SKILLS_DIR,
      virtualMode: true,
      blockedSkills
    })
  }
  if (Object.keys(routes).length === 0) return sandbox
  return new CompositeBackend(sandbox, routes)
}

/**
 * 初始化记忆文件（AGENTS.md 和 CONTEXT.md）
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:413-460
 */
function initMemoryFiles(workspaceDir: string, userId?: string | null): string[] {
  const memFiles: string[] = []
  const memUser = userId ?? "default_user"
  const memDir = join(WORKSPACE_DIR, "_memory", memUser)

  try {
    mkdirSync(memDir, { recursive: true })
    chmodSync(memDir, 0o777)
  } catch {
    // Directory may already exist
  }

  // Global memory (AGENTS.md)
  const globalMemPath = join(memDir, "AGENTS.md")
  if (!existsSync(globalMemPath)) {
    try {
      writeFileSync(globalMemPath, "# Global Memory (persists across all sessions)\n\n## User Preferences\n\n## General Patterns\n\n## Notes\n", "utf-8")
    } catch {
      // Ignore write errors
    }
  }
  memFiles.push(globalMemPath)

  // Session context (CONTEXT.md)
  const sessionMemPath = join(workspaceDir, "CONTEXT.md")
  if (!existsSync(sessionMemPath)) {
    try {
      writeFileSync(sessionMemPath, "# Session Context (this session only)\n\n## Project Context\n\n## Task Notes\n", "utf-8")
    } catch {
      // Ignore write errors
    }
  }
  memFiles.push(sessionMemPath)

  return memFiles
}

/**
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:315-496
 */
export async function deepAgent(
  sessionId: string,
  modelConfig?: ModelConfig,
  userId?: string | null,
  taskSettings?: TaskSettingsLike | null,
  diagnosticEnabled = false,
  language?: string
): Promise<{ agent: DeepAgentRuntime; sseMiddleware: SSEMonitoringMiddleware; contextWindow: number; diagnostic: unknown }> {
  // 构建完整的模型配置 (合并用户配置和全局默认配置)
  const effectiveConfig = {
    model_name: modelConfig?.model_name || config.dsModel,
    provider: modelConfig?.provider || "openai",
    api_key: modelConfig?.api_key || config.dsApiKey,
    base_url: modelConfig?.base_url || config.dsBaseUrl,
    max_tokens: modelConfig?.max_tokens || taskSettings?.max_tokens,
    temperature: modelConfig?.temperature,
    top_p: modelConfig?.top_p,
    context_window: modelConfig?.context_window,
  }

  // 创建 LangChain 模型实例
  const langchainModel = createModel(effectiveConfig)
  const contextWindow = resolveContextWindow(effectiveConfig.model_name, effectiveConfig.context_window)

  const blockedSkills = await getBlockedSkills(userId)
  const blockedTools = await getBlockedTools(userId)
  const tools = collectTools(blockedTools)
  const sandbox = new FullSandboxBackend({
    sessionId,
    restUrl: SANDBOX_REST_URL,
    initialCwd: `${WORKSPACE_DIR}/${sessionId}`,
    timeoutMs: (taskSettings?.sandbox_exec_timeout ?? 600) * 1000,
    maxOutputChars: taskSettings?.max_output_chars
  })

  // Get sandbox context
  let sandboxInfo: string | null = null
  try {
    const ctx = await sandbox.getContext()
    if (ctx && (ctx as { success?: boolean }).success !== false) {
      sandboxInfo = JSON.stringify(ctx)
    }
  } catch {
    // Ignore context errors
  }

  const backend = buildBackend(sandbox, blockedSkills)
  const sseMiddleware = new SSEMonitoringMiddleware(async () => undefined)

  // Initialize memory files
  const memoryFiles = initMemoryFiles(`${WORKSPACE_DIR}/${sessionId}`, userId)

  // Tool result offload middleware
  const offloadMiddleware = new ToolResultOffloadMiddleware(`${WORKSPACE_DIR}/${sessionId}`, sandbox)

  const diag = getDiagnosticManager(Boolean(diagnosticEnabled))
  if (diag) {
    offloadMiddleware.setDiagnostic({
      logOffload: (tool, original, summary, path) => {
        console.log(`[Offload] ${tool}: ${original} -> ${summary} chars -> ${path}`)
      }
    })
  }

  const systemPrompt = getSystemPrompt(`${WORKSPACE_DIR}/${sessionId}`, sandboxInfo, language)
  if (diag) {
    await diag.saveSystemPrompt(systemPrompt)
  }

  const skillSources: string[] = []
  if (existsSync(BUILTIN_SKILLS_DIR)) skillSources.push(BUILTIN_SKILLS_ROUTE)
  if (existsSync(EXTERNAL_SKILLS_DIR)) skillSources.push(EXTERNAL_SKILLS_ROUTE)

  const params: Record<string, unknown> = {
    model: langchainModel,
    tools,
    middleware: [offloadMiddleware, sseMiddleware],
    systemPrompt,
    backend,
    skills: skillSources.length > 0 ? skillSources : undefined,
    memory: memoryFiles
  }

  console.log("[Agent] Creating deepAgent with params:", { hasModel: !!langchainModel, toolsCount: tools.length, hasBackend: !!backend, hasMiddleware: true, hasSystemPrompt: !!systemPrompt, skillsCount: skillSources.length, memoryCount: memoryFiles.length })
  // Note: not passing tools or middleware - let deepagent use its defaults
  const agentParams: Record<string, unknown> = {
    model: langchainModel,
    systemPrompt,
    backend,
    skills: skillSources.length > 0 ? skillSources : undefined,
    memory: memoryFiles
  }
  console.log("[Agent] Creating deepAgent with params:", agentParams)
  const agent = createDeepAgent(agentParams) as unknown as DeepAgentRuntime
  console.log("[Agent] Agent type:", typeof agent)
  console.log("[Agent] Agent keys:", Object.keys(agent as any))
  console.log("[Agent] Agent.stream type:", typeof (agent as any).stream)
  console.log("[Agent] Agent.invoke type:", typeof (agent as any).invoke)
  // Check if agent has a 'runnable' or similar property
  console.log("[Agent] Agent.runnable type:", typeof (agent as any).runnable)
  console.log("[Agent] Agent._agent type:", typeof (agent as any)._agent)
  console.log("[Agent] deepAgent created successfully")
  return { agent, sseMiddleware, contextWindow, diagnostic: diag }
}

/**
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/agent.py:498-587
 */
export async function deepAgentEval(
  sessionId: string,
  modelConfig?: ModelConfig,
  skillSources?: string[]
): Promise<{ agent: DeepAgentRuntime; sseMiddleware: SSEMonitoringMiddleware }> {
  // 构建完整的模型配置 (合并用户配置和全局默认配置)
  const effectiveConfig = {
    model_name: modelConfig?.model_name || config.dsModel,
    provider: modelConfig?.provider || "openai",
    api_key: modelConfig?.api_key || config.dsApiKey,
    base_url: modelConfig?.base_url || config.dsBaseUrl,
    max_tokens: modelConfig?.max_tokens,
    temperature: modelConfig?.temperature,
  }

  // 创建 LangChain 模型实例
  const langchainModel = createModel(effectiveConfig)

  const sandbox = new FullSandboxBackend({
    sessionId,
    restUrl: SANDBOX_REST_URL,
    initialCwd: `${WORKSPACE_DIR}/${sessionId}`
  })

  // Get sandbox context
  let sandboxInfo: string | null = null
  try {
    const ctx = await sandbox.getContext()
    if (ctx && (ctx as { success?: boolean }).success !== false) {
      sandboxInfo = JSON.stringify(ctx)
    }
  } catch {
    // Ignore context errors
  }

  const routes: Record<string, FilesystemBackend | FilteredFilesystemBackend> = {}
  const resolvedSources: string[] = []
  if (skillSources?.includes(BUILTIN_SKILLS_ROUTE) && existsSync(BUILTIN_SKILLS_DIR)) {
    routes[BUILTIN_SKILLS_ROUTE] = new FilesystemBackend({ rootDir: BUILTIN_SKILLS_DIR, virtualMode: true })
    resolvedSources.push(BUILTIN_SKILLS_ROUTE)
  }
  if ((!skillSources || skillSources.includes(EXTERNAL_SKILLS_ROUTE)) && existsSync(EXTERNAL_SKILLS_DIR)) {
    routes[EXTERNAL_SKILLS_ROUTE] = new FilteredFilesystemBackend({
      rootDir: EXTERNAL_SKILLS_DIR,
      virtualMode: true,
      blockedSkills: new Set()
    })
    resolvedSources.push(EXTERNAL_SKILLS_ROUTE)
  }
  const backend = Object.keys(routes).length > 0 ? new CompositeBackend(sandbox, routes) : sandbox
  const sseMiddleware = new SSEMonitoringMiddleware(async () => undefined)
  const params: Record<string, unknown> = {
    model: langchainModel,
    tools: [webSearch, webCrawl],
    middleware: [sseMiddleware],
    systemPrompt: getEvalSystemPrompt(`${WORKSPACE_DIR}/${sessionId}`, sandboxInfo),
    backend,
    skills: resolvedSources.length > 0 ? resolvedSources : undefined
  }
  const agent = createDeepAgent(params) as unknown as DeepAgentRuntime
  return { agent, sseMiddleware }
}

export const DeepAgentPaths = {
  BUILTIN_SKILLS_DIR,
  EXTERNAL_SKILLS_DIR,
  BUILTIN_SKILLS_ROUTE,
  EXTERNAL_SKILLS_ROUTE,
  WORKSPACE_DIR
}