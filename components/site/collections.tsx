import Image from "next/image";

import type {
  ChurchEvent,
  Group,
  Ministry,
  Sermon,
  StaffMember,
  Video,
} from "@/lib/collections";
import { mediaUrl } from "@/lib/portal/media";

/**
 * ============================================================
 * COLLECTION LISTS - the rows behind the list pages
 * ============================================================
 *
 * Markup and class names are the prototype's; the styling lives in
 * app/(public)/site.css.
 *
 * Every list takes its empty-state string from the seed rather than hardcoding
 * one. Draft 04 wrote a specific sentence per page - "No sermons posted yet",
 * "The crew page is being built" - and those are the pastor's words, editable
 * in the portal. A hardcoded fallback would quietly override an edit nobody
 * could then find.
 *
 * An empty collection is a normal state, not a failure: KC_MASTER_TODO section
 * C has the pastor and board still sending real material.
 */

/**
 * The empty-state pattern from the Phase 0 direction: an icon in a brand-wash
 * ring and one honest sentence (which still comes from the seed, per the note
 * above - an empty collection is a normal state, not a failure). The icon
 * names what KIND of thing is missing, so a bare page still says what it is.
 */
const EMPTY_ICONS = {
  calendar: <path d="M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />,
  people: <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 3.6a4 4 0 1 0 0 7.8M21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  play: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM10 8l6 4-6 4V8z" />,
  hands: <path d="M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 7a5.5 5.5 0 0 1 9.5 5c-2.5 4.4-9.5 9-9.5 9z" />,
} as const;

function EmptyState({
  icon = "calendar",
  children,
}: {
  icon?: keyof typeof EMPTY_ICONS;
  children: string;
}) {
  return (
    <div className="empty-state">
      <span className="icon-ring" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {EMPTY_ICONS[icon]}
        </svg>
      </span>
      <p>{children}</p>
    </div>
  );
}

/** Consistent, explicit locale - never the server's default. */
function formatDate(value: string | null, withTime = false): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/** "Ray Delgado" -> "RD". The prototype's fallback when there is no photo. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------------------------------------------------------------

export function StaffGrid({ staff, empty }: { staff: StaffMember[]; empty: string }) {
  if (staff.length === 0) return <EmptyState icon="people">{empty}</EmptyState>;

  return (
    <div className="team-grid">
      {staff.map((person) => {
        const photo = person.church_media
          ? mediaUrl(person.church_media.storage_path)
          : null;

        return (
          <article key={person.id} className="person">
            <div className="person-photo">
              {/* FF-40 precedence: the library photo wins; photo_url is the
                  fallback for a link pasted before the Photos tab existed, and
                  is unoptimized because it can point at any host. With neither,
                  the prototype shows initials over the brand gradient. */}
              {photo ? (
                <Image
                  src={photo}
                  alt={person.church_media?.alt_text ?? ""}
                  fill
                  style={{ objectFit: "cover" }}
                />
              ) : person.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.photo_url}
                  alt=""
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span className="initials">{initialsOf(person.name)}</span>
              )}
            </div>

            <div className="person-body">
              <h3>{person.name}</h3>
              {person.role_title ? <div className="role">{person.role_title}</div> : null}
              {person.bio ? <p>{person.bio}</p> : null}
              {person.email ? (
                <p>
                  <a href={`mailto:${person.email}`}>{person.email}</a>
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
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
  if (groups.length === 0) return <EmptyState icon="people">{empty}</EmptyState>;

  return (
    <div className="cardgrid">
      {groups.map((group) => {
        // "Tuesdays 7:00 PM CT", skipping whatever is missing.
        const when = [group.meeting_day, group.meeting_time, group.meeting_tz]
          .filter(Boolean)
          .join(" ");
        const where = group.location_detail ?? group.location_type;

        return (
          <article key={group.id} className="card group-card">
            <div className="card-body">
              <h3>{group.name}</h3>
              {group.leader_name ? (
                <span className="card-kicker">{group.leader_name}</span>
              ) : null}
              {group.description ? <p>{group.description}</p> : null}

              <div className="sched">
                {when ? <span>{when}</span> : null}
                {where ? <span>{where}</span> : null}
              </div>

              {group.meeting_link ? (
                <div className="card-foot">
                  <a
                    href={group.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    {linkLabel}
                  </a>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function EventList({ events, empty }: { events: ChurchEvent[]; empty: string }) {
  if (events.length === 0) return <EmptyState icon="calendar">{empty}</EmptyState>;

  return (
    <div className="event-list">
      {events.map((event) => {
        const when = new Date(event.starts_at);
        const valid = !Number.isNaN(when.getTime());

        return (
          <article key={event.id} className="event">
            <div className="mm-plate" aria-hidden="true">
              <div className="mo">
                {valid
                  ? when.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" })
                  : ""}
              </div>
              <div className="day">{valid ? when.getUTCDate() : ""}</div>
            </div>

            <div>
              <h3>{event.title}</h3>
              {event.location ? <p className="where">{event.location}</p> : null}
              {event.description ? <p>{event.description}</p> : null}
            </div>

            {event.registration_url ? (
              <a
                href={event.registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                Register
              </a>
            ) : null}
          </article>
        );
      })}
    </div>
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
  if (sermons.length === 0) return <EmptyState icon="play">{empty}</EmptyState>;

  return (
    <div className="cardgrid">
      {sermons.map((sermon) => (
        <article key={sermon.id} className="card">
          <Thumbnail
            youtubeId={sermon.youtube_id}
            thumbnailUrl={sermon.thumbnail_url}
            title={sermon.title}
          />

          <div className="card-body">
            {sermon.series ? <span className="card-kicker">{sermon.series}</span> : null}
            <h3>{sermon.title}</h3>

            <p className="where">
              {[
                formatDate(sermon.preached_at),
                sermon.scripture_ref,
                sermon.duration_min ? `${sermon.duration_min} min` : null,
              ]
                .filter(Boolean)
                .join(" - ")}
            </p>

            {sermon.summary ? <p>{sermon.summary}</p> : null}

            {sermon.youtube_id ? (
              <div className="card-foot">
                <a
                  href={`https://www.youtube.com/watch?v=${sermon.youtube_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  {watchLabel}
                </a>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
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
  if (videos.length === 0) return <EmptyState icon="play">{empty}</EmptyState>;

  return (
    <div className="cardgrid">
      {videos.map((video) => (
        <article key={video.id} className="card">
          <Thumbnail
            youtubeId={video.youtube_id}
            thumbnailUrl={video.thumbnail_url}
            title={video.title}
          />

          <div className="card-body">
            {video.category ? <span className="card-kicker">{video.category}</span> : null}
            <h3>{video.title}</h3>
            {video.description ? <p>{video.description}</p> : null}

            <div className="card-foot">
              <a
                href={video.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                {playLabel}
              </a>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function MinistryList({
  ministries,
  empty,
}: {
  ministries: Ministry[];
  empty: string;
}) {
  if (ministries.length === 0) return <EmptyState icon="hands">{empty}</EmptyState>;

  return (
    <div className="cardgrid">
      {ministries.map((ministry) => (
        <article key={ministry.id} className="card">
          <div className="card-body">
            <h3>{ministry.name}</h3>
            {ministry.description ? <p>{ministry.description}</p> : null}
            {ministry.website_url ? (
              <div className="card-foot">
                <a
                  href={ministry.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  Visit site
                </a>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * Poster frame for a sermon or worship video.
 *
 * A stored thumbnail wins; otherwise YouTube's own still, which needs no API
 * key and no request from our side. Both hosts are allow-listed in
 * next.config.ts - an image from anywhere else fails the loader, which is the
 * intended behaviour rather than something to work around.
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
    thumbnailUrl ?? (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null);

  if (!src) return <div aria-hidden="true" className="card-media" />;

  return (
    <div className="card-media">
      <Image src={src} alt={title} fill style={{ objectFit: "cover" }} />
    </div>
  );
}
