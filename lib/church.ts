import { cache } from "react";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/server";
import { CHURCH_HOST_HEADER, CHURCH_ID_HEADER, CHURCH_SLUG_HEADER } from "@/lib/tenant";
import type { Database } from "@/types/database";

export type Church = Database["public"]["Tables"]["churches"]["Row"];
/**
 * The theme row, plus the library logo it points at.
 *
 * FF-40 precedence: `church_media` wins, `logo_url` is the fallback for a link
 * pasted before the Photos tab existed.
 */
export type ChurchTheme = Database["public"]["Tables"]["church_theme"]["Row"] & {
  church_media?: { storage_path: string; alt_text: string | null } | null;
};

export type ChurchSite = {
  church: Church;
  theme: ChurchTheme | null;
};

/** Service time as stored in churches.service_times (jsonb array). */
export type ServiceTime = {
  day?: string;
  time?: string;
  tz?: string;
  label?: string;
  streaming?: boolean;
};

/**
 * Cache tag for one church's public content.
 *
 * Portal saves (Phase C) call revalidateTag(churchTag(slug)) so an edit shows
 * on the live site within a second instead of waiting out the TTL.
 */
export function churchTag(slug: string): string {
  return `church:${slug}`;
}

/**
 * Church + theme for a slug, cached across requests and tagged for
 * on-demand revalidation.
 *
 * Uses the session-less public client: cached function bodies must not read
 * cookies, and public site content is anon-readable by design.
 */
export function getChurchSite(slug: string): Promise<ChurchSite | null> {
  return unstable_cache(
    async (): Promise<ChurchSite | null> => {
      const supabase = createPublicClient();

      const { data: church, error } = await supabase
        .from("churches")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      // A failed query is not evidence that the church does not exist. Throw
      // rather than return null: unstable_cache does not store a rejected
      // promise, so a blip stays scoped to this request instead of 404ing the
      // church for the whole revalidate window. Only a successful empty result
      // is cached as "no such church".
      if (error) {
        throw new Error(`church lookup failed for "${slug}": ${error.message}`);
      }
      if (!church) return null;

      const { data: theme, error: themeError } = await supabase
        .from("church_theme")
        .select("*, church_media(storage_path, alt_text)")
        .eq("church_id", church.id)
        .maybeSingle();

      // Same rule one level down: a theme that failed to load is not a church
      // without a theme. Caching that would strip a church's branding for the
      // revalidate window. A church with genuinely no theme row is still fine.
      if (themeError) {
        throw new Error(`theme lookup failed for "${slug}": ${themeError.message}`);
      }

      return { church, theme: theme ?? null };
    },
    ["church-site", slug],
    { tags: [churchTag(slug)], revalidate: 60 },
  )();
}

/**
 * The tenant the proxy resolved for this request.
 *
 * Reads the headers the proxy stamped - never a client-supplied value.
 * Returns null when no church matched the hostname; callers render a 404.
 */
export const getCurrentTenant = cache(async () => {
  const h = await headers();
  const id = h.get(CHURCH_ID_HEADER);
  const slug = h.get(CHURCH_SLUG_HEADER);

  if (!id || !slug) return null;
  return { id, slug, host: h.get(CHURCH_HOST_HEADER) ?? "" };
});

/** Full church + theme for the current request's tenant, or null. */
export const getCurrentChurchSite = cache(async (): Promise<ChurchSite | null> => {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  const site = await getChurchSite(tenant.slug);

  // Defence in depth: the header must agree with what the DB returned.
  // If they disagree the proxy cache is stale - fail closed rather than
  // render one church's content under another's id.
  if (!site || site.church.id !== tenant.id) return null;

  return site;
});

/** churches.service_times is jsonb - narrow it without trusting its shape. */
export function parseServiceTimes(value: Church["service_times"]): ServiceTime[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (entry): entry is ServiceTime =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
}
