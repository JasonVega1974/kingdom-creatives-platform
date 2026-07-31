import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Server Supabase client bound to the request's auth cookies.
 * Anon key + the user's session - reads stay RLS-scoped.
 *
 * Use this in Server Components, Server Actions and Route Handlers.
 * For unauthenticated public-site reads prefer createPublicClient() below,
 * which skips the cookie plumbing and is safe to call inside cached functions.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, which cannot set cookies. Safe
            // to ignore only while there is no auth: proxy.ts does NOT yet
            // refresh the session. It must before Phase C login ships, or this
            // catch becomes silent session expiry - see FF-06.
          }
        },
      },
    },
  );
}

/**
 * Cookie-free anon client for public-site reads.
 *
 * Because it touches no request state it can be called from inside
 * unstable_cache()/"use cache" bodies, which a cookie-bound client cannot.
 * It has no session, so it only ever sees rows the anon RLS policies expose.
 */
export function createPublicClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: this client is intentionally session-less
        },
      },
    },
  );
}
