/**
 * SupabaseSessionStorage — Tier 1 skeleton.
 *
 * Maps the `SessionStorage` port (defined in `core/deepagent/sessions.ts`) to
 * a Supabase Postgres table named `agent_sessions`:
 *
 *   create table agent_sessions (
 *     id              text primary key,
 *     user_id         uuid references auth.users(id) on delete cascade,
 *     thread_id       text not null,
 *     title           text,
 *     status          text not null default 'pending',
 *     mode            text default 'deep',
 *     model_config_id text,
 *     vm_root_dir     text,
 *     todo_list       jsonb not null default '[]'::jsonb,
 *     events          jsonb not null default '[]'::jsonb,
 *     created_at      bigint not null,
 *     updated_at      bigint not null
 *   );
 *
 * RLS: row owner = auth.uid() = user_id (see plan §6.2).
 *
 * The implementation here is the bare minimum that compiles; it intentionally
 * throws when invoked so the operator must opt-in via env before any code
 * path touches Supabase.
 */
import type { ScienceSession, SessionStorage } from "../../core/deepagent/sessions.js";

export class SupabaseSessionStorage implements SessionStorage {
  constructor(private readonly tableName: string = "agent_sessions") {}

  async create(_session: ScienceSession): Promise<void> {
    throw new Error("[SupabaseSessionStorage] not implemented yet — see adapters/supabase/README.md");
  }

  async get(_sessionId: string): Promise<ScienceSession | null> {
    throw new Error("[SupabaseSessionStorage] not implemented yet — see adapters/supabase/README.md");
  }

  async list(): Promise<ScienceSession[]> {
    throw new Error("[SupabaseSessionStorage] not implemented yet — see adapters/supabase/README.md");
  }

  async update(_session: ScienceSession): Promise<void> {
    throw new Error("[SupabaseSessionStorage] not implemented yet — see adapters/supabase/README.md");
  }

  async delete(_sessionId: string): Promise<void> {
    throw new Error("[SupabaseSessionStorage] not implemented yet — see adapters/supabase/README.md");
  }
}
