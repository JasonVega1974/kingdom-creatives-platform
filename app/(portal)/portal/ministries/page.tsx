import type { Metadata } from "next";

import {
  MinistriesEditor,
  type MinistryRow,
} from "@/components/portal/ministries-editor";
import { requirePortalUser } from "@/lib/portal/auth";
import { createClient } from "@/lib/supabase/server";
import { HelpMark } from "@/components/portal/help-mark";

export const metadata: Metadata = { title: "Ministries" };

/**
 * "Ministries" - the list on your About page.
 *
 * Ordered by sort_order to match the public page, so the arrangement made here
 * is the arrangement a visitor sees.
 */
export default async function MinistriesPage() {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("ministries")
    .select("id, name, description, website_url, logo_url, visible")
    .eq("church_id", session.site.church.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <Shell>
        <p role="alert" className="text-red-700">
          Your ministries could not be loaded right now. Refresh the page -
          nothing has been lost.
        </p>
      </Shell>
    );
  }

  const items: MinistryRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    websiteUrl: row.website_url ?? "",
    logoUrl: row.logo_url ?? "",
    visible: row.visible,
  }));

  return (
    <Shell>
      <MinistriesEditor items={items} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2.5">
        <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-bold">
          Ministries
        </h1>
        <HelpMark topic="ministries.overview" />
      </div>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        The organisations you support, listed on your About page. Use the arrows
        to set the order.
      </p>

      {children}
    </div>
  );
}
