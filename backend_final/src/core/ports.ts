/**
 * Core "ports" — abstract interfaces that adapters implement.
 * Keeping interfaces here lets `core/` stay framework-agnostic
 * while `adapters/mongo`, `adapters/supabase`, etc. provide concrete impls.
 *
 * Phase 1 only re-exports the existing SessionStorage abstraction.
 * Repository ports (UserRepo / ModelRepo / MemoryRepo / ...) defined
 * in the plan will be added incrementally without breaking current routes.
 */
export type {
  SessionStorage,
  ScienceSession,
  SessionStatus,
} from "./deepagent/sessions.js";

export { setSessionStorage, ScienceSessionNotFoundError } from "./deepagent/sessions.js";
