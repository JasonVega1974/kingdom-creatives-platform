"use server";

import { requirePortalUser } from "@/lib/portal/auth";
import {
  judgeWrite,
  nullableText,
  nullableTimestamp,
  nullableUuid,
  publishChange,
  text,
} from "@/lib/portal/collection-write";
import { NOTE_TYPES, type TeamState } from "@/lib/portal/form-state";
import { EMPTY_NOTE_BODY, type JSONContent } from "@/lib/portal/note-extensions";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * Server Actions for "Notes"
 * ============================================================
 *
 * Writes public.pastor_notes. Church-shared as of supabase/drafts/33_notes.sql
 * (2026-09-01) - any portal member at the church may read and write any note,
 * the same "member full access" pattern as prayer_requests and every other
 * collection tab. user_id still records who wrote a note; it is no longer an
 * access boundary, only a byline (see components/portal/notes-editor.tsx).
 *
 * publishChange() is the standard collection-write helper and is reused
 * as-is, but notes have no public page - the churchTag() half of it
 * invalidates a cache tag nothing reads. Kept anyway rather than forking a
 * portal-only variant: one write pattern for every tab is worth more than
 * skipping one no-op cache tag, and revalidatePath("/", "layout") is what
 * actually makes an edited note show up here without a hard refresh.
 *
 * body_json is a TipTap document, not HTML - see lib/portal/note-extensions.ts
 * for why. It arrives as a JSON string (FormData has no object type) and is
 * parsed here; a parse failure means the client sent something broken, not
 * that the pastor's words were empty, so it is reported as a real error
 * rather than silently saved as a blank note.
 */

function noteBody(formData: FormData): { ok: true; value: JSONContent } | { ok: false } {
  const raw = text(formData, "body_json");
  if (!raw) return { ok: true, value: EMPTY_NOTE_BODY };

  try {
    return { ok: true, value: JSON.parse(raw) as JSONContent };
  } catch {
    return { ok: false };
  }
}

/** category, validated against the CHECK constraint's own list rather than trusted from the form. */
function category(formData: FormData): string {
  const value = text(formData, "category");
  return (NOTE_TYPES as readonly string[]).includes(value) ? value : "general";
}

/**
 * The four scripture columns together, or all four null.
 *
 * An empty book means "no reference" - chapter and verse from the form are
 * ignored in that case rather than saved orphaned, since a chapter number
 * with no book is not a passage.
 */
function scripture(formData: FormData) {
  const book = nullableText(formData, "scripture_book");
  if (!book) {
    return {
      scripture_book: null,
      scripture_chapter: null,
      scripture_verse_start: null,
      scripture_verse_end: null,
    };
  }

  return {
    scripture_book: book,
    scripture_chapter: intOrNull(formData, "scripture_chapter"),
    scripture_verse_start: intOrNull(formData, "scripture_verse_start"),
    scripture_verse_end: intOrNull(formData, "scripture_verse_end"),
  };
}

function intOrNull(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createNote(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const title = text(formData, "title") || "Untitled note";
  const body = noteBody(formData);
  if (!body.ok) {
    return { ok: false, error: "That note's content could not be saved. Try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pastor_notes")
    .insert({
      church_id: session.site.church.id,
      user_id: session.userId,
      title,
      body_json: body.value,
      category: category(formData),
      sermon_id: nullableUuid(formData, "sermon_id"),
      reminder_at: nullableTimestamp(formData, "reminder_at"),
      ...scripture(formData),
    })
    .select("id");

  const outcome = judgeWrite("createNote", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function updateNote(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const id = text(formData, "id");
  if (!id) return { ok: false, error: "That note could not be found." };

  const title = text(formData, "title") || "Untitled note";
  const body = noteBody(formData);
  if (!body.ok) {
    return { ok: false, error: "That note's content could not be saved. Try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pastor_notes")
    .update({
      title,
      body_json: body.value,
      category: category(formData),
      sermon_id: nullableUuid(formData, "sermon_id"),
      reminder_at: nullableTimestamp(formData, "reminder_at"),
      ...scripture(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("updateNote", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/** Real delete - a note has no "taken down but kept" state the way a sermon or group does. */
export async function removeNote(noteId: string): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pastor_notes")
    .delete()
    .eq("id", noteId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("removeNote", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}
