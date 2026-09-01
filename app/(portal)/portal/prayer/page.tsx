import type { Metadata } from "next";

import { PrayerModerator, type PrayerRow } from "@/components/portal/prayer-moderator";
import { requirePortalUser } from "@/lib/portal/auth";
import type { PrayerStatus } from "@/lib/portal/form-state";
import { PRAYER_STATUSES } from "@/lib/portal/form-state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Prayer Wall" };

/**
 * "Prayer Wall" - read what people have sent in and decide what appears.
 *
 * Fetches EVERY status, not just pending. The public read shows approved rows
 * only; this page is the other side of that, and a pastor needs to see what is
 * already on the wall to take something down, plus what they have kept private
 * or archived.
 *
 * Newest first. A prayer request is time-sensitive in a way an announcement is
 * not - the one that came in an hour ago is the one that matters.
 */
export default async function PrayerPage() {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("prayer_requests")
    .select("id, body, display_name, status, prayed_count, created_at, approved_at")
    .eq("church_id", session.site.church.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <Shell>
        <p role="alert" className="text-red-700">
          Your prayer requests could not be loaded right now. Refresh the page -
          nothing has been lost.
        </p>
      </Shell>
    );
  }

  const requests: PrayerRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    displayName: row.display_name ?? "",
    // status is free text in the schema, not an enum, so a value outside the
    // four known ones is possible. Treat an unrecognised one as unread rather
    // than dropping the row - a request that vanished from every list would be
    // worse than one filed in the wrong place.
    status: isPrayerStatus(row.status) ? row.status : "pending",
    prayedCount: row.prayed_count,
    createdAt: row.created_at,
  }));

  return (
    <Shell>
      <PrayerModerator requests={requests} />
    </Shell>
  );
}

function isPrayerStatus(value: string): value is PrayerStatus {
  return (PRAYER_STATUSES as readonly string[]).includes(value);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-bold">
        Prayer Wall
      </h1>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        Everything sent in through your website. Nothing appears publicly until
        you put it there - your site tells people a person reads these first.
      </p>

      {children}
    </div>
  );
}
