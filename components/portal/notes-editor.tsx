"use client";

import { useActionState, useEffect, useState } from "react";

import { createNote, removeNote, updateNote } from "@/app/(portal)/portal/notes/actions";
import {
  AddCard,
  ConfirmRemove,
  EmptyList,
  Field,
  SaveRow,
  SelectField,
} from "@/components/portal/editor-kit";
import { NoteBodyEditor } from "@/components/portal/note-body-editor";
import { formatScripture, ScripturePicker } from "@/components/portal/scripture-picker";
import { NOTE_TYPE_LABELS, NOTE_TYPES, TEAM_IDLE, type NoteType } from "@/lib/portal/form-state";
import type { JSONContent } from "@/lib/portal/note-extensions";

/**
 * ============================================================
 * NOTES - church-shared, not private (see the banner below)
 * ============================================================
 *
 * pastor_notes moved from owner-only to church-member RLS on 2026-09-01
 * (supabase/drafts/33_notes.sql). Every portal member at this church can read
 * and edit every note here. The banner and each card's byline exist because
 * that is a real change in what this tab is - a UI that just dropped the
 * word "My" from the old title would leave that assumption standing for
 * anyone who remembers it as private.
 */

export type NoteRow = {
  id: string;
  title: string;
  bodyJson: JSONContent;
  bodyHtml: string;
  category: NoteType;
  scriptureBook: string | null;
  scriptureChapter: number | null;
  scriptureVerseStart: number | null;
  scriptureVerseEnd: number | null;
  sermonId: string | null;
  sermonTitle: string | null;
  reminderAt: string;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SermonOption = { id: string; title: string };

const TYPE_OPTIONS = NOTE_TYPES.map((value) => ({ value, label: NOTE_TYPE_LABELS[value] }));

export function NotesEditor({
  notes,
  sermons,
  churchName,
}: {
  notes: NoteRow[];
  sermons: SermonOption[];
  churchName: string;
}) {
  const upcoming = notes
    .filter((note) => note.reminderAt && note.reminderAt >= isoNow())
    .sort((a, b) => a.reminderAt.localeCompare(b.reminderAt));

  return (
    <div className="space-y-5">
      <p className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-paper-dim)] px-4 py-3 text-sm text-[var(--kc-ink-soft)]">
        Every note here is visible to everyone with portal access at {churchName} -
        not private to just you. Each note shows who wrote it.
      </p>

      {upcoming.length > 0 ? (
        <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
          <h2 className="font-semibold">Upcoming reminders</h2>
          <ul className="mt-3 space-y-2">
            {upcoming.map((note) => (
              <li key={note.id} className="text-sm">
                <a href={`#note-${note.id}`} className="font-medium text-[var(--kc-brand)]">
                  {note.title}
                </a>
                <span className="text-[var(--kc-ink-soft)]"> - {formatReminder(note.reminderAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AddNote sermons={sermons} />

      {notes.length === 0 ? (
        <EmptyList>Nothing here yet. Add your first note above.</EmptyList>
      ) : (
        notes.map((note) => <NoteCard key={note.id} note={note} sermons={sermons} />)
      )}
    </div>
  );
}

function AddNote({ sermons }: { sermons: SermonOption[] }) {
  const [state, action] = useActionState(createNote, TEAM_IDLE);

  return (
    <AddCard label="+ Add a note">
      <form action={action} className="space-y-4">
        <NoteFields sermons={sermons} />
        <SaveRow label="Add note" state={state} />
      </form>
    </AddCard>
  );
}

function NoteCard({ note, sermons }: { note: NoteRow; sermons: SermonOption[] }) {
  const [state, action] = useActionState(updateNote, TEAM_IDLE);
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  const scripture = formatScripture(
    note.scriptureBook,
    note.scriptureChapter,
    note.scriptureVerseStart,
    note.scriptureVerseEnd,
  );

  return (
    <section
      id={`note-${note.id}`}
      className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{note.title}</h3>
            <span className="rounded-full border border-[var(--kc-line)] px-2 py-0.5 text-xs text-[var(--kc-ink-soft)]">
              {NOTE_TYPE_LABELS[note.category]}
            </span>
          </div>

          <p className="mt-1 text-xs text-[var(--kc-ink-soft)]">
            Written by {note.isMine ? "you" : "a teammate"} - {formatDate(note.createdAt)}
            {scripture ? ` - ${scripture}` : ""}
            {note.sermonTitle ? ` - attached to "${note.sermonTitle}"` : ""}
            {note.reminderAt ? ` - reminder ${formatReminder(note.reminderAt)}` : ""}
          </p>

          {/*
            Safe: bodyHtml comes from lib/portal/note-body.ts's generateHTML(),
            which can only emit markup for the closed NOTE_EXTENSIONS schema -
            no script, no attribute injection, because nothing outside that
            schema is representable in the JSON it was built from.
          */}
          <div
            className="kc-note-body mt-3 text-sm"
            dangerouslySetInnerHTML={{ __html: note.bodyHtml }}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPrinting(true)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : "Edit"}
          </button>
          <ConfirmRemove itemName="this note" onRemove={() => removeNote(note.id)} />
        </div>
      </div>

      {open ? (
        <form action={action} className="mt-5 space-y-4 border-t border-[var(--kc-line)] pt-5">
          <input type="hidden" name="id" value={note.id} />
          <NoteFields note={note} sermons={sermons} />
          <SaveRow label="Save" state={state} />
        </form>
      ) : null}

      {printing ? <PrintTarget note={note} scripture={scripture} onDone={() => setPrinting(false)} /> : null}
    </section>
  );
}

function NoteFields({ note, sermons }: { note?: NoteRow; sermons: SermonOption[] }) {
  return (
    <>
      <Field name="title" label="Title" defaultValue={note?.title} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          name="category"
          label="Type"
          options={TYPE_OPTIONS}
          defaultValue={note?.category ?? "general"}
        />
        <SelectField
          name="sermon_id"
          label="Attach to a sermon"
          hint="curated sermons only"
          options={[{ value: "", label: "Not attached" }, ...sermons.map((s) => ({ value: s.id, label: s.title }))]}
          defaultValue={note?.sermonId ?? ""}
        />
      </div>

      <ScripturePicker
        defaultBook={note?.scriptureBook}
        defaultChapter={note?.scriptureChapter}
        defaultVerseStart={note?.scriptureVerseStart}
        defaultVerseEnd={note?.scriptureVerseEnd}
      />

      <Field
        name="reminder_at"
        label="Reminder"
        type="datetime-local"
        defaultValue={toDatetimeLocalValue(note?.reminderAt)}
        hint="shown in Upcoming reminders above - does not send an email or notification (FF-56)"
      />

      <div>
        <span className="mb-1 block text-sm font-medium">Note</span>
        <NoteBodyEditor name="body_json" defaultValue={note?.bodyJson} />
      </div>
    </>
  );
}

/**
 * Rendered only while `printing` is true, so at most one of these exists in
 * the DOM at once - which is what lets the print CSS in app/globals.css
 * (`.kc-note-print-target`) hide everything else on the page without needing
 * to know how many other notes are on screen.
 */
function PrintTarget({
  note,
  scripture,
  onDone,
}: {
  note: NoteRow;
  scripture: string | null;
  onDone: () => void;
}) {
  useEffect(() => {
    window.print();
    const reset = () => onDone();
    window.addEventListener("afterprint", reset, { once: true });
    return () => window.removeEventListener("afterprint", reset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="kc-note-print-target">
      <h1>{note.title}</h1>
      <p>
        {NOTE_TYPE_LABELS[note.category]}
        {scripture ? ` - ${scripture}` : ""}
      </p>
      <div className="kc-note-body" dangerouslySetInnerHTML={{ __html: note.bodyHtml }} />
    </div>
  );
}

function toDatetimeLocalValue(iso: string | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function isoNow(): string {
  return new Date().toISOString();
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatReminder(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
