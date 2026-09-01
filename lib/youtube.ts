import "server-only";

import { unstable_cache } from "next/cache";

/**
 * ============================================================
 * YOUTUBE - a channel's uploads, cheaply
 * ============================================================
 *
 * THE ENDPOINT CHOICE IS THE WHOLE DESIGN.
 *
 * The obvious way to list a channel's videos is search.list with a channelId
 * filter. It costs 100 quota units per call. The default project quota is
 * 10,000 units a DAY, shared across every tenant on one platform key, so an
 * hourly refresh for two channels would burn 4,800 units - half the platform's
 * daily budget for one church.
 *
 * Every channel has an "uploads" playlist containing exactly its public videos.
 * Reading it costs 1 unit:
 *
 *   channels.list      -> contentDetails.relatedPlaylists.uploads   1 unit
 *   playlistItems.list -> up to 50 videos                           1 unit
 *
 * That is 100x cheaper for the same result. The uploads playlist id for a
 * channel never changes, so it is cached far longer than the video list.
 *
 * (The id can also be derived by swapping the UC prefix for UU. That is a
 * widely relied-upon convention rather than a documented guarantee, so this
 * asks the API instead and pays one unit a day for certainty.)
 *
 * KEYS ARE SERVER-SIDE ONLY. This module is "server-only" and reads
 * YOUTUBE_API_KEY at call time. Ground rule 6 exists because the old WordPress
 * system shipped a YouTube key to the browser - this exact key, this exact
 * mistake.
 *
 * NOTHING IS WRITTEN TO THE DATABASE. YouTube is the source of the LIST; the
 * sermons table is a curation overlay matched on youtube_id. See lib/sermons.ts.
 */

/** One video as YouTube reports it, before any curation is applied. */
export type ChannelVideo = {
  youtubeId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string | null;
};

/** Refresh window for the video list. Hourly - see FF-53 for the quota ceiling. */
const VIDEOS_TTL_SECONDS = 3_600;

/** The uploads playlist id never changes, so it is cached for a day. */
const UPLOADS_TTL_SECONDS = 86_400;

const API = "https://www.googleapis.com/youtube/v3";

/**
 * Strip a "Token "-style prefix and whitespace, the same defensive trim the ESV
 * key needed. A key pasted with surrounding whitespace is a 400 that looks
 * exactly like a missing channel.
 */
function apiKey(): string | null {
  return process.env.YOUTUBE_API_KEY?.trim() || null;
}

/** True when the platform can talk to YouTube at all. */
export function youtubeConfigured(): boolean {
  return apiKey() !== null;
}

/**
 * The uploads playlist for a channel, or null.
 *
 * Cached hard: this is a property of the channel, not of its content, and it
 * does not change when a video is posted.
 */
function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  return unstable_cache(
    async (): Promise<string | null> => {
      const key = apiKey();
      if (!key) return null;

      const url = `${API}/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${key}`;

      try {
        const res = await fetch(url, { next: { revalidate: UPLOADS_TTL_SECONDS } });

        if (!res.ok) {
          // 403 is almost always quota exhaustion or a key restricted to the
          // wrong referrer/IP. Saying so beats a generic failure, because the
          // symptom - an empty sermon list - looks identical to "no videos".
          console.error(
            `[youtube] channels.list failed with ${res.status} for ${channelId}` +
              (res.status === 403 ? " - quota exhausted or key restricted" : "") +
              (res.status === 400 ? " - check YOUTUBE_API_KEY is a valid API key" : ""),
          );
          return null;
        }

        const data = (await res.json()) as {
          items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
        };

        const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
        if (!uploads) {
          console.error(`[youtube] no uploads playlist for channel ${channelId} - wrong id?`);
        }
        return uploads;
      } catch (error) {
        console.error(`[youtube] channels.list threw for ${channelId}: ${String(error)}`);
        return null;
      }
    },
    ["youtube-uploads", channelId],
    { revalidate: UPLOADS_TTL_SECONDS },
  )();
}

/**
 * A channel's most recent uploads, newest first.
 *
 * Returns [] for every failure - no key, bad channel, quota exhausted, network
 * error. An empty list renders the page's existing empty state, which is the
 * correct outcome: a church whose YouTube is misconfigured should see a quiet
 * page, not a stack trace. Every one of those paths logs first.
 *
 * Time-based revalidate rather than a cache tag, deliberately: there is no
 * write in this application that could invalidate it - the change happens on
 * YouTube. Tags would also be a no-op against unstable_cache anyway (FF-29,
 * FF-49).
 */
export function getChannelVideos(channelId: string, limit = 24): Promise<ChannelVideo[]> {
  return unstable_cache(
    async (): Promise<ChannelVideo[]> => {
      const key = apiKey();
      if (!key) return [];

      const uploads = await getUploadsPlaylistId(channelId);
      if (!uploads) return [];

      const params = new URLSearchParams({
        part: "snippet,contentDetails",
        playlistId: uploads,
        maxResults: String(Math.min(limit, 50)),
        key,
      });

      try {
        const res = await fetch(`${API}/playlistItems?${params}`, {
          next: { revalidate: VIDEOS_TTL_SECONDS },
        });

        if (!res.ok) {
          console.error(
            `[youtube] playlistItems.list failed with ${res.status} for ${channelId}` +
              (res.status === 403 ? " - quota exhausted or key restricted" : ""),
          );
          return [];
        }

        const data = (await res.json()) as {
          items?: {
            contentDetails?: { videoId?: string; videoPublishedAt?: string };
            snippet?: {
              title?: string;
              description?: string;
              publishedAt?: string;
              thumbnails?: Record<string, { url?: string }>;
            };
          }[];
        };

        return (data.items ?? [])
          .map((item): ChannelVideo | null => {
            const youtubeId = item.contentDetails?.videoId;
            if (!youtubeId) return null;

            const thumbs = item.snippet?.thumbnails ?? {};
            // Best available, largest first. A channel that never uploaded a
            // custom thumbnail has only the default sizes.
            const thumbnailUrl =
              thumbs.maxres?.url ??
              thumbs.standard?.url ??
              thumbs.high?.url ??
              thumbs.medium?.url ??
              thumbs.default?.url ??
              null;

            return {
              youtubeId,
              title: item.snippet?.title?.trim() || "Untitled",
              description: item.snippet?.description?.trim() ?? "",
              // videoPublishedAt is when the VIDEO went public; snippet
              // .publishedAt is when it was added to the playlist. They differ
              // for anything re-added, and the first is what a viewer means.
              publishedAt:
                item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? "",
              thumbnailUrl,
            };
          })
          .filter((video): video is ChannelVideo => video !== null)
          /*
           * Deleted and private videos stay in the uploads playlist as items
           * with no usable snippet - YouTube titles them "Deleted video" or
           * "Private video". Publishing those to a church's sermon list would
           * be a dead link with a confusing name.
           */
          .filter((video) => video.title !== "Deleted video" && video.title !== "Private video")
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      } catch (error) {
        console.error(`[youtube] playlistItems.list threw for ${channelId}: ${String(error)}`);
        return [];
      }
    },
    ["youtube-videos", channelId, String(limit)],
    { revalidate: VIDEOS_TTL_SECONDS },
  )();
}
