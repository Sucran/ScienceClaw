/**
 * Supabase client singletons.
 *
 * NOTE: `@supabase/supabase-js` is intentionally NOT a hard dependency in
 * Phase 1 — we keep this skeleton tree-shake friendly so the Mongo path
 * (the current default) does not require the Supabase SDK to be installed.
 *
 * To enable Supabase locally:
 *   1. `bun add @supabase/supabase-js`
 *   2. set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
 *   3. set `STORAGE_BACKEND=supabase`
 *
 * The dynamic import below means Bun only resolves the SDK when
 * `getSupabaseAdmin()` is actually called.
 */
type SupabaseClientLike = unknown;

let adminClient: SupabaseClientLike | null = null;

export async function getSupabaseAdmin(): Promise<SupabaseClientLike> {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "[Supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the Supabase adapter"
    );
  }

  // Lazy import keeps the dependency optional.
  const mod = await import("@supabase/supabase-js" as string).catch(() => {
    throw new Error(
      "[Supabase] @supabase/supabase-js is not installed. Run `bun add @supabase/supabase-js` to enable the Supabase adapter."
    );
  });

  const { createClient } = mod as { createClient: (url: string, key: string, opts?: unknown) => SupabaseClientLike };
  adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
