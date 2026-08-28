"use client";

import { useActionState, useState } from "react";

import {
  addPerson,
  movePerson,
  removePerson,
  setPersonVisible,
  updatePerson,
} from "@/app/(portal)/portal/team/actions";
import {
  AddCard,
  ConfirmRemove,
  EmptyList,
  Field,
  MoveButtons,
  SaveRow,
  TextArea,
  VisibleCheckbox,
} from "@/components/portal/editor-kit";
import { MediaPicker, type LibraryItem } from "@/components/portal/media-picker";
import { TEAM_IDLE } from "@/lib/portal/form-state";

/**
 * ============================================================
 * OUR TEAM - the people on the public /team page
 * ============================================================
 *
 * Built from components/portal/editor-kit.tsx, like every other collection tab.
 * It previously carried private copies of Field, TextArea, SaveRow, the toggle,
 * the move buttons and the confirm-remove; those are gone.
 *
 * The kit exists to stop that duplication, and this file had never actually
 * been moved onto it - which is why a one-line label change needed three edits
 * instead of one.
 *
 * Deliberately plain language. It is a person, they are shown or hidden, and
 * Remove means remove - a pastor never sees a developer word.
 *
 * Each person is an independent form. One form around the whole list would mean
 * a single Save that rewrites everyone, so a typo in one bio could not be
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
  mediaId: string | null;
  visible: boolean;
};

export function TeamEditor({
  people,
  library,
}: {
  people: Person[];
  library: LibraryItem[];
}) {
  return (
    <div className="space-y-5">
      <AddPersonCard library={library} />

      {people.length === 0 ? (
        <EmptyList>
          Nobody added yet. Add your first person above - they stay hidden until
          you switch them on.
        </EmptyList>
      ) : (
        people.map((person, index) => (
          <PersonCard
            key={person.id}
            person={person}
            library={library}
            isFirst={index === 0}
            isLast={index === people.length - 1}
          />
        ))
      )}
    </div>
  );
}

function AddPersonCard({ library }: { library: LibraryItem[] }) {
  const [state, action] = useActionState(addPerson, TEAM_IDLE);

  return (
    <AddCard label="+ Add someone">
      <form action={action} className="space-y-4">
        <Field name="name" label="Name" required />
        <Field name="role_title" label="Role" hint="Pastor, Chaplain, Worship Lead" />
        <TextArea name="bio" label="A short bio" rows={4} />
        <MediaPicker name="media_id" label="Photo" library={library} />
        <Field name="email" label="Email" type="email" />
        <Field name="phone" label="Phone" type="tel" />

        <p className="text-sm text-[var(--kc-ink-soft)]">
          New people are hidden until you switch them on, so you can finish
          writing before anyone sees it.
        </p>

        <SaveRow label="Add" state={state} />
      </form>
    </AddCard>
  );
}

function PersonCard({
  person,
  library,
  isFirst,
  isLast,
}: {
  person: Person;
  library: LibraryItem[];
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
          {/* The state, in words. The checkbox says what ticking DOES; this
              says where things stand. */}
          <p className="mt-1 text-xs text-[var(--kc-ink-soft)]">
            {person.visible ? "On your team page" : "Not on your team page yet"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <MoveButtons
            isFirst={isFirst}
            isLast={isLast}
            onMove={(direction) => movePerson(person.id, direction)}
          />
          <VisibleCheckbox
            itemName={person.name}
            visible={person.visible}
            onToggle={(next) => setPersonVisible(person.id, next)}
          />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : "Edit"}
          </button>
          <ConfirmRemove
            itemName={person.name}
            onRemove={() => removePerson(person.id)}
          />
        </div>
      </div>

      {open ? (
        <form action={action} className="mt-5 space-y-4 border-t border-[var(--kc-line)] pt-5">
          <input type="hidden" name="id" value={person.id} />

          <Field name="name" label="Name" defaultValue={person.name} required />
          <Field name="role_title" label="Role" defaultValue={person.roleTitle} />
          <TextArea name="bio" label="A short bio" defaultValue={person.bio} rows={4} />
          <MediaPicker
            name="media_id"
            label="Photo"
            library={library}
            value={person.mediaId}
            fallbackUrl={person.photoUrl}
          />
          <Field name="email" label="Email" type="email" defaultValue={person.email} />
          <Field name="phone" label="Phone" type="tel" defaultValue={person.phone} />

          <SaveRow label="Save" state={state} />
        </form>
      ) : null}
    </section>
  );
}
