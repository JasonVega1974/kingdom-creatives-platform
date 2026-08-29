import type { Metadata } from "next";

import {
  SermonLibrary,
  type Channel,
  type SermonRow,
} from "@/components/portal/sermon-library";
import { requirePortalUser } from "@/lib/portal/auth";
import { SERMON_STATUSES, type SermonStatus } from "@/lib/portal/form-state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sermon Library" };

/**
 * "Sermon Library" - every message, whatever its status.
 *
 * Reads with the pastor's own session, so drafts and archived sermons come back
 * too. The public page sees only 'published', which is the point of the tab.
 *
 * Newest first, matching the public page. `nullsFirst: false` keeps a sermon
 * with no date at the bottom rather than the top - an undated row is usually
 * one still being filled in, not the most recent thing preached.
 */
export default async function SermonsPage() {
  const session = await requirePortalUser();

  const supabase = await createClient();

  // The church's video channels, for the "which channel" picker. CFT has two.
  const { data: linkRows } = await supabase
    .from("church_links")
    .select("id, label")
    .eq("church_id", session.site.church.id)
    .eq("kind", "video")
    .order("sort_order", { ascending: true });

  const channels: Channel[] = (linkRows ?? []).map((row) => ({
    id: row.id,
    label: row.label,
  }));

  const { data: rows, error } = await supabase
    .from("sermons")
    .select(
      "id, title, series, scripture_ref, summary, preached_at, duration_min, youtube_id, church_link_id, status",
    )
    .eq("church_id", session.site.church.id)
    .order("preached_at", { ascending: false, nullsFirst: false });

  if (error) {
    return (
      <Shell>
        <p role="alert" className="text-red-700">
          Your sermons could not be loaded right now. Refresh the page - nothing
          has been lost.
        </p>
      </Shell>
    );
  }

  const sermons: SermonRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    series: row.series ?? "",
    scriptureRef: row.scripture_ref ?? "",
    summary: row.summary ?? "",
    // <input type="date"> wants YYYY-MM-DD. The column is a date, but a
    // timestamp would arrive with a time part the input silently rejects.
    preachedAt: row.preached_at ? String(row.preached_at).slice(0, 10) : "",
    durationMin: row.duration_min == null ? "" : String(row.duration_min),
    youtubeId: row.youtube_id ?? "",
    churchLinkId: row.church_link_id,
    // A row could hold a status nothing recognises - the column is text with a
    // comment, not an enum. Anything unexpected is shown as a draft, which is
    // the safe direction: off the website until someone looks at it.
    status: (SERMON_STATUSES as readonly string[]).includes(row.status)
      ? (row.status as SermonStatus)
      : "draft",
  }));

  return (
    <Shell>
      <SermonLibrary sermons={sermons} channels={channels} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-semibold">
        Sermon Library
      </h1>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        Every message you have preached. Add one, link its video, and switch it
        on when you are ready for it to appear on your website.
      </p>

      {children}
    </div>
  );
}
