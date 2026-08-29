"use client";

import { useActionState, useId, useState, useTransition } from "react";

import {
  addSermon,
  removeSermon,
  setSermonStatus,
  updateSermon,
} from "@/app/(portal)/portal/sermons/actions";
import {
  AddCard,
  ConfirmRemove,
  EmptyList,
  Field,
  SaveRow,
  SelectField,
  TextArea,
} from "@/components/portal/editor-kit";
import {
  SERMON_STATUSES,
  SERMON_STATUS_LABELS,
  TEAM_IDLE,
  type SermonStatus,
} from "@/lib/portal/form-state";

/**
 * ============================================================
 * SERMON LIBRARY
 * ============================================================
 *
 * Same shape as Our Team - independent forms per row, judged writes, a
 * two-step remove - with one difference that runs through the whole tab:
 * publishing is a THREE-way choice, not a checkbox.
 *
 * sermons.status is 'draft | published | archived'. A checkbox can only say on
 * or off, and collapsing archived into "off" would make taking a sermon down
 * indistinguishable from never having published it. So this uses a picker, in
 * plain language - a pastor never reads the word "draft".
 *
 * Newest first, matching the public page. There is no manual reordering: a
 * sermon archive is chronological and hand-sorting it would be busywork with a
 * wrong answer available.
 */

export type SermonRow = {
  id: string;
  title: string;
  series: string;
  scriptureRef: string;
  summary: string;
  preachedAt: string;
  durationMin: string;
  youtubeId: string;
  churchLinkId: string | null;
  status: SermonStatus;
};

/** A church's video channels, from church_links. Labels are the pastor's. */
export type Channel = { id: string; label: string };

export function SermonLibrary({
  sermons,
  channels,
}: {
  sermons: SermonRow[];
  channels: Channel[];
}) {
  return (
    <div className="space-y-5">
      <AddSermonCard channels={channels} />

      {sermons.length === 0 ? (
        <EmptyList>
          No sermons yet. Add your first one above - it stays off your website
          until you switch it on.
        </EmptyList>
      ) : (
        sermons.map((sermon) => (
          <SermonCard key={sermon.id} sermon={sermon} channels={channels} />
        ))
      )}
    </div>
  );
}

function AddSermonCard({ channels }: { channels: Channel[] }) {
  const [state, action] = useActionState(addSermon, TEAM_IDLE);

  return (
    <AddCard label="+ Add a sermon">
      <form action={action} className="space-y-4">
        <SermonFields channels={channels} />
        <p className="text-sm text-[var(--kc-ink-soft)]">
          New sermons stay off your website until you switch them on, so you can
          add the video and notes first.
        </p>
        <SaveRow label="Add" state={state} />
      </form>
    </AddCard>
  );
}

function SermonCard({
  sermon,
  channels,
}: {
  sermon: SermonRow;
  channels: Channel[];
}) {
  const [state, action] = useActionState(updateSermon, TEAM_IDLE);
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{sermon.title}</h2>
          <p className="text-sm text-[var(--kc-ink-soft)]">
            {[sermon.series, sermon.scriptureRef, formatDate(sermon.preachedAt)]
              .filter(Boolean)
              .join(" - ") || "No date or passage yet"}
          </p>
          {!sermon.youtubeId ? (
            <p className="mt-1 text-xs text-[var(--kc-ink-soft)]">
              No video linked yet
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StatusPicker sermonId={sermon.id} status={sermon.status} title={sermon.title} />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : "Edit"}
          </button>
          <ConfirmRemove
            itemName={sermon.title}
            note={`Delete "${sermon.title}" for good? To just take it off the website, close this and choose "Taken down" instead.`}
            onRemove={() => removeSermon(sermon.id)}
          />
        </div>
      </div>

      {open ? (
        <form action={action} className="mt-5 space-y-4 border-t border-[var(--kc-line)] pt-5">
          <input type="hidden" name="id" value={sermon.id} />
          <SermonFields sermon={sermon} channels={channels} />
          <SaveRow label="Save" state={state} />
        </form>
      ) : null}
    </section>
  );
}

/** The editable fields, shared by the add form and the edit form. */
function SermonFields({
  sermon,
  channels,
}: {
  sermon?: SermonRow;
  channels: Channel[];
}) {
  return (
    <>
      <Field name="title" label="Title" defaultValue={sermon?.title} required />
      <Field
        name="series"
        label="Series"
        defaultValue={sermon?.series}
        hint="leave blank if it is a one-off"
      />
      <Field
        name="scripture_ref"
        label="Passage"
        defaultValue={sermon?.scriptureRef}
        hint="John 3:16-21"
      />
      <Field
        name="preached_at"
        label="Date preached"
        type="date"
        defaultValue={sermon?.preachedAt}
      />
      <Field
        name="youtube_id"
        label="YouTube link"
        defaultValue={sermon?.youtubeId}
        hint="paste the whole link - we will pull the video out of it"
      />
      <Field
        name="duration_min"
        label="Length in minutes"
        type="number"
        defaultValue={sermon?.durationMin}
      />
      {/* Only shown when the church has more than one channel. A picker with
          a single option is a question with one answer. */}
      {channels.length > 1 ? (
        <SelectField
          name="church_link_id"
          label="Which channel"
          options={[
            { value: "", label: "Not from a channel" },
            ...channels.map((channel) => ({ value: channel.id, label: channel.label })),
          ]}
          defaultValue={sermon?.churchLinkId ?? ""}
        />
      ) : null}
      <TextArea name="summary" label="Short summary" defaultValue={sermon?.summary} />
    </>
  );
}

/**
 * Draft / published / archived, in plain language.
 *
 * A select rather than a checkbox because there are three states, and rather
 * than three buttons because only one can be true at a time - a radio-group
 * shape, and a select is the compact form of that.
 *
 * Reverts if the action refuses, same rule as the team toggle.
 */
function StatusPicker({
  sermonId,
  status,
  title,
}: {
  sermonId: string;
  status: SermonStatus;
  title: string;
}) {
  const id = useId();
  const [value, setValue] = useState<SermonStatus>(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Where {title} appears
      </label>
      <select
        id={id}
        value={value}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as SermonStatus;
          const previous = value;
          setValue(next);
          setError(null);

          startTransition(async () => {
            const result = await setSermonStatus(sermonId, next);
            if (!result.ok) {
              setValue(previous);
              setError(result.error);
            }
          });
        }}
        className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] px-3 py-1.5 text-sm disabled:opacity-60"
      >
        {SERMON_STATUSES.map((option) => (
          <option key={option} value={option}>
            {SERMON_STATUS_LABELS[option]}
          </option>
        ))}
      </select>

      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}


// ---------------------------------------------------------------

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}



