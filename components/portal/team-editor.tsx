"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  addPerson,
  movePerson,
  removePerson,
  setPersonVisible,
  updatePerson,
} from "@/app/(portal)/portal/team/actions";
import { TEAM_IDLE, type TeamState } from "@/lib/portal/form-state";

/**
 * ============================================================
 * OUR TEAM - the people on the public /team page
 * ============================================================
 *
 * Deliberately plain. The pastor-facing language avoids "record", "entry" and
 * "publish" - it is a person, they are shown or hidden, and Remove means
 * remove. Same principle as the section registry: a pastor never sees a
 * developer word.
 *
 * Each person is an independent form. One <form> around the whole list would
 * mean a single Save that rewrites everyone, so a typo in one bio could not be
 * abandoned without losing the others.
 */

export type Person = {
  id: string;
  name: string;
  roleTitle: string;
  bio: string;
  email: string;
  phone: string;
  photoUrl: string;
  visible: boolean;
};

const FIELD =
  "w-full rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] px-3 py-2 outline-none focus:border-[var(--kc-brand)]";

export function TeamEditor({ people }: { people: Person[] }) {
  return (
    <div className="space-y-5">
      <AddPersonCard />

      {people.length === 0 ? (
        <p className="rounded-[var(--kc-radius)] border border-dashed border-[var(--kc-line)] px-5 py-8 text-center text-[var(--kc-ink-soft)]">
          Nobody added yet. Add your first person above - they stay hidden until
          you switch them on.
        </p>
      ) : (
        people.map((person, index) => (
          <PersonCard
            key={person.id}
            person={person}
            isFirst={index === 0}
            isLast={index === people.length - 1}
          />
        ))
      )}
    </div>
  );
}

function AddPersonCard() {
  const [state, action] = useActionState(addPerson, TEAM_IDLE);
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="font-semibold text-[var(--kc-brand)]"
      >
        {open ? "Cancel" : "+ Add someone"}
      </button>

      {open ? (
        <form action={action} className="mt-5 space-y-4">
          <Field name="name" label="Name" required />
          <Field name="role_title" label="Role" hint="Pastor, Chaplain, Worship Lead" />
          <TextArea name="bio" label="A short bio" />
          <Field name="photo_url" label="Photo link" hint="the Photos tab will replace this" />
          <Field name="email" label="Email" type="email" />
          <Field name="phone" label="Phone" type="tel" />

          <p className="text-sm text-[var(--kc-ink-soft)]">
            New people are hidden until you switch them on, so you can finish
            writing before anyone sees it.
          </p>

          <SaveRow label="Add" state={state} />
        </form>
      ) : null}
    </section>
  );
}

function PersonCard({
  person,
  isFirst,
  isLast,
}: {
  person: Person;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, action] = useActionState(updatePerson, TEAM_IDLE);
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{person.name}</h2>
          {person.roleTitle ? (
            <p className="text-sm text-[var(--kc-ink-soft)]">{person.roleTitle}</p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--kc-ink-soft)]">
            {person.visible ? "Showing on your website" : "Hidden from your website"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <MoveButtons personId={person.id} isFirst={isFirst} isLast={isLast} />
          <VisibleToggle personId={person.id} visible={person.visible} />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : "Edit"}
          </button>
          <RemoveButton personId={person.id} name={person.name} />
        </div>
      </div>

      {open ? (
        <form action={action} className="mt-5 space-y-4 border-t border-[var(--kc-line)] pt-5">
          <input type="hidden" name="id" value={person.id} />

          <Field name="name" label="Name" defaultValue={person.name} required />
          <Field name="role_title" label="Role" defaultValue={person.roleTitle} />
          <TextArea name="bio" label="A short bio" defaultValue={person.bio} />
          <Field name="photo_url" label="Photo link" defaultValue={person.photoUrl} />
          <Field name="email" label="Email" type="email" defaultValue={person.email} />
          <Field name="phone" label="Phone" type="tel" defaultValue={person.phone} />

          <SaveRow label="Save" state={state} />
        </form>
      ) : null}
    </section>
  );
}

/**
 * Show/hide.
 *
 * Optimistic-ish: the switch flips immediately and reverts if the action
 * reports a refusal. A toggle that waits for a round trip feels broken, and a
 * toggle that lies is worse - so it does revert rather than silently disagree
 * with the database.
 */
function VisibleToggle({ personId, visible }: { personId: string; visible: boolean }) {
  const [shown, setShown] = useState(visible);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        aria-pressed={shown}
        onClick={() => {
          const next = !shown;
          setShown(next);
          setError(null);
          startTransition(async () => {
            const result = await setPersonVisible(personId, next);
            if (!result.ok) {
              setShown(!next);
              setError(result.error);
            }
          });
        }}
        className={
          shown
            ? "rounded-[var(--kc-radius)] bg-[var(--kc-brand)] px-3 py-1.5 text-sm font-semibold text-[var(--kc-brand-contrast)] disabled:opacity-60"
            : "rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm disabled:opacity-60"
        }
      >
        {shown ? "Shown" : "Hidden"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function MoveButtons({
  personId,
  isFirst,
  isLast,
}: {
  personId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const move = (direction: "up" | "down") =>
    startTransition(async () => {
      await movePerson(personId, direction);
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
 * Remove, with an inline confirm rather than window.confirm().
 *
 * A native confirm blocks the page and cannot be styled; more to the point, it
 * is a modal a pastor can dismiss by reflex. Two deliberate clicks with the
 * person's name in between is harder to do by accident.
 */
function RemoveButton({ personId, name }: { personId: string; name: string }) {
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
    <span className="flex items-center gap-2">
      <span className="text-sm text-[var(--kc-ink-soft)]">Remove {name}?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removePerson(personId);
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

// ---------------------------------------------------------------

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
          Saved and live on the website
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
  // Every person renders its own form with a field called "name", so the id
  // cannot be the field name - duplicate ids would point each label at the
  // first matching input on the page rather than its own.
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
        rows={4}
        defaultValue={defaultValue}
        className={FIELD}
      />
    </div>
  );
}
