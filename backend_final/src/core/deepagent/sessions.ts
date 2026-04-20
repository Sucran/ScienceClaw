/**
 * 参考代码：
 * - ScienceSession 数据结构: /ScienceClaw/backend/deepagent/sessions.py:43-68
 * - 会话 CRUD 接口: /ScienceClaw/backend/deepagent/sessions.py:174-343
 */
import { mkdir, readFile, writeFile, readdir, unlink, stat, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { join, dirname } from "node:path"
import { homedir } from "node:os"
import { normalizePlanSteps, type PlanStep } from "./plan-types.js"

export type SessionStatus = "pending" | "active" | "paused" | "completed"

export interface ScienceSession {
  id: string
  thread_id: string
  title?: string
  status: SessionStatus
  model_config_id?: string
  todo_list: PlanStep[]
  events: unknown[]
  created_at: number
  updated_at: number
  vm_root_dir?: string
  user_id?: string
  mode?: string
}

export interface SessionStorage {
  create(session: ScienceSession): Promise<void>
  get(sessionId: string): Promise<ScienceSession | null>
  list(): Promise<ScienceSession[]>
  update(session: ScienceSession): Promise<void>
  delete(sessionId: string): Promise<void>
}

const SESSIONS_DIR = join(homedir(), ".scienceclaw", "sessions")
const MAX_CACHED_SESSIONS = 200
const CACHE_TTL_MS = 3_600_000 // 1 hour

function generateSessionId(): string {
  return crypto.randomUUID().replace(/-/g, "")
}

function generateThreadId(): string {
  return crypto.randomUUID().replace(/-/g, "")
}

export class ScienceSessionNotFoundError extends Error {}

/**
 * 文件系统会话存储实现
 * 当前使用文件存储，后续可替换为 openclaw 存储插件
 */
class FileSessionStorage implements SessionStorage {
  private async ensureDir(): Promise<void> {
    await mkdir(SESSIONS_DIR, { recursive: true })
  }

  private sessionPath(sessionId: string): string {
    return join(SESSIONS_DIR, `${sessionId}.json`)
  }

  async create(session: ScienceSession): Promise<void> {
    await this.ensureDir()
    await writeFile(this.sessionPath(session.id), JSON.stringify(session, null, 2), "utf-8")
  }

  async get(sessionId: string): Promise<ScienceSession | null> {
    try {
      const path = this.sessionPath(sessionId)
      if (!existsSync(path)) return null
      const content = await readFile(path, "utf-8")
      return JSON.parse(content) as ScienceSession
    } catch {
      return null
    }
  }

  async list(): Promise<ScienceSession[]> {
    await this.ensureDir()
    try {
      const files = await readdir(SESSIONS_DIR)
      const sessions: ScienceSession[] = []
      for (const file of files) {
        if (!file.endsWith(".json")) continue
        try {
          const content = await readFile(join(SESSIONS_DIR, file), "utf-8")
          sessions.push(JSON.parse(content) as ScienceSession)
        } catch {
          // Skip invalid files
        }
      }
      return sessions.sort((a, b) => b.updated_at - a.updated_at)
    } catch {
      return []
    }
  }

  async update(session: ScienceSession): Promise<void> {
    await this.ensureDir()
    const tmpPath = this.sessionPath(session.id) + ".tmp"
    await writeFile(tmpPath, JSON.stringify(session, null, 2), "utf-8")
    // Atomic rename
    const { rename } = await import("node:fs/promises")
    await rename(tmpPath, this.sessionPath(session.id))
  }

  async delete(sessionId: string): Promise<void> {
    const path = this.sessionPath(sessionId)
    if (existsSync(path)) {
      await unlink(path)
    }
  }
}

// 内存缓存
interface CacheEntry {
  session: ScienceSession
  atime: number
}

const store = new Map<string, ScienceSession>()
const cacheAtime = new Map<string, number>()
const pendingWrites = new Map<string, NodeJS.Timeout>()
const DEFAULT_WORKSPACE_DIR = process.env.WORKSPACE_DIR ?? "/home/scienceclaw"
let storage: SessionStorage = new FileSessionStorage()

/**
 * 设置会话存储实现（用于测试或替换为其他存储后端）
 */
export function setSessionStorage(s: SessionStorage): void {
  storage = s
}

/**
 * Drop in-memory snapshot so the next get reloads from storage.
 * REST chat sets Mongo `running` but the runner reads this cache first; without this,
 * a stale `completed` from the previous turn can block multi-turn chat.
 */
export function invalidateScienceSessionCache(sessionId: string): void {
  store.delete(sessionId)
  cacheAtime.delete(sessionId)
  const pendingTimeout = pendingWrites.get(sessionId)
  if (pendingTimeout) {
    clearTimeout(pendingTimeout)
    pendingWrites.delete(sessionId)
  }
}

function evictStaleSessions(): void {
  if (store.size <= MAX_CACHED_SESSIONS) return

  const now = Date.now()
  // First pass: remove expired entries
  const expired: string[] = []
  for (const [sid, atime] of cacheAtime.entries()) {
    if (now - atime > CACHE_TTL_MS) {
      expired.push(sid)
    }
  }
  for (const sid of expired) {
    store.delete(sid)
    cacheAtime.delete(sid)
  }

  // Second pass: if still over limit, remove oldest by atime
  if (store.size > MAX_CACHED_SESSIONS) {
    const sorted = [...cacheAtime.entries()].sort((a, b) => a[1] - b[1])
    const toRemove = sorted.slice(0, store.size - MAX_CACHED_SESSIONS)
    for (const [sid] of toRemove) {
      store.delete(sid)
      cacheAtime.delete(sid)
    }
  }
}

function touchSession(sessionId: string): void {
  cacheAtime.set(sessionId, Date.now())
}

const plannerMdDigests = new Map<string, string>()

/**
 * Render plan steps to planner.md format
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/sessions.py:17-42
 */
function renderPlannerMd(plan: PlanStep[]): string {
  const lines: string[] = ["# Plan\n"]
  const statusEmoji: Record<string, string> = {
    pending: "⏳",
    in_progress: "🔄",
    completed: "✅",
    failed: "❌"
  }
  for (const step of plan) {
    const emoji = statusEmoji[step.status] || "📋"
    const checkbox = step.status === "completed" ? "[x]" : "[ ]"
    lines.push(`${checkbox} ${emoji} **${step.id}**: ${step.content}`)
    if (step.tools && step.tools.length > 0) {
      lines.push(`   - Tools: ${step.tools.join(", ")}`)
    }
  }
  return lines.join("\n")
}

/**
 * Sync plan to planner.md in session workspace
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/sessions.py:88-96
 */
async function syncPlannerMd(session: ScienceSession): Promise<void> {
  if (!session.vm_root_dir) return

  const plan = session.todo_list && session.todo_list.length > 0
    ? session.todo_list
    : normalizePlanSteps([{ id: "S1", content: "Task pending", status: "pending" }])

  const content = renderPlannerMd(plan)
  const digest = createHash("md5").update(content).digest("hex")

  if (plannerMdDigests.get(session.id) === digest) return

  try {
    const plannerPath = join(session.vm_root_dir, "planner.md")
    await writeFile(plannerPath, content, "utf-8")
    plannerMdDigests.set(session.id, digest)
  } catch (err) {
    console.error(`[Planner] sync planner.md failed for session ${session.id}:`, err)
  }
}

/**
 * 参考代码：
 * - async_create_science_session: /ScienceClaw/backend/deepagent/sessions.py:174-224
 */
export async function asyncCreateScienceSession(input: {
  title?: string
  model_config_id?: string
  todo_list?: Partial<PlanStep>[]
  user_id?: string
  mode?: string
}): Promise<ScienceSession> {
  const now = Math.floor(Date.now() / 1000)
  const sessionId = generateSessionId()
  const threadId = generateThreadId()
  const vmRootDir = join(DEFAULT_WORKSPACE_DIR, sessionId)

  // Create workspace directory (Python: vm_root.mkdir(parents=True, exist_ok=True))
  try {
    await mkdir(vmRootDir, { recursive: true })
  } catch {
    // Directory may already exist
  }

  const session: ScienceSession = {
    id: sessionId,
    thread_id: threadId,
    title: input.title ?? "New Session",
    status: "pending",
    model_config_id: input.model_config_id,
    todo_list: normalizePlanSteps(input.todo_list ?? []),
    events: [],
    created_at: now,
    updated_at: now,
    vm_root_dir: vmRootDir,
    user_id: input.user_id,
    mode: input.mode ?? "deep"
  }

  store.set(sessionId, session)
  touchSession(sessionId)
  evictStaleSessions()

  await storage.create(session)
  return session
}

/**
 * 参考代码：
 * - async_get_science_session: /ScienceClaw/backend/deepagent/sessions.py:226-268
 */
export async function asyncGetScienceSession(sessionId: string): Promise<ScienceSession> {
  const cached = store.get(sessionId)
  if (cached) {
    touchSession(sessionId)
    return cached
  }

  const fromStorage = await storage.get(sessionId)
  if (fromStorage) {
    store.set(sessionId, fromStorage)
    touchSession(sessionId)
    evictStaleSessions()
    return fromStorage
  }

  throw new ScienceSessionNotFoundError(`Session not found: ${sessionId}`)
}

/**
 * 参考代码：
 * - save/update 模式: /ScienceClaw/backend/deepagent/sessions.py:116-137
 */
export async function asyncUpdateScienceSession(sessionId: string, patch: Partial<ScienceSession>): Promise<ScienceSession> {
  const found = await asyncGetScienceSession(sessionId)
  const merged: ScienceSession = {
    ...found,
    ...patch,
    id: found.id,
    thread_id: found.thread_id,
    updated_at: Math.floor(Date.now() / 1000)
  }
  if (patch.todo_list) merged.todo_list = normalizePlanSteps(patch.todo_list)
  store.set(sessionId, merged)
  touchSession(sessionId)

  // Debounced save to storage
  const existingTimeout = pendingWrites.get(sessionId)
  if (existingTimeout) clearTimeout(existingTimeout)
  const timeout = setTimeout(async () => {
    pendingWrites.delete(sessionId)
    try {
      await storage.update(merged)
      // Sync planner.md when todo_list changes
      if (patch.todo_list) {
        await syncPlannerMd(merged)
      }
    } catch (err) {
      console.error(`Failed to persist session ${sessionId}:`, err)
    }
  }, 1000)
  pendingWrites.set(sessionId, timeout)

  return merged
}

/**
 * 参考代码：
 * - events 字段追加语义: /ScienceClaw/backend/deepagent/sessions.py:54, 128-131
 */
export async function asyncAppendSessionEvent(sessionId: string, event: unknown): Promise<void> {
  const found = await asyncGetScienceSession(sessionId)
  found.events.push(event)
  found.updated_at = Math.floor(Date.now() / 1000)
  store.set(sessionId, found)
  touchSession(sessionId)

  // Debounced persist to storage
  const existingTimeout = pendingWrites.get(sessionId)
  if (existingTimeout) clearTimeout(existingTimeout)
  const timeout = setTimeout(async () => {
    pendingWrites.delete(sessionId)
    try {
      await storage.update(found)
    } catch (err) {
      console.error(`Failed to persist session ${sessionId}:`, err)
    }
  }, 1000)
  pendingWrites.set(sessionId, timeout)
}

/**
 * 参考代码：
 * - async_list_science_sessions: /ScienceClaw/backend/deepagent/sessions.py:271-311
 */
export async function asyncListScienceSessions(): Promise<ScienceSession[]> {
  return [...store.values()].sort((a, b) => b.updated_at - a.updated_at)
}

/**
 * 删除会话
 */
export async function asyncDeleteScienceSession(sessionId: string): Promise<void> {
  const exists = store.has(sessionId) || await storage.get(sessionId)
  if (!exists) {
    throw new ScienceSessionNotFoundError(`Session not found: ${sessionId}`)
  }

  store.delete(sessionId)
  cacheAtime.delete(sessionId)
  const pendingTimeout = pendingWrites.get(sessionId)
  if (pendingTimeout) {
    clearTimeout(pendingTimeout)
    pendingWrites.delete(sessionId)
  }
  await storage.delete(sessionId)
}

/**
 * 取消会话
 */
export async function asyncCancelScienceSession(sessionId: string): Promise<void> {
  const session = await asyncGetScienceSession(sessionId)
  session.status = "paused"
  store.set(sessionId, session)
  touchSession(sessionId)
}

/**
 * 获取会话工作区目录
 */
export async function asyncGetSessionWorkspace(sessionId: string): Promise<string> {
  const session = await asyncGetScienceSession(sessionId)
  return session.vm_root_dir ?? join(DEFAULT_WORKSPACE_DIR, sessionId)
}