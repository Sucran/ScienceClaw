/**
 * 参考注释：
 * - "SSE 协议管理器 — 工具注册表、事件类型、图标分类。"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/sse_protocol.py:1-239
 */
export enum EventType {
  AGENT_STEP = "agent_step",
  AGENT_ACTION = "agent_action",
  AGENT_THINKING = "thinking",
  AGENT_RESPONSE_CHUNK = "message_chunk",
  AGENT_RESPONSE_DONE = "message_chunk_done",
  AGENT_TOOL_START = "agent_tool_start",
  AGENT_TOOL_END = "agent_tool_end",
  PLAN_UPDATE = "plan",
  ERROR = "error",
  DONE = "done"
}

/**
 * 参考注释：
 * - "工具类别"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/sse_protocol.py:31-40
 */
export enum ToolCategory {
  FILE = "file",
  FILESYSTEM = "filesystem",
  EXECUTION = "execution",
  SEARCH = "search",
  NETWORK = "network",
  PLANNING = "planning",
  DATA = "data",
  SKILL = "skill",
  SYSTEM = "system",
  OTHER = "other",
  CUSTOM = "custom"
}

export interface SSEEvent<T = unknown> {
  event: EventType | string
  data: T
  timestamp: string
}

export interface AgentToolStartData {
  tool_name: string
  tool_category: ToolCategory | string
  args?: Record<string, unknown>
}

export interface AgentToolEndData {
  tool_name: string
  success: boolean
  result?: unknown
  error?: string
  execution_time: number
}

export interface ToolMeta {
  name: string
  category: ToolCategory | string
  icon: string
  description: string
  sandbox?: boolean
}

/**
 * 工具注册表 — 维护所有已知工具的元数据（图标、分类、描述）
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/sse_protocol.py:70-197
 */
class ToolRegistry {
  private readonly tools = new Map<string, ToolMeta>()
  private readonly extraMeta = new Map<string, Record<string, unknown>>()

  constructor() {
    this.initializeDefaultTools()
  }

  private initializeDefaultTools(): void {
    // 搜索类
    this.register({ name: "web_search", category: ToolCategory.SEARCH, icon: "🔍", description: "Web Search" })
    this.register({ name: "web_crawl", category: ToolCategory.NETWORK, icon: "🌐", description: "Web Crawl" })

    // Terminal 类
    this.register({ name: "terminal_execute", category: ToolCategory.EXECUTION, icon: "⚡", description: "Execute Command" })
    this.register({ name: "terminal_session", category: ToolCategory.EXECUTION, icon: "⚡", description: "Terminal Session" })
    this.register({ name: "terminal_kill", category: ToolCategory.EXECUTION, icon: "🛑", description: "Kill Process" })
    this.register({ name: "sandbox_exec", category: ToolCategory.EXECUTION, icon: "⚡", description: "Execute Command" })
    this.register({ name: "execute", category: ToolCategory.EXECUTION, icon: "⚡", description: "Execute Command" })

    // 文件系统类
    this.register({ name: "file_read", category: ToolCategory.FILESYSTEM, icon: "📖", description: "Read File" })
    this.register({ name: "file_write", category: ToolCategory.FILESYSTEM, icon: "✏️", description: "Write File" })
    this.register({ name: "file_list", category: ToolCategory.FILESYSTEM, icon: "📂", description: "List Files" })
    this.register({ name: "file_search", category: ToolCategory.SEARCH, icon: "🔎", description: "Search Files" })
    this.register({ name: "file_replace", category: ToolCategory.FILESYSTEM, icon: "✏️", description: "Replace in File" })
    this.register({ name: "sandbox_read_file", category: ToolCategory.FILESYSTEM, icon: "📖", description: "Read File" })
    this.register({ name: "sandbox_write_file", category: ToolCategory.FILESYSTEM, icon: "✏️", description: "Write File" })
    this.register({ name: "sandbox_find_files", category: ToolCategory.FILESYSTEM, icon: "📂", description: "Find Files" })
    this.register({ name: "read_file", category: ToolCategory.FILESYSTEM, icon: "📖", description: "Read File" })
    this.register({ name: "write_file", category: ToolCategory.FILESYSTEM, icon: "✏️", description: "Write File" })
    this.register({ name: "edit_file", category: ToolCategory.FILESYSTEM, icon: "✏️", description: "Edit File" })
    this.register({ name: "find_files", category: ToolCategory.FILESYSTEM, icon: "📂", description: "Find Files" })
    this.register({ name: "ls", category: ToolCategory.FILESYSTEM, icon: "📂", description: "List Files" })
    this.register({ name: "grep", category: ToolCategory.SEARCH, icon: "🔎", description: "Search Text" })
    this.register({ name: "write", category: ToolCategory.FILESYSTEM, icon: "✏️", description: "Write File" })
    this.register({ name: "glob", category: ToolCategory.FILESYSTEM, icon: "📂", description: "Glob Files" })
    this.register({ name: "read", category: ToolCategory.FILESYSTEM, icon: "📖", description: "Read File" })

    // 浏览器类
    this.register({ name: "browser_navigate", category: ToolCategory.NETWORK, icon: "🌐", description: "Navigate URL" })
    this.register({ name: "browser_screenshot", category: ToolCategory.NETWORK, icon: "📸", description: "Screenshot" })
    this.register({ name: "browser_extract", category: ToolCategory.NETWORK, icon: "🌐", description: "Extract Page" })
    this.register({ name: "browser_click", category: ToolCategory.NETWORK, icon: "🖱️", description: "Click Element" })
    this.register({ name: "browser_type", category: ToolCategory.NETWORK, icon: "⌨️", description: "Type Text" })
    this.register({ name: "browser_close", category: ToolCategory.NETWORK, icon: "🌐", description: "Close Browser" })
    this.register({ name: "browser_get_markdown", category: ToolCategory.NETWORK, icon: "🌐", description: "Get Markdown" })
    this.register({ name: "browser_get_text", category: ToolCategory.NETWORK, icon: "🌐", description: "Get Page Text" })
    this.register({ name: "browser_read_links", category: ToolCategory.NETWORK, icon: "🔗", description: "Read Links" })
    this.register({ name: "browser_tab_list", category: ToolCategory.NETWORK, icon: "🌐", description: "List Tabs" })
    this.register({ name: "browser_switch_tab", category: ToolCategory.NETWORK, icon: "🌐", description: "Switch Tab" })
    this.register({ name: "browser_go_back", category: ToolCategory.NETWORK, icon: "🌐", description: "Go Back" })
    this.register({ name: "browser_go_forward", category: ToolCategory.NETWORK, icon: "🌐", description: "Go Forward" })
    this.register({ name: "browser_hover", category: ToolCategory.NETWORK, icon: "🌐", description: "Hover Element" })
    this.register({ name: "browser_select", category: ToolCategory.NETWORK, icon: "🌐", description: "Select Element" })
    this.register({ name: "browser_form_input_fill", category: ToolCategory.NETWORK, icon: "🌐", description: "Fill Form" })
    this.register({ name: "browser_get_clickable_elements", category: ToolCategory.NETWORK, icon: "🌐", description: "Get Elements" })
    this.register({ name: "browser_get_download_list", category: ToolCategory.NETWORK, icon: "📥", description: "Downloads" })

    // 文档处理类
    this.register({ name: "markitdown_extract", category: ToolCategory.DATA, icon: "📄", description: "Extract Document" })
    this.register({ name: "markitdown_convert", category: ToolCategory.DATA, icon: "📄", description: "Convert to Markdown" })

    // MCP Sandbox 实际工具名
    this.register({ name: "sandbox_execute_bash", category: ToolCategory.EXECUTION, icon: "⚡", description: "Execute Bash" })
    this.register({ name: "sandbox_execute_code", category: ToolCategory.EXECUTION, icon: "🐍", description: "Execute Code" })
    this.register({ name: "sandbox_file_operations", category: ToolCategory.FILESYSTEM, icon: "📂", description: "File Operations" })
    this.register({ name: "sandbox_str_replace_editor", category: ToolCategory.FILESYSTEM, icon: "✏️", description: "Edit File" })
    this.register({ name: "sandbox_get_context", category: ToolCategory.SYSTEM, icon: "📋", description: "Get Context" })
    this.register({ name: "sandbox_get_packages", category: ToolCategory.SYSTEM, icon: "📦", description: "Get Packages" })
    this.register({ name: "sandbox_convert_to_markdown", category: ToolCategory.DATA, icon: "📄", description: "Convert to Markdown" })
    this.register({ name: "sandbox_get_browser_info", category: ToolCategory.NETWORK, icon: "🌐", description: "Browser Info" })
    this.register({ name: "sandbox_browser_screenshot", category: ToolCategory.NETWORK, icon: "📸", description: "Browser Screenshot" })
    this.register({ name: "sandbox_browser_execute_action", category: ToolCategory.NETWORK, icon: "🖱️", description: "Browser Action" })

    // ToolUniverse 科研工具类
    this.register({ name: "tooluniverse_search", category: ToolCategory.DATA, icon: "🔬", description: "Search Scientific Tools" })
    this.register({ name: "tooluniverse_info", category: ToolCategory.DATA, icon: "📋", description: "Tool Specification" })
    this.register({ name: "tooluniverse_run", category: ToolCategory.DATA, icon: "🧪", description: "Run Scientific Tool" })

    // Skill 相关
    this.register({ name: "propose_skill_save", category: ToolCategory.SKILL, icon: "💾", description: "Propose Skill Save" })
    this.register({ name: "propose_tool_save", category: ToolCategory.SKILL, icon: "💾", description: "Propose Tool Save" })
    this.register({ name: "eval_skill", category: ToolCategory.SKILL, icon: "📊", description: "Eval Skill" })
    this.register({ name: "grade_eval", category: ToolCategory.SKILL, icon: "📊", description: "Grade Eval" })
    this.register({ name: "write_todos", category: ToolCategory.PLANNING, icon: "📝", description: "Write Todos" })
    this.register({ name: "todos", category: ToolCategory.PLANNING, icon: "📝", description: "Todos" })
  }

  register(meta: ToolMeta): void {
    this.tools.set(meta.name, meta)
  }

  get(name: string): ToolMeta | undefined {
    return this.tools.get(name)
  }

  registerSandboxTool(name: string, description: string): void {
    this.tools.set(name, {
      name,
      category: ToolCategory.CUSTOM,
      icon: "🔧",
      description,
      sandbox: true
    })
  }

  getMetaDict(name: string): Record<string, unknown> {
    const tool = this.get(name)
    if (tool) {
      const result: Record<string, unknown> = { ...tool }
      const extra = this.extraMeta.get(name)
      if (extra) {
        Object.assign(result, extra)
      }
      return result
    }
    return {
      name,
      category: ToolCategory.CUSTOM,
      icon: "🔧",
      description: name
    }
  }
}

/**
 * 参考注释：
 * - "SSE 协议管理器 — 提供统一的事件 ID 生成与工具元数据查询"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/sse_protocol.py:203-228
 */
export class SSEProtocolManager {
  private readonly toolRegistry: ToolRegistry

  constructor() {
    this.toolRegistry = new ToolRegistry()
  }

  createEvent<T>(event: EventType | string, data: T): SSEEvent<T> {
    return { event, data, timestamp: new Date().toISOString() }
  }

  /**
   * 根据工具函数名获取元数据
   */
  getToolMeta(toolFunction: string): Record<string, unknown> {
    return this.toolRegistry.getMetaDict(toolFunction)
  }

  /**
   * 动态注册工具
   */
  registerTool(name: string, category: ToolCategory, icon: string, description: string): void {
    this.toolRegistry.register({ name, category, icon, description })
  }

  /**
   * 注册一个沙箱执行的外部代理工具
   */
  registerSandboxTool(name: string, description: string): void {
    this.toolRegistry.registerSandboxTool(name, description)
  }
}

let manager: SSEProtocolManager | null = null

export function getProtocolManager(): SSEProtocolManager {
  /**
   * 参考注释：
   * - "获取全局 SSE 协议管理器实例"
   * 参考代码：
   * - /ScienceClaw/backend/deepagent/sse_protocol.py:234-239
   */
  if (!manager) manager = new SSEProtocolManager()
  return manager
}
