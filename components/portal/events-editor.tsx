"use client";

import { useActionState, useState } from "react";

import {
  addEvent,
  removeEvent,
  setEventPublished,
  updateEvent,
} from "@/app/(portal)/portal/events/actions";
import {
  AddCard,
  ConfirmRemove,
  EmptyList,
  Field,
  SaveRow,
  SelectField,
  TextArea,
  VisibleCheckbox,
} from "@/components/portal/editor-kit";
import { MediaPicker, type LibraryItem } from "@/components/portal/media-picker";
import { TEAM_IDLE } from "@/lib/portal/form-state";

/**
 * ============================================================
 * EVENTS
 * ============================================================
 *
 * Built from the shared editor kit. The only thing specific to events is the
 * fields and the type picker.
 *
 * TIMES DISPLAY IN UTC, matching how they are stored. See FF-38: the church has
 * no timezone column, so the typed wall-clock time is pinned to UTC and read
 * back the same way. The pastor types 10:30 and sees 10:30, which is the
 * behaviour that matters here; it is wrong only for something that leaves the
 * site carrying real timezone meaning.
 */

export type EventRow = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  eventType: string;
  registrationUrl: string;
  mediaId: string | null;
  published: boolean;
};

/**
 * The values the public /events filter strip is seeded with. A type outside
 * this list leaves an event unreachable from the filters even while published,
 * so this is a picker rather than a free-text box.
 */
const EVENT_TYPES = [
  { value: "", label: "No type" },
  { value: "in_person", label: "In person" },
  { value: "retreat", label: "Retreat" },
];

export function EventsEditor({
  events,
  library,
}: {
  events: EventRow[];
  library: LibraryItem[];
}) {
  return (
    <div className="space-y-5">
      <AddEvent library={library} />

      {events.length === 0 ? (
        <EmptyList>
          Nothing on the calendar yet. Add your first event above - it stays off
          your website until you switch it on.
        </EmptyList>
      ) : (
        events.map((event) => (
          <EventCard key={event.id} event={event} library={library} />
        ))
      )}
    </div>
  );
}

function AddEvent({ library }: { library: LibraryItem[] }) {
  const [state, action] = useActionState(addEvent, TEAM_IDLE);

  return (
    <AddCard label="+ Add an event">
      <form action={action} className="space-y-4">
        <EventFields library={library} />
        <p className="text-sm text-[var(--kc-ink-soft)]">
          New events stay off your website until you switch them on.
        </p>
        <SaveRow label="Add" state={state} />
      </form>
    </AddCard>
  );
}

function EventCard({
  event,
  library,
}: {
  event: EventRow;
  library: LibraryItem[];
}) {
  const [state, action] = useActionState(updateEvent, TEAM_IDLE);
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{event.title}</h2>
          <p className="text-sm text-[var(--kc-ink-soft)]">
            {[formatWhen(event.startsAt), event.location].filter(Boolean).join(" - ") ||
              "No date set"}
          </p>
          {isPast(event.startsAt, event.endsAt) ? (
            <p className="mt-1 text-xs text-[var(--kc-ink-soft)]">
              Already happened - no longer shown on your website
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <VisibleCheckbox
            itemName={event.title}
            visible={event.published}
            onToggle={(next) => setEventPublished(event.id, next)}
          />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : "Edit"}
          </button>
          <ConfirmRemove
            itemName={event.title}
            onRemove={() => removeEvent(event.id)}
          />
        </div>
      </div>

      {open ? (
        <form action={action} className="mt-5 space-y-4 border-t border-[var(--kc-line)] pt-5">
          <input type="hidden" name="id" value={event.id} />
          <EventFields event={event} library={library} />
          <SaveRow label="Save" state={state} />
        </form>
      ) : null}
    </section>
  );
}

function EventFields({
  event,
  library,
}: {
  event?: EventRow;
  library: LibraryItem[];
}) {
  return (
    <>
      <Field name="title" label="What is it?" defaultValue={event?.title} required />
      <Field
        name="starts_at"
        label="Starts"
        type="datetime-local"
        defaultValue={event?.startsAt}
        required
      />
      <Field
        name="ends_at"
        label="Ends"
        type="datetime-local"
        defaultValue={event?.endsAt}
        hint="leave blank for a one-moment event"
      />
      <Field
        name="location"
        label="Where"
        defaultValue={event?.location}
        hint="a place, or an online link"
      />
      <SelectField
        name="event_type"
        label="Type"
        options={EVENT_TYPES}
        defaultValue={event?.eventType}
        hint="visitors can filter by this"
      />
      <Field
        name="registration_url"
        label="Sign-up link"
        defaultValue={event?.registrationUrl}
        hint="if people need to register"
      />
      <TextArea name="description" label="Details" defaultValue={event?.description} />
      <MediaPicker
        name="media_id"
        label="Photo"
        library={library}
        value={event?.mediaId}
      />
    </>
  );
}

/**
 * Formatted in UTC on purpose - see the file header. Using the reader's local
 * zone would shift every time by their offset from the stored wall clock.
 */
function formatWhen(value: string): string {
  if (!value) return "";
  const date = new Date(`${value}Z`);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Whether the public page has already dropped this event.
 *
 * getEvents() lists upcoming only, preferring ends_at. Saying so in the portal
 * stops "why is my event missing" being a support question.
 */
function isPast(startsAt: string, endsAt: string): boolean {
  const reference = endsAt || startsAt;
  if (!reference) return false;
  const date = new Date(`${reference}Z`);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}
