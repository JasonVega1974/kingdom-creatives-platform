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

  const supabase = await createClient();
  const utcDayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
  const { count } = await supabase
    .from("sermon_generations")
    .select("id", { count: "exact", head: true })
    .eq("church_id", session.site.church.id)
    .gte("created_at", utcDayStart);

  const remaining = Math.max(0, GENERATION_CAP_PER_DAY - (count ?? 0));

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
