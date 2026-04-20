# Supabase Adapter (Tier 1 Skeleton)

This folder hosts the **Supabase** adapters that map `core/` ports to
Supabase services (Auth / Postgres / Storage). It is **disabled by default**
and only enabled when `STORAGE_BACKEND=supabase` is set.

The skeleton currently provides:

- `client.ts` — singleton helpers for the anon and service-role Supabase clients
- `session-storage.ts` — `SessionStorage` impl backed by the `agent_sessions`
  table (matches the schema in the three-layer plan)

> Phase 1 ships the **interface** only; the SQL migrations, RLS policies,
> Storage adapter and Auth wiring described in
> `.cursor/docs/backend-js-three-layer-supabase.md` will be added in
> follow-up commits. Until then `STORAGE_BACKEND=mongo` (the default)
> remains the working configuration.
