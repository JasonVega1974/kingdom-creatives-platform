import type { Metadata } from "next";

import { NotesEditor, type NoteRow, type SermonOption } from "@/components/portal/notes-editor";
import { requirePortalUser } from "@/lib/portal/auth";
import type { NoteType } from "@/lib/portal/form-state";
import { noteBodyToHtml } from "@/lib/portal/note-body";
import type { JSONContent } from "@/lib/portal/note-extensions";
import { createClient } from "@/lib/supabase/server";
import { HelpMark } from "@/components/portal/help-mark";

export const metadata: Metadata = { title: "Notes" };

/**
 * "Notes" - church-shared, per Jason's 2026-09-01 scoping decision. Every
 * portal member sees every note; there is no owner-only filter here the way
 * team/page.tsx filters staff by visibility. See components/portal/
 * notes-editor.tsx for the banner and byline this decision requires in the UI.
 *
 * Two queries, same reasoning as team/page.tsx's staff + church_media split:
 * the sermon picker needs the whole curated library, which is cheaper as one
 * extra server-rendered query than a client-side fetch.
 */
export default async function NotesPage() {
  const session = await requirePortalUser();

  const supabase = await createClient();

  const { data: sermonRows } = await supabase
    .from("sermons")
    .select("id, title")
    .eq("church_id", session.site.church.id)
    .order("preached_at", { ascending: false, nullsFirst: false });

  const sermons: SermonOption[] = (sermonRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
  }));
  const sermonTitle = new Map(sermons.map((sermon) => [sermon.id, sermon.title]));

  const { data: rows, error } = await supabase
    .from("pastor_notes")
    .select(
      "id, title, body_json, category, scripture_book, scripture_chapter, scripture_verse_start, scripture_verse_end, sermon_id, reminder_at, user_id, created_at, updated_at",
    )
    .eq("church_id", session.site.church.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <Shell churchName={session.site.church.name ?? "your church"}>
        <p role="alert" className="text-red-700">
          Your notes could not be loaded right now. Refresh the page - nothing
          has been lost.
        </p>
      </Shell>
    );
  }

  const notes: NoteRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    bodyJson: (row.body_json as JSONContent | null) ?? { type: "doc", content: [] },
    bodyHtml: noteBodyToHtml(row.body_json as JSONContent | null),
    category: (row.category as NoteType) ?? "general",
    scriptureBook: row.scripture_book,
    scriptureChapter: row.scripture_chapter,
    scriptureVerseStart: row.scripture_verse_start,
    scriptureVerseEnd: row.scripture_verse_end,
    sermonId: row.sermon_id,
    sermonTitle: row.sermon_id ? (sermonTitle.get(row.sermon_id) ?? null) : null,
    reminderAt: row.reminder_at ?? "",
    isMine: row.user_id === session.userId,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  }));

  return (
    <Shell churchName={session.site.church.name ?? "your church"}>
      <NotesEditor
        notes={notes}
        sermons={sermons}
        churchName={session.site.church.name ?? "your church"}
      />
    </Shell>
  );
}

function Shell({ children, churchName }: { children: React.ReactNode; churchName: string }) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2.5">
        <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-bold">Notes</h1>
        <HelpMark topic="notes.editor" />
      </div>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        Sermon prep, reminders, and anything else worth writing down for{" "}
        {churchName}. Type it, format it, attach it to a sermon or a passage -
        it is here whenever you need it again.
      </p>

      {children}
    </div>
  );
}
