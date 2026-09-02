import type { Metadata } from "next";

import { EventsCalendar } from "@/components/portal/events-calendar";
import { EventsEditor, type EventRow } from "@/components/portal/events-editor";
import Link from "next/link";
import { requirePortalUser } from "@/lib/portal/auth";
import type { LibraryItem } from "@/components/portal/media-picker";
import { createClient } from "@/lib/supabase/server";
import { HelpMark } from "@/components/portal/help-mark";

export const metadata: Metadata = { title: "Events" };

/**
 * "Events" - the calendar, including past and unpublished ones.
 *
 * Deliberately shows everything, unlike the public page which lists upcoming
 * published events only. A pastor needs to find last month's event to copy its
 * details, and needs to see that something is unpublished in order to publish
 * it. Soonest first so the next thing is at the top.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const session = await requirePortalUser();
  const params = await searchParams;
  const isMonth = params.view === "month";

  const supabase = await createClient();

  const { data: libraryRows } = await supabase
    .from("church_media")
    .select("id, storage_path, title, alt_text")
    .eq("church_id", session.site.church.id)
    .order("created_at", { ascending: false });

  const library: LibraryItem[] = (libraryRows ?? []).map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    title: row.title ?? "",
    altText: row.alt_text ?? "",
  }));

  const { data: rows, error } = await supabase
    .from("events")
    .select(
      "id, title, description, starts_at, ends_at, location, event_type, registration_url, media_id, published",
    )
    .eq("church_id", session.site.church.id)
    .order("starts_at", { ascending: false });

  if (error) {
    return (
      <Shell>
        <p role="alert" className="text-red-700">
          Your events could not be loaded right now. Refresh the page - nothing
          has been lost.
        </p>
      </Shell>
    );
  }

  const events: EventRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" with no zone.
    // Stored values are UTC wall-clock (FF-38), so slicing the ISO string is
    // the round trip - converting would double-apply an offset.
    startsAt: toLocalInput(row.starts_at),
    endsAt: toLocalInput(row.ends_at),
    location: row.location ?? "",
    eventType: row.event_type ?? "",
    registrationUrl: row.registration_url ?? "",
    mediaId: row.media_id,
    published: row.published,
  }));

  return (
    <Shell>
      <ViewToggle isMonth={isMonth} />

      {isMonth ? (
        <EventsCalendar events={events} month={monthFrom(params.month)} />
      ) : (
        <EventsEditor events={events} library={library} />
      )}
    </Shell>
  );
}

/**
 * The month to display, from `?month=YYYY-MM`.
 *
 * Anything missing or unparseable falls back to the current month rather than
 * erroring - a hand-edited URL should show a calendar, not a stack trace.
 */
function monthFrom(value: string | undefined): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return new Date(Date.UTC(year, month - 1, 1));
  }

  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** List or month. Plain links, so the choice is shareable and needs no JS. */
function ViewToggle({ isMonth }: { isMonth: boolean }) {
  const base =
    "rounded-[var(--kc-radius)] px-3 py-1.5 text-sm border border-[var(--kc-line)]";
  const on = `${base} bg-[var(--kc-brand)] font-semibold text-[var(--kc-brand-contrast)]`;

  return (
    <div className="mb-6 flex gap-2">
      <Link href="?" className={isMonth ? base : on}>
        List
      </Link>
      <Link href="?view=month" className={isMonth ? on : base}>
        Month
      </Link>
    </div>
  );
}

/** "2026-09-13T10:30:00+00:00" -> "2026-09-13T10:30". */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  return String(value).slice(0, 16);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2.5">
        <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-bold">
          Events
        </h1>
        <HelpMark topic="events.overview" />
      </div>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        What is coming up. Your website shows upcoming events only - anything
        that has already happened drops off on its own.
      </p>

      {children}
    </div>
  );
}
