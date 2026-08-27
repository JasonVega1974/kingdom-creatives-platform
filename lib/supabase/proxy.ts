import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

/**
 * ============================================================
 * SESSION REFRESH - runs inside proxy.ts
 * ============================================================
 *
 * Supabase access tokens are short-lived. Server Components cannot set
 * cookies, so lib/supabase/server.ts swallows the write in a try/catch - which
 * means nothing anywhere else in the app is able to persist a refreshed token.
 * Without this module a pastor gets signed out mid-edit and the catch stays
 * silent about why. This closes FAST_FOLLOW FF-06.
 *
 * The proxy is the one place that sees both the request and the response, so
 * it is the only place a rotated cookie can be written back to the browser.
 *
 * Kept out of lib/tenant.ts on purpose: that module is imported by proxy.ts
 * and must stay free of supabase-js so the edge bundle stays small. This file
 * is imported by proxy.ts too, but only @supabase/ssr, which is edge-safe.
 */

/**
 * Refresh the session and copy any rotated auth cookies onto `response`.
 *
 * Returns the user id when there is a valid session, otherwise null. Callers
 * use it for routing decisions only - never for authorization. Authorization
 * is re-checked server-side in lib/portal/auth.ts against RLS-backed queries,
 * because a header set here is still just a header.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Missing config is a deployment problem. Do not pretend the user is signed
  // out - let the page-level check produce the real error.
  if (!url || !anonKey) return null;

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          // Both sides: the request copy so anything later in this same
          // request sees the new token, and the response so the browser
          // keeps it for the next one.
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    // getUser(), not getSession(): getSession() trusts the cookie payload
    // without contacting the auth server, so it will happily report a user
    // for a forged or expired token. getUser() verifies.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user?.id ?? null;
  } catch {
    // A network blip talking to the auth server is not proof of signed-out.
    // Return null and let the page-level check decide; it fails closed.
    return null;
  }
}
