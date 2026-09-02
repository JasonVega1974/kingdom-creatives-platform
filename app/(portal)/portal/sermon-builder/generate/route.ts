import { NextResponse } from "next/server";

import { anthropicConfigured, streamClaude } from "@/lib/portal/anthropic";
import { getPortalSession } from "@/lib/portal/auth";
import {
  buildSermonPrompt,
  formatPassage,
  SERMON_SYSTEM_PROMPT,
} from "@/lib/portal/sermon-prompts";
import { GENERATION_CAP_PER_DAY } from "@/lib/portal/sermon-builder-shared";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * POST /portal/sermon-builder/generate - the streamed main call
 * ============================================================
 *
 * A Route Handler, not a Server Action, because Server Actions cannot
 * stream - and streaming is the whole UX: words appear within seconds
 * instead of a spinner sitting on a 60-90 second call.
 *
 * Like every Server Action, this is a public POST endpoint that no page
 * check protects, so it asserts access itself - getPortalSession() rather
 * than requirePortalUser(), because redirect() answers a fetch() with a
 * 3xx the client JS would follow into HTML; a 401 JSON is the honest
 * answer here.
 *
 * THE DAILY CAP lives here. sermon_generations gets one row per main-call
 * start (draft 35): counting at start rather than on success means a
 * failed generation costs a slot, which is the acceptable edge - counting
 * on success would let a retry storm bypass the cap entirely. The add-on
 * calls in actions.ts ride the same generation free; the cap meters the
 * expensive unit, not every API call.
 *
 * Field lengths are clamped before prompting - not against the pastor
 * (their own sermon, their own prompt) but so a paste accident cannot ship
 * a 300KB notes field to the API.
 */

/**
 * A sermon takes 60-90 seconds to write. Streaming means the first bytes
 * arrive within a few seconds, so a gateway timeout was never the likely
 * failure - but leaving the ceiling implicit is how it becomes one later,
 * on a longer sermon or a slower day. Stated rather than inherited.
 */
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  // FIRST LINE, before anything that can fail. If this does not appear in
  // the Vercel logs, the handler never ran.
  console.log("[portal] generate POST entered");

  try {
    return await handleGenerate(request);
  } catch (error) {
    // The original try/catch wrapped only the Anthropic call, so a throw in
    // the session lookup, the cap count or the log insert became an opaque
    // platform 502 with nothing written down. Now every path reports.
    console.error(
      `[portal] generate POST crashed before streaming: ${(error as Error)?.stack ?? String(error)}`,
    );
    return NextResponse.json(
      { error: "Generation failed unexpectedly. Try again in a moment." },
      { status: 500 },
    );
  }
}

async function handleGenerate(request: Request): Promise<Response> {
  const session = await getPortalSession();
  if (!session) {
    console.log("[portal] generate POST: no portal session");
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  console.log(`[portal] generate POST: auth ok, church ${session.site.church.slug}`);

  if (!anthropicConfigured()) {
    console.log("[portal] generate POST: ANTHROPIC_API_KEY absent from this deployment");
    return NextResponse.json(
      { error: "Sermon generation is not set up yet. Please contact Kingdom Creatives." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    console.log("[portal] generate POST: body could not be parsed");
    return NextResponse.json({ error: "That request could not be read." }, { status: 400 });
  }
  console.log("[portal] generate POST: body parsed");

  const text = (key: string, max: number) => String(body[key] ?? "").trim().slice(0, max);
  const flag = (key: string) => Boolean(body[key]);

  const supabase = await createClient();
  const churchId = session.site.church.id;

  // Today's generations, in UTC - the cap the refusal message promises.
  const utcDayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
  const { count, error: countError } = await supabase
    .from("sermon_generations")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .gte("created_at", utcDayStart);

  if (countError) {
    console.error(`[portal] generation count failed for church ${churchId}: ${countError.message}`);
    return NextResponse.json(
      { error: "Could not check today's generation count. Try again in a moment." },
      { status: 500 },
    );
  }

  if ((count ?? 0) >= GENERATION_CAP_PER_DAY) {
    return NextResponse.json(
      {
        error:
          `Today's ${GENERATION_CAP_PER_DAY} sermon generations are used up. ` +
          "The counter resets at midnight UTC - your drafts are all saved and ready to keep editing.",
      },
      { status: 429 },
    );
  }

  console.log(`[portal] generate POST: cap ok (${count ?? 0} used today), logging generation`);

  // Log the generation BEFORE calling the API - see the header comment.
  // .select("id") per FF-27: an insert RLS refuses looks like success
  // without it.
  const { data: logged, error: logError } = await supabase
    .from("sermon_generations")
    .insert({ church_id: churchId, user_id: session.userId })
    .select("id");

  if (logError || !logged || logged.length === 0) {
    console.error(
      `[portal] generation log insert refused for church ${churchId}: ${logError?.message ?? "0 rows"}`,
    );
    return NextResponse.json(
      { error: "Could not start a generation. Please contact Kingdom Creatives." },
      { status: 500 },
    );
  }

  const prompt = buildSermonPrompt({
    title: text("title", 200),
    passage: formatPassage(text("book", 30), text("chapter", 4), text("verses", 20)),
    style: text("style", 30),
    notes: text("notes", 4000),
    include: {
      scripture: flag("include_scripture"),
      examples: flag("include_examples"),
      humor: flag("include_humor"),
      illustrations: flag("include_illustrations"),
      quotes: flag("include_quotes"),
      calltoaction: flag("include_calltoaction"),
    },
  });

  try {
    console.log("[portal] generate POST: calling Anthropic");
    // 5000 tokens, not the original's 3000 - a 3000-word sermon is ~4000
    // tokens and the old cap could truncate its own closing prayer.
    const stream = await streamClaude(prompt, {
      system: SERMON_SYSTEM_PROMPT,
      maxTokens: 5000,
    });
    console.log("[portal] generate POST: Anthropic accepted, streaming");

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error(`[portal] sermon generation failed for church ${churchId}: ${(error as Error).message}`);
    return NextResponse.json(
      { error: "Generation failed before it started. Try again in a moment." },
      { status: 502 },
    );
  }
}
