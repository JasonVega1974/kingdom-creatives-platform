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
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * Server Actions for "Announcements"
 * ============================================================
 *
 * Writes public.announcements - the left-hand column of the home page
 * bulletin board.
 *
 * `expires_at` is the reason this tab is not just another list. A church
 * bulletin fills up with notices that were true last month, and nobody enjoys
 * tidying. getAnnouncements() already drops anything past its expiry, so an
 * announcement can be given an end date when it is written and then forgotten
 * about - which is the only way that ever actually happens.
 *
 * Draft 25 confirmed before this was written: a pastor can insert, update and
 * delete, and anon sees visible rows and not hidden ones.
 */

export async function addAnnouncement(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const body = text(formData, "body");
  if (!body) return { ok: false, error: "An announcement needs something to say." };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("announcements")
    .select("sort_order")
    .eq("church_id", session.site.church.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      church_id: session.site.church.id,
      body,
      expires_at: nullableText(formData, "expires_at"),
      posted_by: session.userId,
      visible: false,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id");

  const outcome = judgeWrite("addAnnouncement", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function updateAnnouncement(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const id = text(formData, "id");
  const body = text(formData, "body");

  if (!id) return writeFailed;
  if (!body) return { ok: false, error: "An announcement needs something to say." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .update({
      body,
      expires_at: nullableText(formData, "expires_at"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("updateAnnouncement", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function setAnnouncementVisible(
  announcementId: string,
  visible: boolean,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .update({ visible, updated_at: new Date().toISOString() })
    .eq("id", announcementId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite(
    "setAnnouncementVisible",
    session.site.church.id,
    error,
    data,
  );
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function removeAnnouncement(announcementId: string): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", announcementId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("removeAnnouncement", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/** Swap sort_order with the adjacent row. Two writes, never a renumber. */
export async function moveAnnouncement(
  announcementId: string,
  direction: "up" | "down",
): Promise<TeamState> {
  const session = await requirePortalUser();
  const supabase = await createClient();

  const { data: current, error: currentError } = await supabase
    .from("announcements")
    .select("id, sort_order")
    .eq("id", announcementId)
    .eq("church_id", session.site.church.id)
    .maybeSingle();

  if (currentError || !current) {
    return { ok: false, error: "That announcement could not be found." };
  }

  const base = supabase
    .from("announcements")
    .select("id, sort_order")
    .eq("church_id", session.site.church.id)
    .neq("id", current.id);

  const { data: neighbours, error: neighbourError } =
    direction === "down"
      ? await base
          .gt("sort_order", current.sort_order)
          .order("sort_order", { ascending: true })
          .limit(1)
      : await base
          .lt("sort_order", current.sort_order)
          .order("sort_order", { ascending: false })
          .limit(1);

  if (neighbourError) return writeFailed;

  const neighbour = neighbours?.[0];
  if (!neighbour) return { ok: true, error: null };

  const stamp = { updated_at: new Date().toISOString() };

  const [a, b] = await Promise.all([
    supabase
      .from("announcements")
      .update({ sort_order: neighbour.sort_order, ...stamp })
      .eq("id", current.id)
      .eq("church_id", session.site.church.id)
      .select("id"),
    supabase
      .from("announcements")
      .update({ sort_order: current.sort_order, ...stamp })
      .eq("id", neighbour.id)
      .eq("church_id", session.site.church.id)
      .select("id"),
  ]);

  const outcome = judgeWrite(
    "moveAnnouncement",
    session.site.church.id,
    a.error ?? b.error,
    [...(a.data ?? []), ...(b.data ?? [])],
  );
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}
