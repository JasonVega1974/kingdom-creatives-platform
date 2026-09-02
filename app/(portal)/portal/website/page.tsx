import type { Metadata } from "next";

import type { LibraryItem } from "@/components/portal/media-picker";
import { SectionEditor, type EditableSection } from "@/components/portal/section-editor";
import { requirePortalUser } from "@/lib/portal/auth";
import { fieldToText } from "@/lib/portal/field-values";
import { PAGES, describeUnknownSection, findPage, findSection } from "@/lib/portal/sections";
import { createClient } from "@/lib/supabase/server";
import { HelpMark } from "@/components/portal/help-mark";

export const metadata: Metadata = { title: "Edit My Website" };

/**
 * "Edit My Website" - one page of the site at a time.
 *
 * Reads with the pastor's own session, so RLS scopes the rows; the explicit
 * church_id filter is belt-and-braces, and it is also what makes the query
 * use the index.
 */
export default async function WebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requirePortalUser();
  const params = await searchParams;

  // Unknown or missing ?page= falls back to Home rather than erroring - the
  // picker is the only thing that sets it, so a bad value means a stale link.
  const page = findPage(params.page ?? "") ?? PAGES[0];

  const supabase = await createClient();

  // The picker for image fields needs the library. One extra query per page
  // load, which beats a client-side fetch and keeps the editor server-rendered.
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
    .from("church_sections")
    .select("id, section_key, content, visible, sort_order")
    .eq("church_id", session.site.church.id)
    .eq("page_slug", page.slug)
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <Shell pageSlug={page.slug}>
        <p role="alert" className="text-red-700">
          Your website sections could not be loaded right now. Refresh the page -
          nothing has been lost.
        </p>
      </Shell>
    );
  }

  const sections: EditableSection[] = (rows ?? []).map((row) => {
    const def = findSection(page.slug, row.section_key) ?? describeUnknownSection(row.section_key);

    const content =
      row.content && typeof row.content === "object" && !Array.isArray(row.content)
        ? (row.content as Record<string, unknown>)
        : {};

    return {
      id: row.id,
      pageSlug: page.slug,
      sectionKey: row.section_key,
      label: def.label,
      description: def.description,
      visible: row.visible,
      // A section with no described fields is either auto-filled from another
      // tab or not yet described. Either way there is no text box to show.
      fields: (def.fields ?? []).map((field) => ({
        ...field,
        value: fieldToText(content[field.key], field.kind),
      })),
    };
  });

  return (
    <Shell pageSlug={page.slug}>
      {sections.length === 0 ? (
        <p className="text-[var(--kc-ink-soft)]">
          This page has no sections yet. Once your site content is loaded they
          will all appear here.
        </p>
      ) : (
        <SectionEditor sections={sections} library={library} />
      )}
    </Shell>
  );
}

function Shell({ pageSlug, children }: { pageSlug: string; children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2.5">
        <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-bold">
          Edit My Website
        </h1>
        <HelpMark topic="website.editing" />
      </div>
      <p className="mt-2 text-[var(--kc-ink-soft)]">
        Every part of your website is a card below. Flip a switch to show or hide
        it. Click Edit to change the words and photos. Use the arrows to reorder.
      </p>
      <p className="mt-2 mb-7 inline-block rounded-[var(--kc-radius)] bg-[var(--kc-brand-wash)] px-3 py-1.5 text-sm">
        You cannot break anything. Every change can be undone.
      </p>

      {/* A plain form + links: changing page is navigation, not state, so it
          survives a refresh and can be linked to. */}
      <p className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-[var(--kc-ink-soft)] uppercase">
        Pick a page
      </p>
      <nav className="mb-7 flex flex-wrap gap-1.5" aria-label="Pick a page">
        {PAGES.map((p) => (
          <a
            key={p.slug}
            href={`/portal/website?page=${p.slug}`}
            aria-current={p.slug === pageSlug ? "page" : undefined}
            className={
              p.slug === pageSlug
                ? "rounded-full bg-[var(--kc-brand)] px-3.5 py-1.5 text-sm font-semibold text-[var(--kc-brand-contrast)]"
                : "rounded-full border border-[var(--kc-line)] px-3.5 py-1.5 text-sm hover:bg-[var(--kc-paper-dim)]"
            }
          >
            {p.label}
          </a>
        ))}
      </nav>

      {children}
    </div>
  );
}
