"use server";

import { anthropicConfigured, callClaude } from "@/lib/portal/anthropic";
import { requirePortalUser } from "@/lib/portal/auth";
import { judgeWrite, publishChange } from "@/lib/portal/collection-write";
import type { TeamState } from "@/lib/portal/form-state";
import {
  markdownToDoc,
  sermonBodyToText,
} from "@/lib/portal/markdown-doc";
import type {
  AddonKey,
  FinishResult,
  RetryResult,
  SectionOutcome,
  SlideDeck,
  SocialSet,
} from "@/lib/portal/sermon-builder-shared";
import type { JSONContent } from "@/lib/portal/sermon-extensions";
import {
  bulletinPrompt,
  devotionalPrompt,
  formatPassage,
  kidsPrompt,
  parseJsonBlock,
  SERMON_SYSTEM_PROMPT,
  slidesPrompt,
  smallGroupPrompt,
  socialPrompt,
  summaryPrompt,
} from "@/lib/portal/sermon-prompts";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * ============================================================
 * Server Actions for the Sermon Builder - phase 2 and editing
 * ============================================================
 *
 * The streamed main call lives in generate/route.ts; everything after it
 * lands here. finishSermonGeneration() saves the draft the moment the
 * stream ends (the old builder's best behavior - the pastor's sermon
 * exists in the database BEFORE the add-ons gamble on six more API calls),
 * then runs summary + selected add-ons IN PARALLEL and saves whatever
 * succeeds. Partial failure is a first-class outcome, not an error: each
 * failed section returns "failed" and the UI offers a per-section retry -
 * five good sections are never thrown away because one timed out.
 *
 * These calls are NOT metered by the daily cap - the cap logs one row per
 * main generation (see generate/route.ts), and add-ons plus retries ride
 * that generation. Every action re-asserts access with requirePortalUser()
 * because a Server Action is a public POST endpoint.
 */

const ADDON_KEYS = ["devotional", "small_group", "kids", "bulletin", "slides", "social"] as const;

type SectionKey = (typeof ADDON_KEYS)[number] | "summary";

type SermonUpdate = Database["public"]["Tables"]["sermons"]["Update"];

/** The seven sermons columns a generated section can land in. */
type SectionColumn =
  | "summary"
  | "devotional"
  | "small_group_questions"
  | "kids_lesson"
  | "bulletin_notes"
  | "slide_content"
  | "social_posts";

/** One section's generation: the prompt, its budget, and which sermons
    column it lands in. Slides and social parse as JSON; the rest are text. */
function sectionSpec(
  section: SectionKey,
  sermonText: string,
  title: string,
  passage: string,
): { prompt: string; maxTokens: number; column: SectionColumn; json: boolean } {
  switch (section) {
    case "summary":
      return { prompt: summaryPrompt(sermonText), maxTokens: 500, column: "summary", json: false };
    case "devotional":
      return { prompt: devotionalPrompt(passage), maxTokens: 1000, column: "devotional", json: false };
    case "small_group":
      return { prompt: smallGroupPrompt(passage), maxTokens: 1000, column: "small_group_questions", json: false };
    case "kids":
      return { prompt: kidsPrompt(passage), maxTokens: 1000, column: "kids_lesson", json: false };
    case "bulletin":
      return { prompt: bulletinPrompt(title, passage), maxTokens: 1000, column: "bulletin_notes", json: false };
    case "slides":
      return { prompt: slidesPrompt(sermonText), maxTokens: 1500, column: "slide_content", json: true };
    case "social":
      return { prompt: socialPrompt(sermonText), maxTokens: 800, column: "social_posts", json: true };
  }
}

async function generateSection(
  section: SectionKey,
  sermonText: string,
  title: string,
  passage: string,
): Promise<{ column: SectionColumn; value: unknown }> {
  const spec = sectionSpec(section, sermonText, title, passage);
  const text = await callClaude(spec.prompt, {
    system: SERMON_SYSTEM_PROMPT,
    maxTokens: spec.maxTokens,
  });
  return { column: spec.column, value: spec.json ? parseJsonBlock(text) : text };
}

/**
 * Phase 2: save the streamed sermon as a draft, then generate summary +
 * selected add-ons in parallel.
 */
export async function finishSermonGeneration(input: {
  markdown: string;
  title: string;
  sermonDate: string;
  book: string;
  chapter: string;
  verses: string;
  style: string;
  addons: AddonKey[];
}): Promise<FinishResult> {
  /*
   * Everything is inside a try. This action had NO error boundary, so any
   * throw surfaced as "An error occurred in the Server Components render"
   * with the detail stripped in production - a pastor watched a sermon
   * write itself and then vanish, with nothing to act on. Same mistake the
   * generate route made, and the same fix: catch, log the real cause, and
   * hand the caller something it can display.
   */
  try {
    return await runFinish(input);
  } catch (error) {
    /*
     * Next signals redirect() and notFound() by THROWING, so a blanket
     * catch swallows them: requirePortalUser() on an expired session would
     * stop redirecting to the login screen and return a save error
     * instead, stranding the pastor on a page that cannot work. Re-thrown
     * so control flow still reaches Next. A bug I introduced with this
     * catch block, not a diagnosed cause of the current failure.
     */
    const digest = (error as { digest?: unknown })?.digest;
    if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")) {
      throw error;
    }

    console.error(
      `[portal] finishSermonGeneration crashed: ${(error as Error)?.stack ?? String(error)}`,
    );
    return {
      ok: false,
      error:
        "The sermon was written but could not be saved. Copy your text somewhere safe, then try again.",
    };
  }
}

async function runFinish(input: {
  markdown: string;
  title: string;
  sermonDate: string;
  book: string;
  chapter: string;
  verses: string;
  style: string;
  addons: AddonKey[];
}): Promise<FinishResult> {
  const session = await requirePortalUser();

  const markdown = String(input.markdown ?? "").slice(0, 60000);
  if (!markdown.trim()) {
    return { ok: false, error: "There is no sermon text to save." };
  }

  const title = String(input.title ?? "").trim().slice(0, 200) || "Untitled sermon";
  const passagePlain = input.book && input.chapter
    ? `${input.book} ${input.chapter}${input.verses ? `:${input.verses}` : ""}`
    : "";
  const passageForPrompts = formatPassage(input.book, input.chapter, input.verses) || title;

  console.log(`[portal] finish: converting ${markdown.length} chars of markdown`);
  const bodyJson = markdownToDoc(markdown);
  console.log("[portal] finish: markdown converted, inserting draft");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sermons")
    .insert({
      church_id: session.site.church.id,
      created_by: session.userId,
      title,
      body_json: bodyJson,
      scripture_ref: passagePlain || null,
      style: input.style || null,
      preached_at: /^\d{4}-\d{2}-\d{2}$/.test(input.sermonDate) ? input.sermonDate : null,
      status: "draft",
    })
    .select("id");

  const saved = judgeWrite("finishSermonGeneration", session.site.church.id, error, data);
  if (!saved.ok) return { ok: false, error: saved.error ?? "That did not save." };
  const sermonId = (data as { id: string }[])[0].id;
  console.log(`[portal] finish: draft saved as ${sermonId}`);

  // Summary always runs; the add-ons are whichever were ticked. All in
  // parallel - wall clock is the slowest single call, not the sum.
  const wanted: SectionKey[] = ["summary", ...ADDON_KEYS.filter((key) => input.addons.includes(key))];

  console.log(`[portal] finish: generating ${wanted.length} sections`);
  const settled = await Promise.allSettled(
    wanted.map((section) => generateSection(section, markdown, title, passageForPrompts)),
  );

  const sections: Partial<Record<SectionKey, SectionOutcome>> = {};
  // Built dynamically per succeeded section; the columns are the closed
  // SectionColumn set, so the cast at .update() below narrows honestly.
  const updates: Partial<Record<SectionColumn, unknown>> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  const values: Record<string, unknown> = {};

  settled.forEach((result, index) => {
    const section = wanted[index];
    if (result.status === "fulfilled") {
      sections[section] = "ok";
      updates[result.value.column] = result.value.value;
      values[section] = result.value.value;
    } else {
      sections[section] = "failed";
      console.error(
        `[portal] sermon section "${section}" failed for church ${session.site.church.id}: ${result.reason}`,
      );
    }
  });

  // Summary fallback, ported: a failed summary call degrades to a trim of
  // the sermon itself rather than an empty public card.
  if (sections.summary === "failed") {
    const plain = markdown.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
    updates.summary = plain.split(" ").slice(0, 70).join(" ") + "...";
    values.summary = updates.summary;
    sections.summary = "ok";
  }

  console.log(
    `[portal] finish: sections done - ${Object.entries(sections)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
  );
  const { data: updated, error: updateError } = await supabase
    .from("sermons")
    .update(updates as SermonUpdate)
    .eq("id", sermonId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const judged = judgeWrite("finishSermonGeneration:addons", session.site.church.id, updateError, updated);
  if (!judged.ok) return { ok: false, error: judged.error ?? "The add-ons did not save." };

  return {
    ok: true,
    sermonId,
    bodyJson,
    summary: (values.summary as string) ?? null,
    sections,
    devotional: (values.devotional as string) ?? null,
    smallGroup: (values.small_group as string) ?? null,
    kids: (values.kids as string) ?? null,
    bulletin: (values.bulletin as string) ?? null,
    slides: (values.slides as SlideDeck) ?? null,
    social: (values.social as SocialSet) ?? null,
  };
}

/** Regenerate ONE section against the saved manuscript. The recovery path
    for a partial failure - costs one API call, not a new generation. */
export async function retrySermonSection(
  sermonId: string,
  section: AddonKey | "summary",
): Promise<RetryResult> {
  const session = await requirePortalUser();

  if (!anthropicConfigured()) {
    return { ok: false, error: "Sermon generation is not set up yet." };
  }

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("sermons")
    .select("id, title, scripture_ref, body_json")
    .eq("id", sermonId)
    .eq("church_id", session.site.church.id)
    .maybeSingle();

  if (readError || !row) {
    return { ok: false, error: "That sermon could not be found." };
  }

  const sermonText = sermonBodyToText(row.body_json as JSONContent | null);
  const passage = row.scripture_ref ? `${row.scripture_ref} (ESV)` : row.title;

  try {
    const { column, value } = await generateSection(section, sermonText, row.title, passage);

    const { data, error } = await supabase
      .from("sermons")
      .update({ [column]: value, updated_at: new Date().toISOString() } as SermonUpdate)
      .eq("id", sermonId)
      .eq("church_id", session.site.church.id)
      .select("id");

    const judged = judgeWrite(`retrySermonSection:${section}`, session.site.church.id, error, data);
    if (!judged.ok) return { ok: false, error: judged.error ?? "That did not save." };

    return { ok: true, value: value as string | SlideDeck | SocialSet };
  } catch (error) {
    console.error(
      `[portal] retry "${section}" failed for church ${session.site.church.id}: ${(error as Error).message}`,
    );
    return { ok: false, error: "That section failed again. Wait a moment and retry." };
  }
}

/** Save the pastor's edits to the manuscript and summary. */
export async function saveSermonEdits(input: {
  sermonId: string;
  title: string;
  summary: string;
  bodyJson: string;
}): Promise<TeamState> {
  const session = await requirePortalUser();

  let body: JSONContent;
  try {
    body = JSON.parse(String(input.bodyJson ?? "")) as JSONContent;
  } catch {
    return { ok: false, error: "That did not save. Try again in a moment." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sermons")
    .update({
      title: String(input.title ?? "").trim().slice(0, 200) || "Untitled sermon",
      summary: String(input.summary ?? "").trim() || null,
      body_json: body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sermonId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("saveSermonEdits", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  // Title and summary render on the public card once published - expire the
  // cache either way, it is cheap and never wrong.
  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Publish: the sermon appears on the public /sermons page as a text card
 * (the feed's orphans branch - no video needed). Uses the same status
 * column the Sermon Library's picker manages, so "Taken down" and
 * republishing live there afterwards.
 */
export async function publishBuiltSermon(sermonId: string): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sermons")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sermonId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("publishBuiltSermon", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}
