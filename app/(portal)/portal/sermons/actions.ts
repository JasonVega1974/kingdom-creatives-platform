"use server";

import { revalidatePath, updateTag } from "next/cache";

import { churchTag } from "@/lib/church";
import { requirePortalUser } from "@/lib/portal/auth";
import { SERMON_STATUSES, type TeamState } from "@/lib/portal/form-state";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * Server Actions for "Sermon Library"
 * ============================================================
 *
 * Writes public.sermons - the messages on the /sermons page and the one shown
 * on the home page.
 *
 * SAME PATTERN AS OUR TEAM, with one real difference: publishing is not a
 * boolean here. `sermons.status` is 'draft | published | archived' per the
 * column comment in migration 01, and the public policy from draft 20 admits
 * 'published' only. So a sermon has three states, not two, and a checkbox
 * cannot express that - the tab uses a three-way picker instead.
 *
 * 'archived' means withdrawn from the site while keeping the record. It is NOT
 * publicly readable: that was settled 2026-08-28 as the restrictive choice, on
 * the grounds that republishing something deliberately retired is worse than
 * having to un-archive it.
 *
 * NOT EDITED HERE: body, devotional, kids_lesson, small_group_questions,
 * social_posts, bulletin_notes and slide_content. Those are Sermon Builder
 * outputs and belong to that tab; showing seven empty rich-text boxes in a
 * library listing would bury the fields a pastor actually fills in. They are
 * left untouched by every update below rather than being blanked.
 */

const WRITE_FAILED = "That did not save. Try again in a moment.";
const WRITE_REFUSED =
  "That did not save. Your account is not allowed to change this - nothing was written. Please contact Kingdom Creatives.";

function judge(
  what: string,
  churchId: string,
  error: { message: string } | null,
  rows: unknown[] | null,
): TeamState {
  if (error) {
    console.error(`[portal] ${what} failed for church ${churchId}: ${error.message}`);
    return { ok: false, error: WRITE_FAILED };
  }
  if (!rows || rows.length === 0) {
    console.error(
      `[portal] ${what} for church ${churchId} affected 0 rows - RLS refused the write, or the row is gone.`,
    );
    return { ok: false, error: WRITE_REFUSED };
  }
  return { ok: true, error: null };
}

function publish(slug: string): void {
  updateTag(churchTag(slug));
  revalidatePath("/", "layout");
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

/** Minutes as a positive integer, or null. A blank box is not a zero. */
function nullableMinutes(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * A YouTube video id, from an id or any of the URL shapes people actually
 * paste.
 *
 * A pastor copying from the address bar gets a full watch URL; from the Share
 * button, a youtu.be link; from an embed, /embed/. All three are the same
 * eleven-character id, and asking someone to extract it by hand is how you get
 * a library half-full of broken links.
 *
 * Anything that does not yield a plausible id returns null rather than storing
 * a URL in a column the player will treat as an id.
 */
function youtubeId(formData: FormData): string | null {
  const raw = text(formData, "youtube_id");
  if (raw === "") return null;

  const ID = /^[A-Za-z0-9_-]{11}$/;
  if (ID.test(raw)) return raw;

  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
    /\/live\/([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Add a sermon.
 *
 * Arrives as 'draft', so a pastor pasting a title before the video is ready
 * does not put a half-entry on the public page. Same reasoning as new team
 * members arriving hidden.
 */
export async function addSermon(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const title = text(formData, "title");
  if (!title) return { ok: false, error: "A sermon needs a title." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sermons")
    .insert({
      church_id: session.site.church.id,
      title,
      series: nullableText(formData, "series"),
      scripture_ref: nullableText(formData, "scripture_ref"),
      summary: nullableText(formData, "summary"),
      preached_at: nullableText(formData, "preached_at"),
      duration_min: nullableMinutes(formData, "duration_min"),
      youtube_id: youtubeId(formData),
      status: "draft",
      created_by: session.userId,
    })
    .select("id");

  const outcome = judge("addSermon", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publish(session.site.church.slug);
  return { ok: true, error: null };
}

export async function updateSermon(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const id = text(formData, "id");
  const title = text(formData, "title");

  if (!id) return { ok: false, error: WRITE_FAILED };
  if (!title) return { ok: false, error: "A sermon needs a title." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sermons")
    .update({
      title,
      series: nullableText(formData, "series"),
      scripture_ref: nullableText(formData, "scripture_ref"),
      summary: nullableText(formData, "summary"),
      preached_at: nullableText(formData, "preached_at"),
      duration_min: nullableMinutes(formData, "duration_min"),
      youtube_id: youtubeId(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judge("updateSermon", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publish(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Move a sermon between draft, published and archived.
 *
 * `published_at` is stamped the first time a sermon goes public and never
 * cleared afterwards. It records when it first appeared, which is a different
 * fact from `preached_at` (when it was delivered) and from whether it is on the
 * site right now. Un-publishing and re-publishing should not rewrite history.
 */
export async function setSermonStatus(
  sermonId: string,
  next: string,
): Promise<TeamState> {
  const session = await requirePortalUser();

  if (!(SERMON_STATUSES as readonly string[]).includes(next)) {
    return { ok: false, error: WRITE_FAILED };
  }

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("sermons")
    .select("published_at")
    .eq("id", sermonId)
    .eq("church_id", session.site.church.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("sermons")
    .update({
      status: next,
      published_at:
        next === "published" && !current?.published_at
          ? new Date().toISOString()
          : (current?.published_at ?? null),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sermonId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judge("setSermonStatus", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publish(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Remove a sermon permanently.
 *
 * Distinct from archiving, which is the reversible option and is what the
 * status picker offers. Delete is for a row entered by mistake.
 */
export async function removeSermon(sermonId: string): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sermons")
    .delete()
    .eq("id", sermonId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judge("removeSermon", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publish(session.site.church.slug);
  return { ok: true, error: null };
}
