import "server-only";

import { unstable_cache } from "next/cache";

import { churchTag } from "@/lib/church";
import { createPublicClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

/**
 * ============================================================
 * PUBLIC SECTION DATA - church_sections for one page
 * ============================================================
 *
 * The read side of what the portal's "Edit My Website" tab writes. Phase B's
 * acceptance criterion is "content renders 100% from DB", and this is where
 * that content arrives.
 *
 * Cached and tagged exactly like getChurchSite(), for the same reasons: this
 * runs on every public page view, and a portal save has to show up immediately.
 * `publish()` in the portal actions calls revalidatePath("/", "layout"), which
 * clears this alongside the church row. (It also calls updateTag, which is a
 * no-op against unstable_cache - see FF-29. The revalidatePath is what works.)
 *
 * Uses the session-less public client: a cached function body must not read
 * cookies, and section content is anon-readable by design - that is how the
 * public site renders at all.
 */

export type SectionRow = {
  id: string;
  section_key: string;
  content: Json;
  sort_order: number;
};

type Row = Pick<
  Database["public"]["Tables"]["church_sections"]["Row"],
  "id" | "section_key" | "content" | "sort_order"
>;

/**
 * Visible sections for one church page, in render order.
 *
 * Only `visible = true` rows come back. The portal's per-section toggle is the
 * single source of "is this on", so hidden sections are filtered here rather
 * than being rendered and hidden with CSS - a section a pastor turned off
 * should not be in the HTML at all.
 *
 * Returns [] for a page with no rows, which is a legitimate state, not an
 * error: see the devotionals case in FF-30.
 */
export function getPageSections(
  slug: string,
  churchId: string,
  pageSlug: string,
): Promise<SectionRow[]> {
  return unstable_cache(
    async (): Promise<SectionRow[]> => {
      const supabase = createPublicClient();

      const { data, error } = await supabase
        .from("church_sections")
        .select("id, section_key, content, sort_order")
        .eq("church_id", churchId)
        .eq("page_slug", pageSlug)
        .eq("visible", true)
        .order("sort_order", { ascending: true });

      // Throw rather than return []: unstable_cache does not store a rejected
      // promise, so a blip stays scoped to this request instead of caching an
      // empty page for the whole revalidate window. An empty page and a failed
      // lookup look identical to a visitor and must not be conflated - the
      // same rule getChurchSite() follows.
      if (error) {
        throw new Error(
          `section lookup failed for "${slug}" page "${pageSlug}": ${error.message}`,
        );
      }

      return (data ?? []) as Row[];
    },
    ["church-sections", slug, pageSlug],
    { tags: [churchTag(slug)], revalidate: 60 },
  )();
}

/**
 * Narrow a section's jsonb `content` to a string map without trusting it.
 *
 * The column is jsonb and nothing at the database level guarantees its shape.
 * Draft 04 seeds objects, and the portal editor only ever writes objects, but
 * a hand-edited row could hold an array, a string or null. Renderers read
 * fields through this so a malformed row renders empty instead of throwing and
 * taking the whole page down with it.
 */
export function sectionContent(content: Json): Record<string, string> {
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    return {};
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(content)) {
    if (typeof value === "string") out[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value);
    }
    // Nested objects and arrays are left out on purpose. A renderer that needs
    // one (faq, timeline, beliefs - all step 2) reads `content` directly and
    // validates its own shape, rather than this flattening it wrongly.
  }
  return out;
}

/**
 * ============================================================
 * TYPED READERS for section content
 * ============================================================
 *
 * sectionContent() above flattens to strings and is right for simple
 * text sections. The seed is richer than that - draft 04 stores lists of
 * objects (faq items, timeline stops, stat tiles) and nested objects (link
 * targets), and a renderer needs those without asserting a shape the database
 * does not enforce.
 *
 * Each reader returns a safe empty value rather than throwing. A malformed row
 * costs one section, never the page.
 */

/** A string field, or null when absent or the wrong type. */
export function str(content: Json, key: string): string | null {
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    return null;
  }
  const value = (content as Record<string, Json>)[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** A nested object field as a string map, or {} . */
export function obj(content: Json, key: string): Record<string, string> {
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    return {};
  }
  const value = (content as Record<string, Json>)[key];
  return value === undefined ? {} : sectionContent(value);
}

/**
 * A list field whose entries are objects, as string maps.
 *
 * Entries that are not objects are dropped rather than rendered as "[object
 * Object]" or crashing a .map(). Numbers survive as strings, which is what
 * mile_stats and the giving amounts need.
 */
export function rows(content: Json, key: string): Record<string, string>[] {
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    return [];
  }
  const value = (content as Record<string, Json>)[key];
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Json => entry !== null && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => sectionContent(entry));
}

/** A list field of plain strings (bullets, option lists). */
export function strings(content: Json, key: string): string[] {
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    return [];
  }
  const value = (content as Record<string, Json>)[key];
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry) => typeof entry === "string" || typeof entry === "number")
    .map(String)
    .filter((entry) => entry.trim() !== "");
}
