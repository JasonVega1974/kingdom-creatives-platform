"use client";

import { useId, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import type { TeamState } from "@/lib/portal/form-state";

/**
 * ============================================================
 * EDITOR KIT - the pieces every collection tab is built from
 * ============================================================
 *
 * Our Team, Sermon Library, Events and Groups are the same tab four times over:
 * a list of rows, each with its own form, a publish control, reordering where
 * order is meaningful, and a two-step remove. These were copied twice before
 * this file existed; a fourth copy would guarantee they drift.
 *
 * Everything here is deliberately unopinionated about WHAT is being edited. The
 * tab supplies the fields and the actions; this supplies the shape.
 *
 * Two conventions worth not re-deriving:
 *
 *   - Field ids come from useId(), never the field name. Every row renders a
 *     form containing a field called "name" or "title", and duplicate ids would
 *     point every label at the first matching input on the page.
 *
 *   - A control that changes state flips immediately and REVERTS if the action
 *     refuses. Waiting for a round trip feels broken; lying is worse.
 */

export const FIELD =
  "w-full rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] px-3 py-2 outline-none focus:border-[var(--kc-brand)]";

export function Field({
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

export function TextArea({
  name,
  label,
  defaultValue,
  rows = 3,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
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
        rows={rows}
        defaultValue={defaultValue}
        className={FIELD}
      />
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
        {hint ? (
          <span className="ml-2 font-normal text-[var(--kc-ink-soft)]">({hint})</span>
        ) : null}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={FIELD}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SaveRow({ label, state }: { label: string; state: TeamState }) {
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

/**
 * Show/hide.
 *
 * A CHECKBOX, not a button labelled with the current state. A button reading
 * "Hidden" is ambiguous - it could mean "this is hidden" or "click to hide it",
 * and that ambiguity was reported from real use on 2026-08-28. A checkbox
 * affords "click to change" on its own, so the text beside it is free to
 * describe the state.
 *
 * Matches the toggle in Edit My Website. Two controls doing the same job in the
 * same product should not look different.
 */
export function VisibleCheckbox({
  itemName,
  visible,
  onToggle,
}: {
  /** Used in the screen-reader label: "Show {itemName} on the website". */
  itemName: string;
  visible: boolean;
  onToggle: (next: boolean) => Promise<TeamState>;
}) {
  const [shown, setShown] = useState(visible);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <span className="sr-only">Show {itemName} on the website</span>
        <input
          type="checkbox"
          checked={shown}
          disabled={pending}
          onChange={() => {
            const next = !shown;
            setShown(next);
            setError(null);

            startTransition(async () => {
              const result = await onToggle(next);
              if (!result.ok) {
                setShown(!next);
                setError(result.error);
              }
            });
          }}
          className="h-5 w-5 accent-[var(--kc-brand)]"
        />
        <span aria-hidden className="w-14 text-[var(--kc-ink-soft)]">
          {shown ? "Shown" : "Hidden"}
        </span>
      </label>

      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function MoveButtons({
  isFirst,
  isLast,
  onMove,
}: {
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: "up" | "down") => Promise<TeamState>;
}) {
  const [pending, startTransition] = useTransition();

  const move = (direction: "up" | "down") =>
    startTransition(async () => {
      await onMove(direction);
    });

  return (
    <div className="flex items-center">
      <button
        type="button"
        disabled={isFirst || pending}
        onClick={() => move("up")}
        aria-label="Move up"
        className="rounded-l-[var(--kc-radius)] border border-[var(--kc-line)] px-2.5 py-1.5 text-sm disabled:opacity-40"
      >
        {"↑"}
      </button>
      <button
        type="button"
        disabled={isLast || pending}
        onClick={() => move("down")}
        aria-label="Move down"
        className="-ml-px rounded-r-[var(--kc-radius)] border border-[var(--kc-line)] px-2.5 py-1.5 text-sm disabled:opacity-40"
      >
        {"↓"}
      </button>
    </div>
  );
}

/**
 * Remove, with an inline two-step confirm rather than window.confirm().
 *
 * A native confirm blocks the page, cannot be styled, and is a modal people
 * dismiss by reflex. Two deliberate clicks with the item's name in between is
 * harder to do by accident.
 *
 * `note` lets a tab point at a reversible alternative - the Sermon Library says
 * "to just take it off the website, choose Taken down instead", because that is
 * usually what someone actually wants.
 */
export function ConfirmRemove({
  itemName,
  note,
  onRemove,
}: {
  itemName: string;
  note?: string;
  onRemove: () => Promise<TeamState>;
}) {
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
        {note ?? `Remove ${itemName}?`}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await onRemove();
            if (!result.ok) {
              setError(result.error);
              setConfirming(false);
            }
          })
        }
        className="rounded-[var(--kc-radius)] bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        Yes, remove
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

/** Shown when a collection has no rows yet. */
export function EmptyList({ children }: { children: string }) {
  return (
    <p className="rounded-[var(--kc-radius)] border border-dashed border-[var(--kc-line)] px-5 py-8 text-center text-[var(--kc-ink-soft)]">
      {children}
    </p>
  );
}

/** The "+ Add ..." disclosure every tab opens with. */
export function AddCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="font-semibold text-[var(--kc-brand)]"
      >
        {open ? "Cancel" : label}
      </button>

      {open ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
