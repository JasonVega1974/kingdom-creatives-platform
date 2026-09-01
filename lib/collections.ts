import "server-only";

import { unstable_cache } from "next/cache";

import { churchTag } from "@/lib/church";
import { createPublicClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * ============================================================
 * PUBLIC COLLECTIONS - staff, groups, events, sermons, videos, ministries
 * ============================================================
 *
 * The rows behind the list pages. Cached and tagged like every other public
 * read so a portal edit shows up on the next request.
 *
 * THREE VISIBILITY CONVENTIONS. This schema does not agree with itself about
 * how a row is marked publishable, and each query below has to match its own
 * table:
 *
 *   staff, groups, ministries   visible  boolean
 *   events, videos              published boolean
 *   sermons                     status   text ('draft | published | archived')
 *
 * Filtering here is DEFENCE IN DEPTH, not the boundary. RLS is the boundary,
 * and it has to be right independently - a query that forgets a filter must
 * still not leak. Both layers apply the same rule on purpose. FF-25 and FF-31
 * are both cases where the policy was wrong and only the query was holding.
 *
 * SORTING. Each table carries its own idea of order: an explicit sort_order
 * where a pastor arranges the list by hand, a date where chronology is the
 * point. Neither is universal, so there is no shared helper.
 */

type Tables = Database["public"]["Tables"];

/**
 * A staff row plus the library photo it points at.
 *
 * The embed rides the composite FK from draft 23. FF-40 sets the precedence:
 * `church_media` wins, `photo_url` is the fallback for a hand-pasted link.
 */
export type StaffMember = Pick<
  Tables["staff"]["Row"],
  "id" | "name" | "role_title" | "bio" | "photo_url" | "email"
> & { church_media: { storage_path: string; alt_text: string | null } | null };

export type Group = Pick<
  Tables["groups"]["Row"],
  | "id"
  | "name"
  | "description"
  | "leader_name"
  | "meeting_day"
  | "meeting_time"
  | "meeting_tz"
  | "frequency"
  | "location_type"
  | "location_detail"
  | "meeting_link"
>;

export type ChurchEvent = { church_media: { storage_path: string; alt_text: string | null } | null } & Pick<
  Tables["events"]["Row"],
  | "id"
  | "title"
  | "description"
  | "starts_at"
  | "ends_at"
  | "location"
  | "event_type"
  | "image_url"
  | "registration_url"
>;

export type Sermon = Pick<
  Tables["sermons"]["Row"],
  | "id"
  | "title"
  | "summary"
  | "series"
  | "scripture_ref"
  | "preached_at"
  | "duration_min"
  | "youtube_id"
  | "thumbnail_url"
>;

export type Video = Pick<
  Tables["videos"]["Row"],
  | "id"
  | "title"
  | "description"
  | "category"
  | "video_url"
  | "youtube_id"
  | "thumbnail_url"
  | "duration_min"
>;

export type Announcement = Pick<
  Tables["announcements"]["Row"],
  "id" | "body" | "created_at" | "expires_at"
>;

export type PrayerRequest = Pick<
  Tables["prayer_requests"]["Row"],
  "id" | "body" | "display_name" | "prayed_count" | "created_at"
>;

export type Ministry = Pick<
  Tables["ministries"]["Row"],
  "id" | "name" | "description" | "logo_url" | "website_url"
>;

/** Everything one page needs, fetched together. */
export type Collections = {
  staff: StaffMember[];
  groups: Group[];
  events: ChurchEvent[];
  sermons: Sermon[];
  videos: Video[];
  ministries: Ministry[];
  announcements: Announcement[];
  prayer: PrayerRequest[];
};

/**
 * A collection read that treats an error as fatal and an empty result as real.
 *
 * Same rule as getChurchSite() and getPageSections(): throw rather than return
 * [], because unstable_cache does not store a rejected promise. Caching a
 * failed lookup as "this church has no sermons" would blank the page for the
 * whole revalidate window, and a visitor cannot tell the two apart.
 */
function cached<T>(
  keyParts: string[],
  slug: string,
  what: string,
  // PromiseLike, not Promise: a PostgrestFilterBuilder is thenable but is not
  // a Promise, so requiring one here rejects every call site.
  run: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  return unstable_cache(
    async () => {
      const { data, error } = await run();
      if (error) {
        throw new Error(`${what} lookup failed for "${slug}": ${error.message}`);
      }
      return data ?? [];
    },
    keyParts,
    { tags: [churchTag(slug)], revalidate: 60 },
  )();
}

export function getStaff(slug: string, churchId: string): Promise<StaffMember[]> {
  return cached(["staff", slug], slug, "staff", () =>
    createPublicClient()
      .from("staff")
      .select(
        "id, name, role_title, bio, photo_url, email, church_media(storage_path, alt_text)",
      )
      .eq("church_id", churchId)
      .eq("visible", true)
      .order("sort_order", { ascending: true }),
  );
}

export function getGroups(slug: string, churchId: string): Promise<Group[]> {
  return cached(["groups", slug], slug, "groups", () =>
    createPublicClient()
      .from("groups")
      .select(
        "id, name, description, leader_name, meeting_day, meeting_time, meeting_tz, frequency, location_type, location_detail, meeting_link",
      )
      .eq("church_id", churchId)
      .eq("visible", true)
      .order("sort_order", { ascending: true }),
  );
}

/**
 * Upcoming events only, soonest first.
 *
 * A church's events page is a "what is coming up" list, not an archive - a
 * past event still listed reads as a site nobody maintains. `ends_at` is
 * preferred so an event running today stays listed until it actually finishes;
 * a single-moment event falls back to `starts_at`.
 */
export function getEvents(slug: string, churchId: string): Promise<ChurchEvent[]> {
  const now = new Date().toISOString();

  return cached(["events", slug], slug, "events", () =>
    createPublicClient()
      .from("events")
      .select(
        "id, title, description, starts_at, ends_at, location, event_type, image_url, registration_url, church_media(storage_path, alt_text)",
      )
      .eq("church_id", churchId)
      .eq("published", true)
      .or(`ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${now})`)
      .order("starts_at", { ascending: true }),
  );
}

/**
 * Published sermons, newest first.
 *
 * 'archived' is excluded. Per the column comment the values are
 * 'draft | published | archived', and whether an archived sermon should stay
 * publicly readable is an open question - see draft 20. Excluding it is the
 * reversible direction.
 */
export function getSermons(slug: string, churchId: string): Promise<Sermon[]> {
  return cached(["sermons", slug], slug, "sermons", () =>
    createPublicClient()
      .from("sermons")
      .select(
        "id, title, summary, series, scripture_ref, preached_at, duration_min, youtube_id, thumbnail_url",
      )
      .eq("church_id", churchId)
      .eq("status", "published")
      .order("preached_at", { ascending: false, nullsFirst: false }),
  );
}

export function getVideos(slug: string, churchId: string): Promise<Video[]> {
  return cached(["videos", slug], slug, "videos", () =>
    createPublicClient()
      .from("videos")
      .select(
        "id, title, description, category, video_url, youtube_id, thumbnail_url, duration_min",
      )
      .eq("church_id", churchId)
      // Also enforced by the public RLS policy since draft 14 (FF-25). Kept
      // here as defence in depth - before that draft ran, this line was the
      // only thing holding it, which is exactly why it is not the boundary.
      .eq("published", true)
      .order("sort_order", { ascending: true }),
  );
}

/**
 * Announcements still worth showing.
 *
 * `expires_at` is honoured here rather than left to the pastor to tidy up: a
 * bulletin board carrying last month's notice is worse than an empty one. A
 * null expiry means "until I take it down".
 */
export function getAnnouncements(slug: string, churchId: string): Promise<Announcement[]> {
  const now = new Date().toISOString();

  return cached(["announcements", slug], slug, "announcements", () =>
    createPublicClient()
      .from("announcements")
      .select("id, body, created_at, expires_at")
      .eq("church_id", churchId)
      .eq("visible", true)
      .or(`expires_at.is.null,expires_at.gte.${now}`)
      .order("sort_order", { ascending: true }),
  );
}

/**
 * The prayer wall - approved requests only.
 *
 * `status = 'approved'` is also what the RLS policy enforces, so this filter is
 * defence in depth rather than the boundary. A pending request must never
 * appear: it has been submitted but not read by a person yet, and the seed
 * promises exactly that ("Requests are read by a person before they appear
 * here").
 */
export function getPrayerRequests(slug: string, churchId: string): Promise<PrayerRequest[]> {
  return cached(["prayer", slug], slug, "prayer requests", () =>
    createPublicClient()
      .from("prayer_requests")
      .select("id, body, display_name, prayed_count, created_at")
      .eq("church_id", churchId)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
  );
}

export function getMinistries(slug: string, churchId: string): Promise<Ministry[]> {
  return cached(["ministries", slug], slug, "ministries", () =>
    createPublicClient()
      .from("ministries")
      .select("id, name, description, logo_url, website_url")
      .eq("church_id", churchId)
      .eq("visible", true)
      .order("sort_order", { ascending: true }),
  );
}

/**
 * The collections one page needs, in parallel.
 *
 * Only what the page's sections actually consume - /about should not query
 * sermons. The caller passes the set; everything else comes back empty without
 * a round trip.
 */
export async function getCollectionsFor(
  slug: string,
  churchId: string,
  needed: Array<keyof Collections>,
): Promise<Collections> {
  const empty: Collections = {
    staff: [],
    groups: [],
    events: [],
    sermons: [],
    videos: [],
    ministries: [],
    announcements: [],
    prayer: [],
  };

  const fetchers: Record<keyof Collections, () => Promise<unknown[]>> = {
    staff: () => getStaff(slug, churchId),
    groups: () => getGroups(slug, churchId),
    events: () => getEvents(slug, churchId),
    sermons: () => getSermons(slug, churchId),
    videos: () => getVideos(slug, churchId),
    ministries: () => getMinistries(slug, churchId),
    announcements: () => getAnnouncements(slug, churchId),
    prayer: () => getPrayerRequests(slug, churchId),
  };

  const results = await Promise.all(needed.map((key) => fetchers[key]()));

  const out = { ...empty };
  needed.forEach((key, index) => {
    // Each fetcher returns its own row type; the key drives which field it
    // lands in, so the assertion is narrow and local rather than an `any`.
    (out[key] as unknown[]) = results[index];
  });

  return out;
}
