import Image from "next/image";

import type {
  ChurchEvent,
  Group,
  Ministry,
  Sermon,
  StaffMember,
  Video,
} from "@/lib/collections";

/**
 * ============================================================
 * COLLECTION LISTS - the rows behind the list pages
 * ============================================================
 *
 * Every list here takes its empty-state string from the seed rather than
 * hardcoding one. Draft 04 wrote a specific sentence per page - "No sermons
 * posted yet", "The crew page is being built" - and those are the pastor's
 * words, editable in the portal. A hardcoded fallback would quietly override
 * an edit nobody could then find.
 *
 * An empty collection is a normal state, not a failure: KC_MASTER_TODO section
 * C has the pastor and board still sending real material. These pages are
 * expected to render empty for a while.
 */

function EmptyState({ children }: { children: string }) {
  return (
    <p className="rounded-[var(--kc-radius)] border border-dashed border-line px-5 py-8 text-center text-ink-soft">
      {children}
    </p>
  );
}

/** Consistent, explicit locale - never the server's default. */
function formatDate(value: string | null, withTime = false): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

// ---------------------------------------------------------------

export function StaffGrid({ staff, empty }: { staff: StaffMember[]; empty: string }) {
  if (staff.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {staff.map((person) => (
        <li
          key={person.id}
          className="rounded-[var(--kc-radius)] border border-line bg-surface p-5"
        >
          {person.photo_url ? (
            <Image
              src={person.photo_url}
              alt=""
              width={96}
              height={96}
              className="mb-4 h-24 w-24 rounded-full object-cover"
            />
          ) : null}

          <h3 className="text-lg text-ink">{person.name}</h3>
          {person.role_title ? (
            <p className="font-utility text-xs uppercase tracking-[0.14em] text-brand">
              {person.role_title}
            </p>
          ) : null}
          {person.bio ? <p className="mt-3 text-sm text-ink-soft">{person.bio}</p> : null}
          {person.email ? (
            <a
              href={`mailto:${person.email}`}
              className="mt-3 inline-block text-sm text-brand underline underline-offset-4"
            >
              {person.email}
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function GroupList({
  groups,
  empty,
  linkLabel,
}: {
  groups: Group[];
  empty: string;
  linkLabel: string;
}) {
  if (groups.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {groups.map((group) => {
        // "Tuesdays - 7:00 PM CT", skipping whatever is missing.
        const when = [group.meeting_day, group.meeting_time, group.meeting_tz]
          .filter(Boolean)
          .join(" - ");
        const where = group.location_detail ?? group.location_type;

        return (
          <li
            key={group.id}
            className="rounded-[var(--kc-radius)] border border-line bg-surface p-5"
          >
            <h3 className="text-lg text-ink">{group.name}</h3>
            {group.leader_name ? (
              <p className="font-utility text-xs uppercase tracking-[0.14em] text-brand">
                {group.leader_name}
              </p>
            ) : null}
            {group.description ? (
              <p className="mt-3 text-sm text-ink-soft">{group.description}</p>
            ) : null}

            <dl className="mt-4 space-y-1 font-utility text-xs text-ink-soft">
              {when ? (
                <div className="flex gap-2">
                  <dt className="sr-only">Meets</dt>
                  <dd>{when}</dd>
                </div>
              ) : null}
              {where ? (
                <div className="flex gap-2">
                  <dt className="sr-only">Where</dt>
                  <dd>{where}</dd>
                </div>
              ) : null}
            </dl>

            {group.meeting_link ? (
              <a
                href={group.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm text-brand underline underline-offset-4"
              >
                {linkLabel}
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function EventList({ events, empty }: { events: ChurchEvent[]; empty: string }) {
  if (events.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <ul className="divide-y divide-line border-y border-line">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap gap-x-8 gap-y-3 py-6">
          <div className="w-32 shrink-0">
            <time
              dateTime={event.starts_at}
              className="font-utility text-sm text-brand"
            >
              {formatDate(event.starts_at, true)}
            </time>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-lg text-ink">{event.title}</h3>
            {event.location ? (
              <p className="font-utility text-xs uppercase tracking-[0.14em] text-ink-soft">
                {event.location}
              </p>
            ) : null}
            {event.description ? (
              <p className="mt-2 max-w-[62ch] text-sm text-ink-soft">{event.description}</p>
            ) : null}
            {event.registration_url ? (
              <a
                href={event.registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-brand underline underline-offset-4"
              >
                Register
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SermonList({
  sermons,
  empty,
  watchLabel,
}: {
  sermons: Sermon[];
  empty: string;
  watchLabel: string;
}) {
  if (sermons.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {sermons.map((sermon) => (
        <li
          key={sermon.id}
          className="overflow-hidden rounded-[var(--kc-radius)] border border-line bg-surface"
        >
          <Thumbnail
            youtubeId={sermon.youtube_id}
            thumbnailUrl={sermon.thumbnail_url}
            title={sermon.title}
          />

          <div className="p-5">
            {sermon.series ? (
              <p className="font-utility text-[11px] uppercase tracking-[0.16em] text-brand">
                {sermon.series}
              </p>
            ) : null}
            <h3 className="mt-1 text-lg text-ink">{sermon.title}</h3>

            <p className="mt-1 font-utility text-xs text-ink-soft">
              {[
                formatDate(sermon.preached_at),
                sermon.scripture_ref,
                sermon.duration_min ? `${sermon.duration_min} min` : null,
              ]
                .filter(Boolean)
                .join(" - ")}
            </p>

            {sermon.summary ? (
              <p className="mt-3 text-sm text-ink-soft">{sermon.summary}</p>
            ) : null}

            {sermon.youtube_id ? (
              <a
                href={`https://www.youtube.com/watch?v=${sermon.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm text-brand underline underline-offset-4"
              >
                {watchLabel}
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function VideoGrid({
  videos,
  empty,
  playLabel,
}: {
  videos: Video[];
  empty: string;
  playLabel: string;
}) {
  if (videos.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => (
        <li
          key={video.id}
          className="overflow-hidden rounded-[var(--kc-radius)] border border-line bg-surface"
        >
          <Thumbnail
            youtubeId={video.youtube_id}
            thumbnailUrl={video.thumbnail_url}
            title={video.title}
          />

          <div className="p-5">
            {video.category ? (
              <p className="font-utility text-[11px] uppercase tracking-[0.16em] text-brand">
                {video.category}
              </p>
            ) : null}
            <h3 className="mt-1 text-lg text-ink">{video.title}</h3>
            {video.description ? (
              <p className="mt-2 text-sm text-ink-soft">{video.description}</p>
            ) : null}

            <a
              href={video.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm text-brand underline underline-offset-4"
            >
              {playLabel}
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MinistryList({
  ministries,
  empty,
}: {
  ministries: Ministry[];
  empty: string;
}) {
  if (ministries.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <ul className="grid gap-5 md:grid-cols-3">
      {ministries.map((ministry) => (
        <li
          key={ministry.id}
          className="rounded-[var(--kc-radius)] border border-line bg-surface p-5"
        >
          <h3 className="text-lg text-ink">{ministry.name}</h3>
          {ministry.description ? (
            <p className="mt-2 text-sm text-ink-soft">{ministry.description}</p>
          ) : null}
          {ministry.website_url ? (
            <a
              href={ministry.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-brand underline underline-offset-4"
            >
              Visit site
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Poster frame for a sermon or worship video.
 *
 * A stored thumbnail wins; otherwise YouTube's own still, which needs no API
 * key and no request from our side. Both hosts are allow-listed in
 * next.config.ts - an image from anywhere else would fail the loader, which is
 * the intended behaviour rather than something to work around.
 *
 * Renders a plain tinted block when there is neither, so the card keeps its
 * shape instead of collapsing.
 */
function Thumbnail({
  youtubeId,
  thumbnailUrl,
  title,
}: {
  youtubeId: string | null;
  thumbnailUrl: string | null;
  title: string;
}) {
  const src =
    thumbnailUrl ??
    (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null);

  if (!src) return <div aria-hidden="true" className="aspect-video bg-brand-wash" />;

  return (
    <Image
      src={src}
      alt={title}
      width={480}
      height={270}
      className="aspect-video w-full object-cover"
    />
  );
}
