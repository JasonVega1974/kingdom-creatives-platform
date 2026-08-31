import type { Metadata } from "next";

import {
  AnnouncementsEditor,
  type AnnouncementRow,
} from "@/components/portal/announcements-editor";
import { requirePortalUser } from "@/lib/portal/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Announcements" };

/**
 * "Announcements" - the bulletin board on your home page.
 *
 * Shows expired ones too, unlike the public read, which drops them. A pastor
 * looking for "the one about the coat drive" should be able to find it and
 * copy it, and an expired notice that vanished without trace looks like
 * something went wrong.
 */
export default async function AnnouncementsPage() {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("announcements")
    .select("id, body, expires_at, visible")
    .eq("church_id", session.site.church.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <Shell>
        <p role="alert" className="text-red-700">
          Your announcements could not be loaded right now. Refresh the page -
          nothing has been lost.
        </p>
      </Shell>
    );
  }

  const items: AnnouncementRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    // <input type="date"> wants YYYY-MM-DD; the column is a timestamp.
    expiresAt: row.expires_at ? String(row.expires_at).slice(0, 10) : "",
    visible: row.visible,
  }));

  return (
    <Shell>
      <AnnouncementsEditor items={items} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-bold">
        Announcements
      </h1>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        The bulletin board on your home page. Give an announcement an end date
        and it comes down on its own.
      </p>

      {children}
    </div>
  );
}
