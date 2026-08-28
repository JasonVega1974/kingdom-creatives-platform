"use server";

import { requirePortalUser } from "@/lib/portal/auth";
import {
  judgeWrite,
  nullableText,
  publishChange,
  text,
  writeFailed,
} from "@/lib/portal/collection-write";
import type { TeamState } from "@/lib/portal/form-state";
import { MEDIA_BUCKET, pathBelongsTo } from "@/lib/portal/media";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * Server Actions for "Photos" - the media library
 * ============================================================
 *
 * The FILE is uploaded straight from the browser to Supabase Storage, not
 * through these actions. Two reasons, and the second is the real one:
 *
 *   - a resized photo is still a few hundred KB, and routing it through a
 *     Server Action means encoding it into a request body for no gain;
 *   - the storage policies from draft 23 already enforce the tenant boundary
 *     on the path, so the browser upload is checked by the database exactly
 *     as a server upload would be.
 *
 * What the browser CANNOT be trusted with is the church_media row. `church_id`
 * there comes from the server-resolved session, never the client, and
 * recordUpload() additionally refuses a path that does not start with that
 * church's id - so a row can never describe a file the church does not own.
 */

/**
 * Record a file the browser has already uploaded.
 *
 * Called immediately after the storage upload succeeds. If this fails, the file
 * is in the bucket with no row pointing at it - invisible to the library and
 * costing storage. That is the better failure direction than a row pointing at
 * a file that is not there, which renders as a broken image on the public site.
 * FF-41 tracks sweeping those orphans.
 */
export async function recordUpload(input: {
  storagePath: string;
  title: string;
  width: number;
  height: number;
  byteSize: number;
  mimeType: string;
}): Promise<TeamState> {
  const session = await requirePortalUser();

  // The storage policy already refused a path outside this church, but the
  // ROW is a separate write and gets its own check rather than inheriting
  // that one's result.
  if (!pathBelongsTo(input.storagePath, session.site.church.id)) {
    console.error(
      `[portal] recordUpload rejected path "${input.storagePath}" for church ${session.site.church.id}`,
    );
    return writeFailed;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("church_media")
    .insert({
      church_id: session.site.church.id,
      storage_path: input.storagePath,
      title: input.title.trim() || null,
      width: input.width,
      height: input.height,
      byte_size: input.byteSize,
      mime_type: input.mimeType,
      uploaded_by: session.userId,
    })
    .select("id");

  const outcome = judgeWrite("recordUpload", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Rename a photo, describe it, or put it in the public gallery.
 *
 * Only these columns are editable - draft 23 section 5 revoked UPDATE on
 * everything else, so an attempt to move a row to another church or re-point it
 * at another file is refused by the database, not just by this function.
 */
export async function updateMedia(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const id = text(formData, "id");
  if (!id) return writeFailed;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("church_media")
    .update({
      title: nullableText(formData, "title"),
      alt_text: nullableText(formData, "alt_text"),
      in_gallery: formData.get("in_gallery") != null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("updateMedia", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/** Show or hide a photo in the public gallery. */
export async function setInGallery(
  mediaId: string,
  inGallery: boolean,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("church_media")
    .update({ in_gallery: inGallery, updated_at: new Date().toISOString() })
    .eq("id", mediaId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("setInGallery", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Where a photo is currently used.
 *
 * Read before offering to delete, so the confirm can say "used by 2 things"
 * rather than asking blind. The composite FKs are ON DELETE SET NULL, so
 * deleting is safe either way - this exists to stop a pastor removing the event
 * photo without realising, not to prevent it.
 */
export async function mediaUsage(mediaId: string): Promise<{
  events: number;
  staff: number;
  groups: number;
  logo: number;
}> {
  const session = await requirePortalUser();
  const supabase = await createClient();
  const churchId = session.site.church.id;

  const count = async (
    table: "events" | "staff" | "groups",
  ): Promise<number> => {
    const { count: n } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("church_id", churchId)
      .eq("media_id", mediaId);
    return n ?? 0;
  };

  const [events, staff, groups, theme] = await Promise.all([
    count("events"),
    count("staff"),
    count("groups"),
    supabase
      .from("church_theme")
      .select("church_id", { count: "exact", head: true })
      .eq("church_id", churchId)
      .eq("logo_media_id", mediaId),
  ]);

  return { events, staff, groups, logo: theme.count ?? 0 };
}

/**
 * Delete a photo: the row first, then the file.
 *
 * That order is deliberate. If the row goes and the file removal fails, the
 * result is an orphaned file - invisible, costing a little storage, sweepable
 * later (FF-41). The other order risks a row pointing at a file that no longer
 * exists, which renders as a broken image on the public site.
 *
 * The composite FKs are ON DELETE SET NULL, so anything using this photo keeps
 * its own row and simply loses the image.
 */
export async function removeMedia(mediaId: string): Promise<TeamState> {
  const session = await requirePortalUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("church_media")
    .delete()
    .eq("id", mediaId)
    .eq("church_id", session.site.church.id)
    .select("id, storage_path");

  const outcome = judgeWrite("removeMedia", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  const storagePath = data?.[0]?.storage_path;
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([storagePath]);

    // Logged, not surfaced. The photo is gone from the library and from every
    // page that used it, which is what the pastor asked for; a leftover file
    // they cannot see is not their problem to action.
    if (storageError) {
      console.error(
        `[portal] orphaned storage object "${storagePath}" for church ${session.site.church.slug}: ${storageError.message}`,
      );
    }
  }

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}
