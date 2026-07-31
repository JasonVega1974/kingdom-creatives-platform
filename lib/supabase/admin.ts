import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Service-role client. BYPASSES RLS.
 *
 * Ground rule 0.6: this key never leaves the server. The "server-only" import
 * above turns any accidental client-side import into a build error.
 *
 * Legitimate uses (all later phases):
 *   - Stripe webhook writing to `gifts`
 *   - nightly YouTube sync upserting `sermons`
 *   - public contact/prayer submissions that need a scoped insert
 *
 * Anything a signed-in user could do under RLS must NOT use this client.
 * Always filter by church_id explicitly - there is no RLS safety net here.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set - admin client unavailable.",
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
