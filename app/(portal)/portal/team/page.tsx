import type { Metadata } from "next";

import { TeamEditor, type Person } from "@/components/portal/team-editor";
import { requirePortalUser } from "@/lib/portal/auth";
import type { LibraryItem } from "@/components/portal/media-picker";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Our Team" };

/**
 * "Our Team" - the people on the public /team page.
 *
 * Reads with the pastor's own session, so RLS scopes the rows and hidden people
 * come back too (via `staff+ can view staff`). The explicit church_id filter is
 * belt and braces, and is what makes the query use the index.
 *
 * Ordered by sort_order to match the public page exactly - the pastor arranges
 * the list here and sees the same order a visitor will.
 */
export default async function TeamPage() {
  const session = await requirePortalUser();

  const supabase = await createClient();

  // The picker needs the whole library. One extra query per page load, which is
  // cheaper than a client-side fetch and keeps the grid server-rendered.
  const { data: libraryRows } = await supabase
    .from("church_media")
    .select("id, storage_path, title, alt_text")
    .eq("church_id", session.site.church.id)
    .order("created_at", { ascending: false });

  const library: LibraryItem[] = (libraryRows ?? []).map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    title: row.title ?? "",
    altText: row.alt_text ?? "",
  }));

  const { data: rows, error } = await supabase
    .from("staff")
    .select("id, name, role_title, bio, email, phone, photo_url, media_id, visible")
    .eq("church_id", session.site.church.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <Shell>
        <p role="alert" className="text-red-700">
          Your team could not be loaded right now. Refresh the page - nothing has
          been lost.
        </p>
      </Shell>
    );
  }

  // Nulls become empty strings at the boundary so the client component never
  // deals with two kinds of "nothing here".
  const people: Person[] = (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    roleTitle: row.role_title ?? "",
    bio: row.bio ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    photoUrl: row.photo_url ?? "",
    mediaId: row.media_id,
    visible: row.visible,
  }));

  return (
    <Shell>
      <TeamEditor people={people} library={library} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-bold">
        Our Team
      </h1>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        The people on your team page. Add someone, write a short bio, and switch
        them on when you are ready for visitors to see them.
      </p>

      {children}
    </div>
  );
}
