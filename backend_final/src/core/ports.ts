/**
 * Core "ports" — abstract interfaces that adapters implement.
 * Keeping interfaces here lets `core/` stay framework-agnostic
 * while `adapters/mongo`, `adapters/supabase`, etc. provide concrete impls.
 */
export type {
  SessionStorage,
  ScienceSession,
  SessionStatus,
} from "./deepagent/sessions.js"

export { setSessionStorage, ScienceSessionNotFoundError } from "./deepagent/sessions.js"

export interface HookRunner {
  runHook(event: string, data: unknown, ctx: { sessionId: string; userId?: string }): Promise<void>
}

export type { DeepAgentDeps } from "./deepagent/agent.js"
export type { BackendProtocol } from "deepagents"
