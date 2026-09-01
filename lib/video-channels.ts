import type { ChurchLink } from "@/lib/links";

/**
 * ============================================================
 * CHANNEL SELECTORS - pure, and deliberately not server-only
 * ============================================================
 *
 * These are `filter` calls over rows that have already been fetched. They touch
 * no key, no database and no request, so marking them server-only would buy
 * nothing and cost something real: the site header imports sermonChannels() to
 * build its Watch menu, and pulling a server-only module into a presentational
 * component makes it untestable outside a Next request and couples it to the
 * server graph for no reason.
 *
 * lib/links.ts re-exports these so existing callers are unaffected. The type
 * import above is erased at compile time, so nothing server-only is pulled in
 * at runtime.
 */

/** One selectable channel, as the Watch menu and /sermons filter use it. */
export type SermonChannel = {
  /** The UC... id. Per-church data - never a constant in shared code. */
  id: string;
  label: string;
};

/**
 * The church's video channels, in the order the pastor arranged them.
 *
 * CFT has two - Preaching and Bible Studies - which is the reason church_links
 * exists at all: churches.youtube_channel_id cannot hold both.
 */
export function videoChannels(links: ChurchLink[]): ChurchLink[] {
  return links.filter((link) => link.kind === "video");
}

/**
 * Social profiles for the footer.
 *
 * Deliberately separate from videoChannels(). A church's YouTube channel is
 * both a social presence and where its sermons live, and conflating the two
 * would put every video channel in the footer - for CFT that is two identical
 * YouTube glyphs distinguishable only by hovering.
 */
export function socialLinks(links: ChurchLink[]): ChurchLink[] {
  return links.filter((link) => link.kind === "social");
}

/**
 * The single video channel that belongs in the footer's icon row, or null.
 *
 * The primary one. The others are not hidden - they are named in the Explore
 * list and in the Watch menu, where there is room to say what they are.
 */
export function footerVideo(links: ChurchLink[]): ChurchLink | null {
  const videos = videoChannels(links);
  return videos.find((link) => link.is_primary) ?? videos[0] ?? null;
}

/**
 * Channels usable by the YouTube Data API, with their labels.
 *
 * THE "UC" TEST IS THE WHOLE POINT and lives only here. external_id must hold a
 * channel id; a row still carrying an @handle is skipped rather than sent to an
 * API that 400s on handles. Before migration 29 every row was a handle, so this
 * returned [] and the site fell back to the sermons table - which is exactly
 * what a church that has not configured a channel should get.
 */
export function sermonChannels(links: ChurchLink[]): SermonChannel[] {
  return videoChannels(links)
    .filter((link) => link.external_id?.startsWith("UC"))
    .map((link) => ({ id: link.external_id as string, label: link.label ?? "Videos" }));
}
