"use server";

import { revalidatePath, updateTag } from "next/cache";

import { churchTag } from "@/lib/church";
import { requirePortalUser } from "@/lib/portal/auth";
import type { TeamState } from "@/lib/portal/form-state";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * Server Actions for "Our Team"
 * ============================================================
 *
 * Writes public.staff - the people on the /team page. The first Phase C tab
 * that manages a collection rather than a single row, so it sets the pattern
 * the Sermon Library, Events and Groups tabs follow.
 *
 * Every action re-asserts access with requirePortalUser(). A Server Action is a
 * public POST endpoint that never passes through a page's check.
 *
 * Every write is scoped by church_id from the SERVER-resolved session, never
 * from the form, and every query carries `.eq("church_id", ...)` alongside the
 * row id. RLS enforces the same rule underneath; the explicit filter is belt
 * and braces and is also what makes the query use the index.
 *
 * Write outcomes are judged with .select() per FF-27: an UPDATE or DELETE that
 * RLS filters out is not an error, so checking `error` alone cannot tell a save
 * from a silent refusal. That read-back is safe here because a pastor can read
 * every staff row through `staff+ can view staff`, including hidden ones -
 * unlike the public forms, where the writer deliberately cannot read what it
 * wrote (see app/(public)/actions.ts).
 *
 * Draft 22 confirmed all three operations reach the table as a pastor, and that
 * a hidden row stays invisible to anon, before any of this was written.
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

/** Nullable text column: an emptied box means NULL, not "". */
function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

/**
 * Add a person.
 *
 * New people arrive HIDDEN. A pastor half-way through typing a bio should not
 * have a stub appear on the public site, and the visible toggle is right there
 * to publish when ready. Draft 22 section 3 confirmed the public policy honours
 * that flag, so hidden really is hidden.
 */
export async function addPerson(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const name = text(formData, "name");
  if (!name) {
    return { ok: false, error: "A name is needed to add someone." };
  }

  const supabase = await createClient();

  // New people go to the end of the list. max + 1 rather than count, so a gap
  // left by a deletion never causes a collision.
  const { data: last } = await supabase
    .from("staff")
    .select("sort_order")
    .eq("church_id", session.site.church.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("staff")
    .insert({
      church_id: session.site.church.id,
      name,
      role_title: nullableText(formData, "role_title"),
      bio: nullableText(formData, "bio"),
      email: nullableText(formData, "email"),
      phone: nullableText(formData, "phone"),
      photo_url: nullableText(formData, "photo_url"),
      visible: false,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id");

  const outcome = judge("addPerson", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publish(session.site.church.slug);
  return { ok: true, error: null };
}

export async function updatePerson(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const id = text(formData, "id");
  const name = text(formData, "name");

  if (!id) return { ok: false, error: WRITE_FAILED };
  if (!name) return { ok: false, error: "A name is needed." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .update({
      name,
      role_title: nullableText(formData, "role_title"),
      bio: nullableText(formData, "bio"),
      email: nullableText(formData, "email"),
      phone: nullableText(formData, "phone"),
      photo_url: nullableText(formData, "photo_url"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judge("updatePerson", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publish(session.site.church.slug);
  return { ok: true, error: null };
}

/** Show or hide a person on the public page. */
export async function setPersonVisible(
  personId: string,
  visible: boolean,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .update({ visible, updated_at: new Date().toISOString() })
    .eq("id", personId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judge("setPersonVisible", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publish(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Remove a person.
 *
 * A real delete, not a soft one. `visible` already covers "take them off the
 * site but keep the record", so a second, invisible kind of hidden would only
 * be confusing - and a pastor who presses Remove means remove.
 */
export async function removePerson(personId: string): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .delete()
    .eq("id", personId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judge("removePerson", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publish(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Move a person up or down the list.
 *
 * Swaps sort_order with the adjacent row rather than renumbering everything:
 * two writes instead of N, and no chance of a partial renumber leaving the list
 * scrambled. Same approach as moveSection in the website tab.
 */
export async function movePerson(
  personId: string,
  direction: "up" | "down",
): Promise<TeamState> {
  const session = await requirePortalUser();
  const supabase = await createClient();

  const { data: current, error: currentError } = await supabase
    .from("staff")
    .select("id, sort_order")
    .eq("id", personId)
    .eq("church_id", session.site.church.id)
    .maybeSingle();

  if (currentError || !current) {
    return { ok: false, error: "That person could not be found." };
  }

  // Strict comparison so a tie cannot select this same row back out.
  const base = supabase
    .from("staff")
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

  if (neighbourError) return { ok: false, error: WRITE_FAILED };

  const neighbour = neighbours?.[0];
  // Already at the end. Not an error - the button is disabled there anyway.
  if (!neighbour) return { ok: true, error: null };

  const stamp = { updated_at: new Date().toISOString() };

  const [a, b] = await Promise.all([
    supabase
      .from("staff")
      .update({ sort_order: neighbour.sort_order, ...stamp })
      .eq("id", current.id)
      .eq("church_id", session.site.church.id)
      .select("id"),
    supabase
      .from("staff")
      .update({ sort_order: current.sort_order, ...stamp })
      .eq("id", neighbour.id)
      .eq("church_id", session.site.church.id)
      .select("id"),
  ]);

  const outcome = judge("movePerson", session.site.church.id, a.error ?? b.error, [
    ...(a.data ?? []),
    ...(b.data ?? []),
  ]);
  if (!outcome.ok) return outcome;

  publish(session.site.church.slug);
  return { ok: true, error: null };
}
