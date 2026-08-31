import type { FieldKind } from "@/lib/portal/sections";

/**
 * ============================================================
 * FIELD VALUES - the one place a stored value becomes box text,
 * and box text becomes a stored value
 * ============================================================
 *
 * These two functions are inverses and they live together because the bug they
 * exist to prevent was the two halves disagreeing.
 *
 * home.about_strip.body is stored as a LIST of paragraphs. It was declared
 * `textarea`, so:
 *
 *   - the read side coerced the list to "" (it was not a string), and the box
 *     rendered empty even though there were two paragraphs in it;
 *   - the write side sent that "" straight back as a string, replacing the
 *     list;
 *   - the renderer reads the key with strings(), which returns [] for anything
 *     that is not an array, so the section rendered nothing;
 *   - and the portal said "Saved."
 *
 * Silent, total, and reported as success. Nothing in the type system caught it
 * because both halves were independently well-typed - they were just describing
 * different shapes. Keeping them in one file, as a stated pair, is what makes
 * that impossible rather than merely unlikely. See FF-48.
 */

/** Read: the stored value as the text box should show it. */
export function fieldToText(value: unknown, kind: FieldKind): string {
  if (kind === "paragraphs") {
    // Blank line between paragraphs - the separator textToParagraphs splits on.
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string").join("\n\n")
      : "";
  }

  // A value of an unrepresentable shape shows as empty rather than as a
  // half-rendered version, because a pastor would reasonably save what they
  // see, and what they see would be wrong.
  return typeof value === "string" ? value : "";
}

/** Write: box text as it should be stored. */
export function textToField(text: string, kind: FieldKind): string | string[] {
  if (kind === "paragraphs") {
    return text
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  return text;
}

/**
 * Would writing `incoming` over `existing` replace a structure with a scalar?
 *
 * The last line of defence, and deliberately independent of the field kinds: a
 * future field could be declared scalar over a key holding a list or an object,
 * and the failure mode is silent content loss. Refusing the write turns the
 * worst class of bug into a save that visibly did not happen.
 */
export function wouldFlatten(existing: unknown, incoming: unknown): boolean {
  return (
    existing !== null &&
    existing !== undefined &&
    typeof existing === "object" &&
    typeof incoming !== "object"
  );
}
