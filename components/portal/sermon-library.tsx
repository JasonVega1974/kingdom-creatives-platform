"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  addSermon,
  removeSermon,
  setSermonStatus,
  updateSermon,
} from "@/app/(portal)/portal/sermons/actions";
import {
  SERMON_STATUSES,
  SERMON_STATUS_LABELS,
  TEAM_IDLE,
  type SermonStatus,
  type TeamState,
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
  status: SermonStatus;
};

const FIELD =
  "w-full rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] px-3 py-2 outline-none focus:border-[var(--kc-brand)]";

export function SermonLibrary({ sermons }: { sermons: SermonRow[] }) {
  return (
    <div className="space-y-5">
      <AddSermonCard />

      {sermons.length === 0 ? (
        <p className="rounded-[var(--kc-radius)] border border-dashed border-[var(--kc-line)] px-5 py-8 text-center text-[var(--kc-ink-soft)]">
          No sermons yet. Add your first one above - it stays off your website
          until you switch it on.
        </p>
      ) : (
        sermons.map((sermon) => <SermonCard key={sermon.id} sermon={sermon} />)
      )}
    </div>
  );
}

function AddSermonCard() {
  const [state, action] = useActionState(addSermon, TEAM_IDLE);
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="font-semibold text-[var(--kc-brand)]"
      >
        {open ? "Cancel" : "+ Add a sermon"}
      </button>

      {open ? (
        <form action={action} className="mt-5 space-y-4">
          <SermonFields />
          <p className="text-sm text-[var(--kc-ink-soft)]">
            New sermons stay off your website until you switch them on, so you
            can add the video and notes first.
          </p>
          <SaveRow label="Add" state={state} />
        </form>
      ) : null}
    </section>
  );
}

function SermonCard({ sermon }: { sermon: SermonRow }) {
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
          <RemoveButton sermonId={sermon.id} title={sermon.title} />
        </div>
      </div>

      {open ? (
        <form action={action} className="mt-5 space-y-4 border-t border-[var(--kc-line)] pt-5">
          <input type="hidden" name="id" value={sermon.id} />
          <SermonFields sermon={sermon} />
          <SaveRow label="Save" state={state} />
        </form>
      ) : null}
    </section>
  );
}

/** The editable fields, shared by the add form and the edit form. */
function SermonFields({ sermon }: { sermon?: SermonRow }) {
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

/**
 * Remove permanently, with an inline two-step confirm.
 *
 * The wording points at the reversible option on purpose: "Taken down (kept
 * here)" is what a pastor usually wants, and Remove is only for something
 * entered by mistake.
 */
function RemoveButton({ sermonId, title }: { sermonId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm text-red-700"
      >
        Remove
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-[var(--kc-ink-soft)]">
        Delete &ldquo;{title}&rdquo; for good? To just take it off the website,
        close this and choose &ldquo;Taken down&rdquo; instead.
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeSermon(sermonId);
            if (!result.ok) {
              setError(result.error);
              setConfirming(false);
            }
          })
        }
        className="rounded-[var(--kc-radius)] bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        Yes, delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
      >
        Keep
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
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

function SaveRow({ label, state }: { label: string; state: TeamState }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--kc-radius)] bg-[var(--kc-brand)] px-4 py-2 font-semibold text-[var(--kc-brand-contrast)] disabled:opacity-60"
      >
        {pending ? "Saving..." : label}
      </button>

      {!pending && state.error ? (
        <span role="alert" className="text-sm text-red-700">
          {state.error}
        </span>
      ) : null}
      {!pending && state.ok && !state.error ? (
        <span role="status" className="text-sm text-[var(--kc-ink-soft)]">
          Saved
        </span>
      ) : null}
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  hint,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  hint?: string;
  required?: boolean;
}) {
  // Every sermon renders its own form with a field called "title", so the id
  // cannot be the field name - see the same note in team-editor.tsx.
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
        {hint ? (
          <span className="ml-2 font-normal text-[var(--kc-ink-soft)]">({hint})</span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className={FIELD}
      />
    </div>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className={FIELD}
      />
    </div>
  );
}
