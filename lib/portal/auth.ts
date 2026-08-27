import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getCurrentChurchSite, type ChurchSite } from "@/lib/church";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * ============================================================
 * PORTAL ACCESS - who is allowed to edit this church
 * ============================================================
 *
 * Two questions, asked in this order, both server-side:
 *
 *   1. Is there a verified Supabase session?          -> else /portal/login
 *   2. Is that user a member of THIS request's church? -> else /portal/no-access
 *
 * Step 2 is what makes the portal multi-tenant-safe. The tenant comes from the
 * hostname (proxy.ts), never from the client, so signing in at
 * churchfortruckers.org/portal can only ever edit Church for Truckers - even
 * for a user who is a member of several churches.
 *
 * The membership row is fetched with the user's own session, so RLS is doing
 * the real work; this function is the readable expression of it, not the
 * enforcement. Never swap it for the service-role client.
 *
 * WHY NOT IN proxy.ts: a middleware redirect is a routing convenience that
 * runs before the request reaches any data access. Treating it as the boundary
 * means every new route has to remember to be listed in a matcher. Here, a
 * page that forgets to call requirePortalUser() still cannot read another
 * church's rows, because RLS refuses.
 */

export type Membership = Database["public"]["Tables"]["church_members"]["Row"];

export type PortalSession = {
  userId: string;
  email: string | null;
  site: ChurchSite;
  membership: Membership;
};

/**
 * The signed-in user's membership of the current church, or null.
 *
 * Returns null for every "no" - signed out, no tenant, not a member. Callers
 * that need to branch (a marketing page, a "request access" screen) use this;
 * callers that need a user use requirePortalUser() below.
 *
 * Wrapped in React cache() so the layout, the nav and the page all share one
 * round trip per request.
 */
export const getPortalSession = cache(async (): Promise<PortalSession | null> => {
  const site = await getCurrentChurchSite();
  if (!site) return null;

  const supabase = await createClient();

  // getUser(), not getSession() - the latter trusts the cookie without
  // verifying it against the auth server.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("church_members")
    .select("*")
    .eq("church_id", site.church.id)
    .eq("user_id", user.id)
    .maybeSingle();

  // A failed query is not a denial, but we have nothing safe to do with it
  // here: fail closed and let the caller send them to the login screen.
  // Surfacing it in logs matters more than the branch, since a silent deny
  // looks identical to "not a member" from the outside.
  if (membershipError) {
    console.error(
      `[portal] membership lookup failed for user ${user.id} / church ${site.church.slug}: ${membershipError.message}`,
    );
    return null;
  }

  if (!membership) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    site,
    membership,
  };
});

/**
 * Same as getPortalSession(), but redirects instead of returning null.
 *
 * Every portal page and every portal Server Action starts with this. Actions
 * must call it too - a layout check protects the render, not the mutation.
 */
export async function requirePortalUser(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (session) return session;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed in but not a member of this church: a different screen from signed
  // out. Sending them to /portal/login would loop - they are already logged in.
  if (user) redirect("/portal/no-access");

  redirect("/portal/login");
}
