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
 * Server Actions for the Links panel in "Church Details"
 * ============================================================
 *
 * Writes public.church_links - the giving link, the YouTube channels and the
 * social links.
 *
 * WHY THIS EXISTS AT ALL. Draft 10 seeded these rows in August and nothing has
 * been able to change them since. The pastor could not fix his own Give
 * button, rename a channel, or update a Facebook group URL. That is three
 * facts he owns and could not touch.
 *
 * NOT a "Giving" tab. The prototype's Giving screen is a Tithe.ly/Stripe mode
 * switch whose gift list is explicitly a Stripe feature - "Gifts happen right
 * on your website, and every gift shows up in the list on this page" - and
 * FF-32 decided Tithe.ly. gifts is empty and has no data source, so a gift
 * report would be permanently blank and read as broken rather than
 * unimplemented. See docs/FAST_FOLLOW.md FF-32 and draft 25 section 4.
 *
 * `kind` is constrained by a CHECK on the table to social | video | giving, so
 * a bad value is refused by the database rather than only by this file.
 */

/** The three kinds church_links accepts, per its CHECK constraint. */
const KINDS = ["social", "video", "giving"] as const;

function kind(formData: FormData): string | null {
  const value = text(formData, "kind");
  return (KINDS as readonly string[]).includes(value) ? value : null;
}

export async function addLink(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const linkKind = kind(formData);
  const label = text(formData, "label");
  const url = text(formData, "url");

  if (!linkKind) return writeFailed;
  if (!label) return { ok: false, error: "Give the link a name." };
  if (!url) return { ok: false, error: "A link needs a web address." };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("church_links")
    .select("sort_order")
    .eq("church_id", session.site.church.id)
    .eq("kind", linkKind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("church_links")
    .insert({
      church_id: session.site.church.id,
      kind: linkKind,
      platform: text(formData, "platform") || "other",
      label,
      url,
      external_id: nullableText(formData, "external_id"),
      sort_order: (last?.sort_order ?? 0) + 1,
      is_primary: false,
    })
    .select("id");

  const outcome = judgeWrite("addLink", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function updateLink(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const id = text(formData, "id");
  const label = text(formData, "label");
  const url = text(formData, "url");

  if (!id) return writeFailed;
  if (!label) return { ok: false, error: "Give the link a name." };
  if (!url) return { ok: false, error: "A link needs a web address." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("church_links")
    .update({
      label,
      url,
      external_id: nullableText(formData, "external_id"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("updateLink", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Mark a link as the one to use, within its kind.
 *
 * A church may have a Tithe.ly form and a PayPal fallback; only one belongs on
 * the Give button, and `givingLink()` prefers the primary. The table has a
 * partial unique index on (church_id, kind) where is_primary, so a second
 * primary is refused by the database - which is why the old one is cleared
 * first rather than both being set and hoping.
 */
export async function setLinkPrimary(linkId: string): Promise<TeamState> {
  const session = await requirePortalUser();
  const supabase = await createClient();

  const { data: target, error: targetError } = await supabase
    .from("church_links")
    .select("id, kind")
    .eq("id", linkId)
    .eq("church_id", session.site.church.id)
    .maybeSingle();

  if (targetError || !target) {
    return { ok: false, error: "That link could not be found." };
  }

  // Clear the current primary of this kind BEFORE setting the new one, or the
  // partial unique index refuses the write.
  const { error: clearError } = await supabase
    .from("church_links")
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq("church_id", session.site.church.id)
    .eq("kind", target.kind)
    .eq("is_primary", true);

  if (clearError) return writeFailed;

  const { data, error } = await supabase
    .from("church_links")
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("setLinkPrimary", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Remove a link.
 *
 * A video channel may be referenced by sermons through church_link_id, which is
 * ON DELETE SET NULL (draft 11) - so removing a channel orphans its sermons
 * rather than deleting them. Worth knowing before pressing it, which the
 * confirm says.
 */
export async function removeLink(linkId: string): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("church_links")
    .delete()
    .eq("id", linkId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("removeLink", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}
