import "server-only";

import { unstable_cache } from "next/cache";

import { churchTag } from "@/lib/church";
import { createPublicClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * ============================================================
 * CHURCH LINKS - social, video and giving destinations
 * ============================================================
 *
 * `church_links` (migration 09, seeded by 10) is the multi-valued replacement
 * for the single-value columns on `churches`. CFT has two YouTube channels,
 * which is why the table exists at all - `churches.youtube_channel_id` cannot
 * hold both.
 *
 * DECIDED 2026-08-28: the Give button reads `kind = 'giving'` from here, not
 * `churches.giving_url`. Draft 07 would have set that column and is marked
 * WON'T RUN - superseded. Two homes for one fact is how they drift apart. See
 * PORTAL_SPEC section 2.3.
 *
 * Cached and tagged like the other public reads, so a portal edit shows up on
 * the next request rather than waiting out the TTL.
 */

export type ChurchLink = Pick<
  Database["public"]["Tables"]["church_links"]["Row"],
  "id" | "kind" | "platform" | "label" | "url" | "external_id" | "is_primary" | "sort_order"
>;

/** Every link for a church, ordered as the portal arranged them. */
export function getChurchLinks(slug: string, churchId: string): Promise<ChurchLink[]> {
  return unstable_cache(
    async (): Promise<ChurchLink[]> => {
      const supabase = createPublicClient();

      const { data, error } = await supabase
        .from("church_links")
        .select("id, kind, platform, label, url, external_id, is_primary, sort_order")
        .eq("church_id", churchId)
        .order("kind", { ascending: true })
        .order("sort_order", { ascending: true });

      // Same rule as getChurchSite() and getPageSections(): throw rather than
      // return [], so a failed lookup is not cached as "this church has no
      // links" for the whole revalidate window.
      if (error) {
        throw new Error(`link lookup failed for "${slug}": ${error.message}`);
      }

      return data ?? [];
    },
    ["church-links", slug],
    { tags: [churchTag(slug)], revalidate: 60 },
  )();
}

/**
 * Where a Give button points, or null when the church has not set one up.
 *
 * Prefers the row the pastor marked primary - a church may have both a Tithe.ly
 * form and a PayPal fallback, and only one belongs on a button. Falls back to
 * the first giving link by sort order.
 *
 * Null is a real answer, not an error: a church mid-setup has no giving link,
 * and a Give button pointing nowhere is worse than no button.
 */
export function givingLink(links: ChurchLink[]): ChurchLink | null {
  const giving = links.filter((link) => link.kind === "giving");
  return giving.find((link) => link.is_primary) ?? giving[0] ?? null;
}

/**
 * The church's video channels, in the order the pastor arranged them.
 *
 * CFT has two - Preaching and Bible Studies - which is the reason church_links
 * exists at all: churches.youtube_channel_id cannot hold both. They are
 * rendered on the Worship page as labelled destinations, because the label is
 * the whole point. Two bare YouTube URLs tell a visitor nothing about which one
 * is the Sunday service and which is the midweek study.
 */
export function videoChannels(links: ChurchLink[]): ChurchLink[] {
  return links.filter((link) => link.kind === "video");
}

/**
 * Social profiles for the footer.
 *
 * Deliberately separate from videoChannels(). A church's YouTube channel is
 * both a social presence and the place its sermons live, and conflating the two
 * would put every video channel in the footer - for CFT that is two identical
 * YouTube glyphs side by side, distinguishable only by hovering.
 *
 * The footer takes these plus ONE video channel, chosen by footerVideo().
 */
export function socialLinks(links: ChurchLink[]): ChurchLink[] {
  return links.filter((link) => link.kind === "social");
}

/**
 * The single video channel that belongs in the footer, or null.
 *
 * The primary one - for CFT that is Preaching, the main channel. The Bible
 * Studies channel is not omitted from the site; it has a labelled place on the
 * Worship page where there is room to say what it is.
 */
export function footerVideo(links: ChurchLink[]): ChurchLink | null {
  const videos = videoChannels(links);
  return videos.find((link) => link.is_primary) ?? videos[0] ?? null;
}
