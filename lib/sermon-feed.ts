import "server-only";

import type { Sermon } from "@/lib/collections";
import type { ChurchLink } from "@/lib/links";
import { videoChannels } from "@/lib/links";
import { getChannelVideos, youtubeConfigured } from "@/lib/youtube";

/**
 * ============================================================
 * THE SERMON FEED - YouTube is the list, the database is the curation
 * ============================================================
 *
 * WHY A MERGE AND NOT A SYNC
 *
 * The sermons table is not a cache of YouTube. It carries work nobody wants to
 * lose: series, scripture reference, summary, and a whole content pipeline of
 * devotional, kids_lesson, small_group_questions and slide_content. A job that
 * overwrote rows from YouTube would destroy that the first time it ran.
 *
 * So nothing is ever written. YouTube supplies the LIST of what exists; a
 * sermons row matched on youtube_id supplies the WORDS where a person has
 * written better ones. A video with no row still appears, titled as YouTube
 * titles it. A row whose video is gone from the channel still appears, because
 * a pastor's curated entry outliving a re-upload is better than it vanishing.
 *
 * FIELD BY FIELD, CURATION WINS WHERE IT EXISTS. Not row-wins-or-video-wins:
 * a row may have a good title and no summary, and the YouTube description is
 * better than nothing in that gap.
 *
 * DEGRADATION IS THE POINT. No key, no channels, quota exhausted, network
 * error - every one of those falls back to exactly the sermons table the site
 * showed before any of this existed. The site never gets worse than it is now.
 */

/** A sermon as the page renders it, whatever it was assembled from. */
export type FeedSermon = Sermon & {
  /** Which channel it came from, for the filter strip. Null for db-only rows. */
  channelId: string | null;
  channelLabel: string | null;
};

/** One selectable channel, derived from church_links - never hardcoded. */
export type SermonChannel = {
  /** The UC... id, used as the filter value. */
  id: string;
  label: string;
};

/**
 * The channels a church has configured, for the filter strip.
 *
 * Read from church_links rather than a constant: the ids are per-church data
 * and a second church will have different ones. A church with a single channel
 * gets a single entry and the page hides the strip; a church with none gets an
 * empty array and the page shows its empty state.
 *
 * external_id must hold the UC... channel id. Rows still carrying an @handle
 * are skipped rather than sent to the API, which would 400 on every request.
 */
export function sermonChannels(links: ChurchLink[]): SermonChannel[] {
  return videoChannels(links)
    .filter((link) => link.external_id?.startsWith("UC"))
    .map((link) => ({
      id: link.external_id as string,
      label: link.label ?? "Videos",
    }));
}

/**
 * The full feed: every channel's uploads, enriched by curated rows.
 *
 * `curated` is the sermons table as already loaded for the page, so this adds
 * no database round-trip of its own.
 */
export async function buildSermonFeed(
  links: ChurchLink[],
  curated: Sermon[],
): Promise<FeedSermon[]> {
  const channels = sermonChannels(links);

  // No channels configured, or no key: the database is the whole feed. This is
  // the site exactly as it behaved before auto-pull existed.
  if (channels.length === 0 || !youtubeConfigured()) {
    return curated.map((sermon) => ({ ...sermon, channelId: null, channelLabel: null }));
  }

  const byYoutubeId = new Map(
    curated.filter((sermon) => sermon.youtube_id).map((sermon) => [sermon.youtube_id, sermon]),
  );

  const perChannel = await Promise.all(
    channels.map(async (channel) => {
      const videos = await getChannelVideos(channel.id);
      return videos.map((video): FeedSermon => {
        const row = byYoutubeId.get(video.youtubeId);

        return {
          // A curated row keeps its own id so links to it stay stable; a
          // video-only entry is identified by its YouTube id.
          id: row?.id ?? `yt:${video.youtubeId}`,
          youtube_id: video.youtubeId,
          title: row?.title?.trim() || video.title,
          summary: row?.summary?.trim() || video.description.split("\n")[0] || null,
          series: row?.series ?? null,
          scripture_ref: row?.scripture_ref ?? null,
          duration_min: row?.duration_min ?? null,
          preached_at: row?.preached_at ?? (video.publishedAt.slice(0, 10) || null),
          thumbnail_url: row?.thumbnail_url ?? video.thumbnailUrl,
          channelId: channel.id,
          channelLabel: channel.label,
        } as FeedSermon;
      });
    }),
  );

  const feed = perChannel.flat();

  /*
   * Curated rows whose video is not in any channel's recent uploads.
   *
   * Keeping them matters: the uploads fetch is capped at 24 per channel, so
   * anything older falls out of the window. A sermon somebody wrote a study
   * guide for should not disappear from the archive because it aged out.
   */
  const seen = new Set(feed.map((item) => item.youtube_id));
  const orphans = curated
    .filter((sermon) => !sermon.youtube_id || !seen.has(sermon.youtube_id))
    .map((sermon) => ({ ...sermon, channelId: null, channelLabel: null }) as FeedSermon);

  return [...feed, ...orphans].sort((a, b) =>
    String(b.preached_at ?? "").localeCompare(String(a.preached_at ?? "")),
  );
}
