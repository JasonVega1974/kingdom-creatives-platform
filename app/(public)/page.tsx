import { notFound } from "next/navigation";

import { PageSections } from "@/components/site/page-sections";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getCurrentChurchSite } from "@/lib/church";
import { getCollectionsFor } from "@/lib/collections";
import { getChurchLinks, givingLink, videoChannels } from "@/lib/links";
import { DevotionalTeaser } from "@/components/site/devotional-teaser";
import { dailyDevotionalIndex } from "@/lib/devotional-day";
import { DEVOTIONALS } from "@/lib/devotionals";
import { buildSermonFeed } from "@/lib/sermon-feed";
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
    // latest_sermon, events_preview and bulletin all read from these.
    getCollectionsFor(site.church.slug, site.church.id, [
      "sermons",
      "events",
      "announcements",
      "prayer",
    ]),
  ]);

  // Home has no filterable list and no Bible reader.
  // The latest-sermon band reads collections.sermons[0], so merging the feed
  // in here is what makes it the newest upload rather than the newest row.
  const collectionsWithFeed = {
    ...collections,
    sermons: await buildSermonFeed(links, collections.sermons),
  };

  const context = {
    church: site.church,
    giving: givingLink(links),
    videoChannels: videoChannels(links),
    collections: collectionsWithFeed,
    filter: null,
    book: null,
    chapter: null,
  };

  return (
    <>
      <SiteHeader church={site.church} theme={site.theme} activeSlug={"home"} links={links} />

      <main>
        {/*
          Today's devotional, immediately after "this week's message".

          Placed there because both are "here is something to read or watch
          right now", so they read as one idea rather than two - and because it
          is high on the page without displacing the banner or the church's own
          introduction. It sits between the dark sermon band and the events
          list, which gives the eye a light break between two heavy blocks.

          THE ENTRY IS PICKED ON THE SERVER, and this is the whole size story:
          lib/devotionals.ts is ~253 KB and server-only, dailyDevotionalIndex()
          chooses one, and only that one crosses into the markup. The home page
          never carries the array.

          The SAME selector the /devotionals page uses - not a second copy of
          the date logic. Two implementations would drift and the two pages
          would eventually disagree about what day it is.
        */}
        <PageSections
          pageSlug={"home"}
          sections={sections}
          context={context}
          afterSection={{
            latest_sermon: (
              <DevotionalTeaser devotional={DEVOTIONALS[dailyDevotionalIndex()]} />
            ),
          }}
        />
      </main>

      <SiteFooter church={site.church} links={links} />
    </>
  );
}
