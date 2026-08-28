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
 * Server Actions for "Groups & Studies"
 * ============================================================
 *
 * Writes public.groups - the list on /groups.
 *
 * `location_type` drives the public filter strip, which is seeded with `phone`,
 * `video` and `in_person`. A value outside that set makes a group unreachable
 * from the filters even while it is visible, so the tab offers a picker rather
 * than free text - same reasoning as event_type.
 *
 * `frequency` and `location_type` are both NOT NULL with no default, so both
 * are always written. Draft 22's probe used 'weekly' and 'video' and both were
 * accepted.
 *
 * Ordered by sort_order rather than a date: unlike sermons, a groups list has
 * no natural chronology, and a pastor putting the newcomers' study first is
 * making an editorial choice the page should keep.
 */

export async function addGroup(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const name = text(formData, "name");
  if (!name) return { ok: false, error: "A group needs a name." };

  const supabase = await createClient();

  // New groups go last. max + 1, so a gap left by a deletion never collides.
  const { data: last } = await supabase
    .from("groups")
    .select("sort_order")
    .eq("church_id", session.site.church.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("groups")
    .insert({
      church_id: session.site.church.id,
      name,
      description: nullableText(formData, "description"),
      leader_name: nullableText(formData, "leader_name"),
      meeting_day: nullableText(formData, "meeting_day"),
      meeting_time: nullableText(formData, "meeting_time"),
      meeting_tz: nullableText(formData, "meeting_tz"),
      meeting_link: nullableText(formData, "meeting_link"),
      location_detail: nullableText(formData, "location_detail"),
      location_type: text(formData, "location_type") || "in_person",
      frequency: text(formData, "frequency") || "weekly",
      visible: false,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id");

  const outcome = judgeWrite("addGroup", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function updateGroup(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const id = text(formData, "id");
  const name = text(formData, "name");

  if (!id) return writeFailed;
  if (!name) return { ok: false, error: "A group needs a name." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .update({
      name,
      description: nullableText(formData, "description"),
      leader_name: nullableText(formData, "leader_name"),
      meeting_day: nullableText(formData, "meeting_day"),
      meeting_time: nullableText(formData, "meeting_time"),
      meeting_tz: nullableText(formData, "meeting_tz"),
      meeting_link: nullableText(formData, "meeting_link"),
      location_detail: nullableText(formData, "location_detail"),
      location_type: text(formData, "location_type") || "in_person",
      frequency: text(formData, "frequency") || "weekly",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("updateGroup", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function setGroupVisible(
  groupId: string,
  visible: boolean,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .update({ visible, updated_at: new Date().toISOString() })
    .eq("id", groupId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("setGroupVisible", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function removeGroup(groupId: string): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("removeGroup", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/** Swap sort_order with the adjacent row. Two writes, never a renumber. */
export async function moveGroup(
  groupId: string,
  direction: "up" | "down",
): Promise<TeamState> {
  const session = await requirePortalUser();
  const supabase = await createClient();

  const { data: current, error: currentError } = await supabase
    .from("groups")
    .select("id, sort_order")
    .eq("id", groupId)
    .eq("church_id", session.site.church.id)
    .maybeSingle();

  if (currentError || !current) {
    return { ok: false, error: "That group could not be found." };
  }

  const base = supabase
    .from("groups")
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
  // Already at the end. Not an error - the button is disabled there anyway.
  if (!neighbour) return { ok: true, error: null };

  const stamp = { updated_at: new Date().toISOString() };

  const [a, b] = await Promise.all([
    supabase
      .from("groups")
      .update({ sort_order: neighbour.sort_order, ...stamp })
      .eq("id", current.id)
      .eq("church_id", session.site.church.id)
      .select("id"),
    supabase
      .from("groups")
      .update({ sort_order: current.sort_order, ...stamp })
      .eq("id", neighbour.id)
      .eq("church_id", session.site.church.id)
      .select("id"),
  ]);

  const outcome = judgeWrite("moveGroup", session.site.church.id, a.error ?? b.error, [
    ...(a.data ?? []),
    ...(b.data ?? []),
  ]);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}
