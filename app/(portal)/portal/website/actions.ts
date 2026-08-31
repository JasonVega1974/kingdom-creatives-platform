"use server";

import { revalidatePath, updateTag } from "next/cache";

import { churchTag } from "@/lib/church";
import { requirePortalUser } from "@/lib/portal/auth";
import { textToField, wouldFlatten } from "@/lib/portal/field-values";
import type { SaveState } from "@/lib/portal/form-state";
import { findSection } from "@/lib/portal/sections";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Server Actions for "Edit My Website".
 *
 * Every one of them re-asserts access with requirePortalUser(). A Server
 * Action is a public POST endpoint - the layout having checked earlier in the
 * render is irrelevant to a request that arrives straight here.
 *
 * All writes are scoped by church_id from the SERVER-resolved session, never
 * from the form. The client sends a section id; it does not get to say which
 * church that id belongs to. RLS enforces the same rule underneath.
 */

// SaveState and SAVE_IDLE live in lib/portal/form-state.ts - see the note
// there. A value export from a "use server" file kills every action in it.

/**
 * Push the change to the live public site immediately.
 *
 * The prototype promises "Saved and live on the website" with no waiting, so
 * the 60s revalidate window on getChurchSite() is not good enough.
 *
 * updateTag, not revalidateTag: revalidateTag is stale-while-revalidate, which
 * would show the pastor their OLD text on the next page load and the new text
 * some time after. updateTag expires immediately and is Server-Action-only,
 * which is exactly this call site. revalidatePath then clears the rendered
 * public routes that embedded the old payload.
 */
function publish(slug: string): void {
  updateTag(churchTag(slug));
  revalidatePath("/", "layout");
}

/** Show or hide one section on the public site. */
export async function setSectionVisible(
  sectionId: string,
  visible: boolean,
): Promise<SaveState> {
  const session = await requirePortalUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("church_sections")
    .update({
      visible,
      updated_at: new Date().toISOString(),
      updated_by: session.userId,
    })
    .eq("id", sectionId)
    .eq("church_id", session.site.church.id);

  if (error) {
    return { ok: false, error: "That did not save. Try again in a moment.", savedAt: null };
  }

  publish(session.site.church.slug);
  return { ok: true, error: null, savedAt: Date.now() };
}

/**
 * Save edited text for one section.
 *
 * `values` is merged into the existing content object rather than replacing
 * it. The editor only renders fields the registry describes, so a replace
 * would silently drop everything else the section carries - seeded FAQ arrays,
 * timeline entries, image paths. Merge keeps the unedited remainder intact.
 *
 * Only keys the registry declares for this section are accepted. Without that
 * filter the action is an arbitrary-jsonb-write endpoint for any member.
 */
export async function saveSectionContent(
  sectionId: string,
  pageSlug: string,
  sectionKey: string,
  values: Record<string, string>,
): Promise<SaveState> {
  const session = await requirePortalUser();

  const def = findSection(pageSlug, sectionKey);
  if (!def?.fields?.length) {
    return { ok: false, error: "That section has no editable text.", savedAt: null };
  }

  const kinds = new Map(def.fields.map((f) => [f.key, f.kind]));

  // Box text -> stored value, per field kind. Getting this wrong destroys
  // content rather than merely mis-saving it, so the conversion and its
  // inverse live together in field-values.ts. See FF-48.
  const clean: Record<string, Json> = {};
  for (const [key, value] of Object.entries(values)) {
    const kind = kinds.get(key);
    if (kind === undefined) continue;
    clean[key] = textToField(value, kind);
  }

  if (Object.keys(clean).length === 0) {
    return { ok: false, error: "Nothing to save.", savedAt: null };
  }

  const supabase = await createClient();

  // Read-modify-write. Two people editing the same section in the same second
  // could lose one field; a jsonb merge in SQL would fix it properly, and that
  // is a schema change (a function), so it is drafted separately rather than
  // done here. Single-pastor churches will not hit it - noted so it is a known
  // limit rather than a surprise.
  const { data: existing, error: readError } = await supabase
    .from("church_sections")
    .select("content")
    .eq("id", sectionId)
    .eq("church_id", session.site.church.id)
    .maybeSingle();

  if (readError || !existing) {
    return { ok: false, error: "That section could not be found.", savedAt: null };
  }

  // Anything that is not a plain object (null, an array, a bare string) is
  // treated as empty rather than merged into - spreading an array would
  // produce numeric keys and quietly corrupt the section.
  const current =
    existing.content && typeof existing.content === "object" && !Array.isArray(existing.content)
      ? (existing.content as Record<string, Json | undefined>)
      : {};

  /*
   * LAST LINE OF DEFENCE. Even with the registry correct, a future field could
   * be declared scalar over a key stored as a list or an object - and the
   * failure mode is silent content loss, which is the worst kind to ship.
   *
   * So a write that would replace a list or an object with a plain string is
   * refused here rather than performed. It costs one comparison per field and
   * it means this class of bug can only ever be a save that did not happen,
   * never a page that quietly emptied.
   */
  for (const [key, incoming] of Object.entries(clean)) {
    if (wouldFlatten(current[key], incoming)) {
      console.error(
        `[portal] refused to overwrite structured "${key}" on ${pageSlug}.${sectionKey} with a plain value - the field kind and the stored shape disagree`,
      );
      return {
        ok: false,
        error:
          "That part of the page holds a list, and this box would have replaced it with plain text. Nothing was saved - please tell Kingdom Creatives.",
        savedAt: null,
      };
    }
  }

  const { error } = await supabase
    .from("church_sections")
    .update({
      content: { ...current, ...clean } as Json,
      updated_at: new Date().toISOString(),
      updated_by: session.userId,
    })
    .eq("id", sectionId)
    .eq("church_id", session.site.church.id);

  if (error) {
    return { ok: false, error: "That did not save. Try again in a moment.", savedAt: null };
  }

  publish(session.site.church.slug);
  return { ok: true, error: null, savedAt: Date.now() };
}

/**
 * Move one section up or down within its page.
 *
 * Swaps sort_order with its neighbour rather than renumbering the page, so a
 * failed second write leaves a duplicate ordering (harmless - the list is
 * sorted by sort_order then key) instead of a page where everything collapsed
 * to the same position.
 */
export async function moveSection(
  sectionId: string,
  direction: "up" | "down",
): Promise<SaveState> {
  const session = await requirePortalUser();
  const supabase = await createClient();

  const { data: current, error: currentError } = await supabase
    .from("church_sections")
    .select("id, page_slug, sort_order")
    .eq("id", sectionId)
    .eq("church_id", session.site.church.id)
    .maybeSingle();

  if (currentError || !current) {
    return { ok: false, error: "That section could not be found.", savedAt: null };
  }

  // The adjacent section in the chosen direction: for "down" the smallest
  // sort_order above this one, for "up" the largest below it. Strict
  // comparison - a tie would otherwise pick this same row back out.
  const base = supabase
    .from("church_sections")
    .select("id, sort_order")
    .eq("church_id", session.site.church.id)
    .eq("page_slug", current.page_slug)
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

  if (neighbourError) {
    return { ok: false, error: "That did not save. Try again in a moment.", savedAt: null };
  }

  const neighbour = neighbours?.[0];
  // Already at the end. Not an error - the buttons are disabled there anyway.
  if (!neighbour) return { ok: true, error: null, savedAt: Date.now() };

  const stamp = { updated_at: new Date().toISOString(), updated_by: session.userId };

  const [{ error: aError }, { error: bError }] = await Promise.all([
    supabase
      .from("church_sections")
      .update({ sort_order: neighbour.sort_order, ...stamp })
      .eq("id", current.id)
      .eq("church_id", session.site.church.id),
    supabase
      .from("church_sections")
      .update({ sort_order: current.sort_order, ...stamp })
      .eq("id", neighbour.id)
      .eq("church_id", session.site.church.id),
  ]);

  if (aError || bError) {
    return { ok: false, error: "That did not save. Try again in a moment.", savedAt: null };
  }

  publish(session.site.church.slug);
  return { ok: true, error: null, savedAt: Date.now() };
}
