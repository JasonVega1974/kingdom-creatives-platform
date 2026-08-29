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
 * Server Actions for "Ministries"
 * ============================================================
 *
 * Writes public.ministries - the list under "Ministries we support" on /about.
 *
 * Structurally identical to Groups. The only difference worth naming is that a
 * ministry is usually somebody else's organisation the church partners with,
 * so `website_url` points off-site and there is no meeting time.
 *
 * `logo_url` is a plain text column - ministries was NOT given a media_id in
 * draft 23, because a partner's logo usually arrives as a URL from their own
 * site rather than as a file the pastor uploads. If that turns out to be wrong
 * it is one more composite FK, the same shape as the other four.
 *
 * Draft 25 confirmed before this was written: a pastor can insert, update and
 * delete, and anon sees visible rows and not hidden ones.
 */

export async function addMinistry(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const name = text(formData, "name");
  if (!name) return { ok: false, error: "A ministry needs a name." };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("ministries")
    .select("sort_order")
    .eq("church_id", session.site.church.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("ministries")
    .insert({
      church_id: session.site.church.id,
      name,
      description: nullableText(formData, "description"),
      website_url: nullableText(formData, "website_url"),
      logo_url: nullableText(formData, "logo_url"),
      visible: false,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id");

  const outcome = judgeWrite("addMinistry", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function updateMinistry(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const id = text(formData, "id");
  const name = text(formData, "name");

  if (!id) return writeFailed;
  if (!name) return { ok: false, error: "A ministry needs a name." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ministries")
    .update({
      name,
      description: nullableText(formData, "description"),
      website_url: nullableText(formData, "website_url"),
      logo_url: nullableText(formData, "logo_url"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("updateMinistry", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function setMinistryVisible(
  ministryId: string,
  visible: boolean,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ministries")
    .update({ visible, updated_at: new Date().toISOString() })
    .eq("id", ministryId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("setMinistryVisible", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function removeMinistry(ministryId: string): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ministries")
    .delete()
    .eq("id", ministryId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("removeMinistry", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function moveMinistry(
  ministryId: string,
  direction: "up" | "down",
): Promise<TeamState> {
  const session = await requirePortalUser();
  const supabase = await createClient();

  const { data: current, error: currentError } = await supabase
    .from("ministries")
    .select("id, sort_order")
    .eq("id", ministryId)
    .eq("church_id", session.site.church.id)
    .maybeSingle();

  if (currentError || !current) {
    return { ok: false, error: "That ministry could not be found." };
  }

  const base = supabase
    .from("ministries")
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
      .from("ministries")
      .update({ sort_order: neighbour.sort_order, ...stamp })
      .eq("id", current.id)
      .eq("church_id", session.site.church.id)
      .select("id"),
    supabase
      .from("ministries")
      .update({ sort_order: current.sort_order, ...stamp })
      .eq("id", neighbour.id)
      .eq("church_id", session.site.church.id)
      .select("id"),
  ]);

  const outcome = judgeWrite(
    "moveMinistry",
    session.site.church.id,
    a.error ?? b.error,
    [...(a.data ?? []), ...(b.data ?? [])],
  );
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}
