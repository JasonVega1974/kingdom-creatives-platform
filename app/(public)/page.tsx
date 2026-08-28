import { notFound } from "next/navigation";

import { SectionRenderer } from "@/components/site/section-renderer";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getCurrentChurchSite } from "@/lib/church";
import { getCollectionsFor } from "@/lib/collections";
import { getChurchLinks, givingLink } from "@/lib/links";
import { getPageSections } from "@/lib/sections";

/**
 * ============================================================
 * HOME PAGE
 * ============================================================
 *
 * Identical in shape to the [slug] route - it exists separately only because
 * home lives at `/` rather than `/home`, and `[slug]` would otherwise have to
 * special-case the root. (`/home` redirects here, so the content is never
 * served at two URLs.)
 *
 * The Phase A checkpoint panel that used to live here is gone: it proved
 * hostname -> church_id -> themed render against live data, and the page now
 * does that continuously by rendering real content. Its removal was always
 * part of Phase B.
 */
export default async function HomePage() {
  const site = await getCurrentChurchSite();
  if (!site) notFound();

  const [sections, links, collections] = await Promise.all([
    getPageSections(site.church.slug, site.church.id, "home"),
    getChurchLinks(site.church.slug, site.church.id),
    // Home's collection-backed sections - latest_sermon, events_preview,
    // bulletin - are step 4, so nothing is queried for it yet.
    getCollectionsFor(site.church.slug, site.church.id, []),
  ]);

  const context = { giving: givingLink(links), collections };

  return (
    <>
      <SiteHeader church={site.church} theme={site.theme} />

      <main>
        {sections.map((section) => (
          <SectionRenderer key={section.id} section={section} context={context} />
        ))}
      </main>

      <SiteFooter church={site.church} />
    </>
  );
}
