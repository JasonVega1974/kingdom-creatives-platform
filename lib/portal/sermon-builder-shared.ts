import type { JSONContent } from "@/lib/portal/sermon-extensions";

/**
 * Types and definitions shared by the Sermon Builder's client component and
 * its Server Actions. Lives here rather than in actions.ts because a
 * "use server" module may export only async functions (see
 * lib/portal/form-state.ts for the incident that made this a rule).
 */

/** Generations allowed per church per UTC day. Bounds worst-case platform
    spend near $2/church/day at ~$0.20 per full generation - Jason's number,
    decided 2026-09-03. The refusal message in generate/route.ts promises
    the midnight-UTC reset this constant implies. */
export const GENERATION_CAP_PER_DAY = 10;

/** The six add-on builders, keyed to their sermons-table columns. */
export const SERMON_ADDONS = [
  { key: "devotional", label: "Daily Devotional", column: "devotional" },
  { key: "small_group", label: "Small Group Discussion", column: "small_group_questions" },
  { key: "kids", label: "Kids Ministry Lesson", column: "kids_lesson" },
  { key: "bulletin", label: "Bulletin Notes", column: "bulletin_notes" },
  { key: "slides", label: "Presentation Slides", column: "slide_content" },
  { key: "social", label: "Social Media Posts", column: "social_posts" },
] as const;

export type AddonKey = (typeof SERMON_ADDONS)[number]["key"];

/** A generated slide deck, as slidesPrompt() demands it. */
export type SlideDeck = { title: string; bullets: string[]; scripture?: string }[];

/** The generated social set, as socialPrompt() demands it. */
export type SocialSet = { facebook: string; instagram: string; x: string; sms: string };

export type SectionOutcome = "ok" | "failed";

/** What finishGeneration returns: the saved draft plus every section's
    outcome and value, so the UI can render successes and offer per-section
    retries for the rest. */
export type FinishResult =
  | {
      ok: true;
      sermonId: string;
      bodyJson: JSONContent;
      summary: string | null;
      sections: Partial<Record<AddonKey | "summary", SectionOutcome>>;
      devotional: string | null;
      smallGroup: string | null;
      kids: string | null;
      bulletin: string | null;
      slides: SlideDeck | null;
      social: SocialSet | null;
    }
  | { ok: false; error: string };

export type RetryResult =
  | { ok: true; value: string | SlideDeck | SocialSet }
  | { ok: false; error: string };
