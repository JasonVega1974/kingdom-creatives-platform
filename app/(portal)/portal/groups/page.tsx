import type { Metadata } from "next";

import { GroupsEditor, type GroupRow } from "@/components/portal/groups-editor";
import { requirePortalUser } from "@/lib/portal/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Groups & Studies" };

/**
 * "Groups & Studies" - the list on /groups, hidden ones included.
 *
 * Ordered by sort_order to match the public page exactly, so the arrangement a
 * pastor makes here is the arrangement a visitor sees.
 */
export default async function GroupsPage() {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("groups")
    .select(
      "id, name, description, leader_name, meeting_day, meeting_time, meeting_tz, meeting_link, location_type, location_detail, frequency, visible",
    )
    .eq("church_id", session.site.church.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <Shell>
        <p role="alert" className="text-red-700">
          Your groups could not be loaded right now. Refresh the page - nothing
          has been lost.
        </p>
      </Shell>
    );
  }

  const groups: GroupRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    leaderName: row.leader_name ?? "",
    meetingDay: row.meeting_day ?? "",
    meetingTime: row.meeting_time ?? "",
    meetingTz: row.meeting_tz ?? "",
    meetingLink: row.meeting_link ?? "",
    locationType: row.location_type,
    locationDetail: row.location_detail ?? "",
    frequency: row.frequency,
    visible: row.visible,
  }));

  return (
    <Shell>
      <GroupsEditor groups={groups} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-semibold">
        Groups &amp; Studies
      </h1>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        Your groups, in the order visitors will see them. Use the arrows to put
        the one you most want people to join at the top.
      </p>

      {children}
    </div>
  );
}
