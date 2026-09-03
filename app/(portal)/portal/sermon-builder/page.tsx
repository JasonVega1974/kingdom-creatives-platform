import type { Metadata } from "next";

import { HelpMark } from "@/components/portal/help-mark";
import { SermonBuilder } from "@/components/portal/sermon-builder";
import { requirePortalUser } from "@/lib/portal/auth";
import { GENERATION_CAP_PER_DAY } from "@/lib/portal/sermon-builder-shared";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sermon Builder" };

/**
 * Server Actions run under THIS route, not under generate/route.ts - and
 * finishSermonGeneration fires up to seven non-streaming Anthropic calls in
 * parallel, holding the function open for their full wall-clock with no
 * streamed bytes to keep the connection alive. Setting the ceiling on the
 * streaming route while leaving it implicit here is what let the sermon
 * generate successfully and then fail on save.
 */
export const maxDuration = 300;

/**
 * "Sermon Builder" - generate a sermon draft with help, edit it, publish it.
 *
 * The one server-side read is today's generation count, so the page can say
 * how many of the daily 10 remain before the pastor commits to typing a
 * whole form. The count is re-checked authoritatively in generate/route.ts
 * on every generation - this number is a courtesy, not the enforcement.
 */
export default async function SermonBuilderPage() {
  const session = await requirePortalUser();

  /*
   * THIS PAGE RE-RENDERS AFTER EVERY SERVER ACTION, and that is why the
   * count is wrapped rather than awaited bare.
   *
   * Next re-renders a route's Server Components as part of the response to
   * an action called from it. So this query does not run once on
   * navigation - it runs again after the sermon is saved, and again after
   * every subsequent save or publish. An unguarded throw there does not
   * look like a failed query; it surfaces as "An error occurred in the
   * Server Components render" with the detail stripped in production,
   * AFTER the work already succeeded - which reads as "the save broke"
   * when the save was fine.
   *
   * The count is a courtesy number. generate/route.ts re-checks the cap
   * authoritatively on every generation, so falling back to "all slots
   * available" here is a display inaccuracy at worst and never a way past
   * the limit.
   */
  let remaining = GENERATION_CAP_PER_DAY;
  try {
    const supabase = await createClient();
    const utcDayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
    const { count, error } = await supabase
      .from("sermon_generations")
      .select("id", { count: "exact", head: true })
      .eq("church_id", session.site.church.id)
      .gte("created_at", utcDayStart);

    if (error) {
      console.error(`[portal] builder cap count failed: ${error.message}`);
    } else {
      remaining = Math.max(0, GENERATION_CAP_PER_DAY - (count ?? 0));
    }
  } catch (error) {
    console.error(
      `[portal] builder cap count threw: ${(error as Error)?.stack ?? String(error)}`,
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2.5">
        <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-bold">
          Sermon Builder
        </h1>
        <HelpMark topic="builder.how" />
      </div>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        Give it a title, a passage and your direction - it writes a full
        draft you edit and make your own. Everything lands in your Sermon
        Library, and nothing goes on your website until you publish it.
      </p>

      <SermonBuilder remainingToday={remaining} />
    </div>
  );
}
