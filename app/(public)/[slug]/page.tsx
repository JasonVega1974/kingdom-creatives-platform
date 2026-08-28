import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SectionRenderer } from "@/components/site/section-renderer";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getCurrentChurchSite } from "@/lib/church";
import { getChurchLinks, givingLink } from "@/lib/links";
import { getPageSections } from "@/lib/sections";
import { PAGES } from "@/lib/portal/sections";

/**
 * ============================================================
 * PUBLIC PAGE - every church page except home
 * ============================================================
 *
 * One route for ten pages. The slug is validated against the PAGES registry
 * rather than passed to the database, so an unknown path 404s without a query
 * and cannot be used to probe for tables.
 *
 * `/portal` is unaffected: a static segment outranks a dynamic one in the App
 * Router, so app/(portal)/portal/page.tsx still wins even though `[slug]`
 * could match the same URL.
 *
 * Home lives at `/`, not `/home` - see the redirect below.
 */

const HOME_SLUG = "home";

/** The page registry entry for a slug, or null. */
function findPage(slug: string) {
  return PAGES.find((page) => page.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = findPage(slug);

  // The layout's template supplies "| {church name}".
  return page ? { title: page.label } : {};
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // The home page is `/`. Redirect rather than render it twice: two URLs
  // serving identical content is a duplicate-content problem, and the nav
  // only ever links to `/`.
  if (slug === HOME_SLUG) redirect("/");

  const page = findPage(slug);
  if (!page) notFound();

  const site = await getCurrentChurchSite();
  if (!site) notFound();

  // One round trip each, in parallel. Links are needed only by the giving
  // sections, but fetching them per-section would mean a query inside a
  // render loop.
  const [sections, links] = await Promise.all([
    getPageSections(site.church.slug, site.church.id, page.slug),
    getChurchLinks(site.church.slug, site.church.id),
  ]);

  const context = { giving: givingLink(links) };

  return (
    <>
      <SiteHeader church={site.church} theme={site.theme} />

      <main>
        {sections.length > 0 ? (
          sections.map((section) => (
            <SectionRenderer key={section.id} section={section} context={context} />
          ))
        ) : (
          <EmptyPage label={page.label} />
        )}
      </main>

      <SiteFooter church={site.church} />
    </>
  );
}

/**
 * A page the church has, with nothing visible on it yet.
 *
 * Reachable two ways, both legitimate:
 *
 *   - every section is toggled off in the portal
 *   - the page is seeded but its content is a deferred decision, which is
 *     exactly /devotionals today (FF-30)
 *
 * It must not 404. The header nav links to these pages, and a 404 behind a
 * live nav link reads as a broken site rather than a section still to come.
 * The shell renders - header, theme, footer - so the page still looks like
 * part of the church's site while it waits for content.
 */
function EmptyPage({ label }: { label: string }) {
  return (
    <section className="px-6 pt-16 pb-24 sm:pt-24">
      <div className="mx-auto max-w-[1120px]">
        <h1 className="text-[clamp(30px,4vw,44px)] text-ink">{label}</h1>
        <p className="mt-4 max-w-[58ch] text-lg text-ink-soft">
          This page is on its way. Check back soon.
        </p>
      </div>
    </section>
  );
}
