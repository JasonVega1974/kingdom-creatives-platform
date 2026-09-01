import Link from "next/link";

import {
  EventList,
  GroupList,
  MinistryList,
  VideoGrid,
} from "@/components/site/collections";
import { PrayerForm, VisitForm } from "@/components/site/public-forms";
import { Scripture } from "@/components/site/scripture";
import { SermonPlayer } from "@/components/site/sermon-player";
import { DevotionalCard } from "@/components/site/devotionals";
import { WorshipGrid } from "@/components/site/worship-grid";
import { getBibleProvider } from "@/lib/bible";
import { dailyDevotionalIndex } from "@/lib/devotional-day";
import { DEVOTIONALS } from "@/lib/devotionals";
import { booksIn, resolveBook, resolveChapter } from "@/lib/bible-books";
import type { Church } from "@/lib/church";
import { parseServiceTimes } from "@/lib/church";
import type { Collections } from "@/lib/collections";
import type { ChurchLink } from "@/lib/links";
import { obj, rows, sectionContent, strings, type SectionRow } from "@/lib/sections";
import { WORSHIP_CATEGORY, WORSHIP_PLAYLIST } from "@/lib/worship-playlist";

/**
 * ============================================================
 * SECTION RENDERER - church_sections row -> markup
 * ============================================================
 *
 * The switch `lib/portal/sections.ts` refers to when it says "add its renderer
 * in the Phase B section switch". One entry per section_key.
 *
 * THE MARKUP AND CLASS NAMES ARE THE PROTOTYPE'S, and the styling lives in
 * app/(public)/site.css, ported mechanically from the same file. An earlier
 * pass wrote these in Tailwind against the theme tokens; it carried the right
 * words and the right colours and did not look like the design, because the
 * eyebrow rule, the logbook, the mile-marker plates and the dark bands are too
 * specific to re-derive by eye.
 *
 * WHO DECIDES WHAT RENDERS. The database, not the registry. A row in
 * church_sections renders if this switch knows its key; the registry governs
 * whether a pastor can EDIT it. An unknown key renders nothing in production
 * and a labelled placeholder in development.
 */

export type SectionContext = {
  /** The tenant. The hero's logbook renders churches.service_times. */
  church: Church;
  /** Resolved once per page and passed down; see givingLink(). */
  giving: ChurchLink | null;
  /**
   * The church's video channels, for the Worship page. CFT has two and the
   * labels are what distinguish them - see videoChannels().
   */
  videoChannels: ChurchLink[];
  /** Only the collections this page asked for are populated. */
  collections: Collections;
  /**
   * The active `?filter=` value, or null for "all". Filters run through the URL
   * rather than client state: linkable, survives a reload, works with
   * JavaScript off, and the lists stay Server Components.
   */
  filter: string | null;
  /** ?book= and ?chapter= for the Bible reader. Null when absent. */
  book: string | null;
  chapter: string | null;
  /**
   * True while rendering inside a LAYOUT_GROUPS column.
   *
   * A grouped section omits its own `.wrap`, because the group wrapper already
   * supplies one. Without this, every grouped section would nest a second
   * centred container inside a grid cell and the columns would not line up.
   */
  grouped?: boolean;
};

/**
 * ============================================================
 * LAYOUT GROUPS - sections the prototype places side by side
 * ============================================================
 *
 * The prototype puts some sections in two-column grids: About beside its stat
 * tiles, "what to expect" beside the visit form, the Bible reader beside its
 * sidebar. Those are separate rows in church_sections, each with its own sort
 * order and visibility, so a renderer cannot simply nest the next one.
 *
 * This is the declarative answer, and it is DATA rather than coupling: a page
 * lists which section keys share a grid and in which column. Anything not named
 * here renders in its normal place, in order. Hide a key in the portal and the
 * group quietly renders one column - nothing breaks and no renderer has to know
 * about another.
 *
 * `className` is the prototype's own grid class, styled in site.css.
 */
export type LayoutGroup = {
  className: string;
  /** One entry per column; each column lists the section keys it holds. */
  columns: string[][];
};

export const LAYOUT_GROUPS: Record<string, LayoutGroup[]> = {
  home: [
    {
      className: "wrap about-grid",
      /*
       * The right column lists BOTH keys, and that is the multi-tenant switch:
       * a church with daily_devotional in its sections gets the devotional
       * card; one without it (every church but CFT today) still gets its
       * mile-marker stats; hidden sections render nothing. No shared code
       * knows which church chose what.
       */
      columns: [["about_strip"], ["daily_devotional", "mile_stats"]],
    },
  ],
  visit: [{ className: "wrap split", columns: [["expect", "faq"], ["visit_form"]] }],
  bible: [
    {
      className: "wrap bible-shell",
      columns: [["reader"], ["verse_of_day", "reading_plan", "ylcc_bridge"]],
    },
  ],
};

export function SectionRenderer({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  switch (section.section_key) {
    case "hero":
      return <HomeHero section={section} context={context} />;
    case "page_hero":
      return <PageHero section={section} />;

    case "about_strip":
      return <AboutStrip section={section} context={context} />;
    case "daily_devotional":
      return <DailyDevotional section={section} context={context} />;
    case "mile_stats":
      return <MileStats section={section} context={context} />;
    case "get_connected":
      return <GetConnected section={section} />;
    case "latest_sermon":
      return <LatestSermon section={section} context={context} />;
    case "events_preview":
      return <EventsPreview section={section} context={context} />;
    case "bulletin":
      return <Bulletin section={section} context={context} />;

    case "expect":
      return <Expect section={section} context={context} />;
    case "faq":
      return <Faq section={section} context={context} />;
    case "visit_form":
      return <VisitFormSection section={section} context={context} />;

    case "timeline":
      return <Timeline section={section} />;
    case "beliefs":
      return <Beliefs section={section} />;
    case "ministries_intro":
      return <MinistriesSection section={section} context={context} />;
    case "about_ctas":
      return <CtaRow section={section} />;

    case "reader":
      return <BibleReader section={section} context={context} />;
    case "verse_of_day":
      return <VerseOfDay section={section} context={context} />;
    case "reading_plan":
    case "ylcc_bridge":
      return <CalloutCard section={section} context={context} />;

    case "group_filters":
      return <GroupsSection section={section} context={context} />;
    case "event_filters":
      return <EventsSection section={section} context={context} />;
    case "worship_filters":
      return <WorshipSection section={section} context={context} />;

    case "giving_band":
    case "give_band":
      return <GivingBand section={section} giving={context.giving} />;
    case "other_ways":
      return <OtherWays section={section} />;

    default:
      return <UnbuiltSection sectionKey={section.section_key} />;
  }
}

// ---------------------------------------------------------------
// Wrappers
// ---------------------------------------------------------------

/**
 * The prototype's centred container.
 *
 * Skipped when grouped: the LAYOUT_GROUPS wrapper already supplies `.wrap`, and
 * nesting a second one inside a grid cell breaks the columns.
 */
function Wrap({
  context,
  className,
  style,
  children,
}: {
  context: SectionContext;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (context.grouped) return <>{children}</>;

  return (
    <div className={className ? `wrap ${className}` : "wrap"} style={style}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------
// Heroes
// ---------------------------------------------------------------

/**
 * The home hero.
 *
 * Three parts: a full-bleed banner, the welcome copy with its buttons, and the
 * "driver's log" - the church's service times as a timetable panel.
 *
 * THE LOGBOOK READS churches.service_times, not the section content. The seed
 * supplies only its heading and timezone; the rows are the same service times
 * the pastor edits in Church Details, so the hero cannot drift from the rest of
 * the site.
 *
 * The visible heading is the banner image, so the H1 is screen-reader only -
 * the prototype's own structure. A page still needs exactly one H1, and it
 * should say what the banner says.
 */
function HomeHero({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { eyebrow, headline, lede, logbook_title, logbook_tz, image_desktop } =
    sectionContent(section.content);
  const ctas = rows(section.content, "ctas");
  const services = parseServiceTimes(context.church.service_times);

  const plate =
    services.length > 0 ? (
      /* The Driver's Log glass plate - NO-IMAGE FALLBACK ONLY since the
         2026-09-01 revision. A church without a banner still gets the stacked
         plate in the night-band hero; the image path shows the photo clean and
         puts the times on the CTA bar below (see timesStrip). */
      <div className="plate" role="table" aria-label="Service times">
        <div className="plate-head">
          <span>{logbook_title ?? "Service times"}</span>
          <span>{logbook_tz ?? services[0]?.tz ?? ""}</span>
        </div>
        {services.map((slot, index) => (
          <div key={index} className="plate-row" role="row">
            <span className="pk">{slot.day ?? ""}</span>
            <span className="pt">{slot.time ?? ""}</span>
            <span className="pv">
              {slot.streaming ? <span className="live-dot" aria-hidden="true" /> : null}
              {slot.label ?? ""}
            </span>
          </div>
        ))}
      </div>
    ) : null;

  /*
   * The horizontal service-times strip for the CTA bar. Same data as the
   * plate, laid flat: DAY TIME label | DAY TIME label. The pipe separators are
   * CSS pseudo-content; the real structure is a list, so screen readers get
   * items, not punctuation.
   */
  const timesStrip =
    services.length > 0 ? (
      <div className="times-strip" role="list" aria-label="Service times">
        {services.map((slot, index) => (
          <span key={index} role="listitem" className="ts-item">
            {slot.streaming ? <span className="live-dot" aria-hidden="true" /> : null}
            <span className="ts-day">{slot.day ?? ""}</span>
            <span className="ts-time">{slot.time ?? ""}</span>
            <span className="ts-label">{slot.label ?? ""}</span>
          </span>
        ))}
      </div>
    ) : null;

  /*
   * IMAGE-FORWARD HERO (revised 2026-09-01, Jason's call). The banner photo
   * stands alone: no headline, kicker or lede rendered over it - the live text
   * was competing with the wordmark baked into the photograph, not adding to
   * it. The h1 stays in the DOM as sr-only for screen readers and SEO,
   * carrying the clean tagline from the (portal-edited) headline field. CTAs
   * sit BELOW the image on a slim night strip, where contrast is guaranteed
   * rather than negotiated with a photo.
   *
   * MULTI-TENANT GUARD: a church with NO banner image keeps the visible-text
   * night-band hero - otherwise that tenant's page would have no heading a
   * person could see. Same section, two honest renderings.
   */
  if (image_desktop) {
    return (
      <div className="hero hero-photo">
        <h1 className="sr-only">{headline ?? context.church.name ?? context.church.slug}</h1>

        {/* The photo, fully visible - the floating plate was covering the
            truck. Times moved to the bar below (2026-09-01). */}
        <div className="hero-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image_desktop} alt="" />
        </div>

        {ctas.length > 0 || timesStrip ? (
          <div className="hero-bar">
            <div className="wrap hero-bar-row">
              {ctas.length > 0 ? <div className="hero-ctas">{ctaLinks(ctas, true)}</div> : null}
              {timesStrip}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="hero hero-cine">
      <div className="wrap hero-cine-grid">
        <div className="hero-copy">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1>{headline ?? context.church.name ?? context.church.slug}</h1>
          {lede ? <p className="lede">{lede}</p> : null}
          {ctas.length > 0 ? <div className="hero-ctas">{ctaLinks(ctas, true)}</div> : null}
        </div>
        {plate}
      </div>
    </div>
  );
}

/** Every inner page opens with this. */
function PageHero({ section }: { section: SectionRow }) {
  const { eyebrow, headline, lede } = sectionContent(section.content);
  if (!headline) return null;

  return (
    <div className="wrap page-hero">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h1>{headline}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------
// Home
// ---------------------------------------------------------------

function AboutStrip({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { eyebrow, heading, lead_in, verse, verse_cite } = sectionContent(section.content);
  const paragraphs = strings(section.content, "body");
  const cta = obj(section.content, "cta");

  const body = (
    <>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      {heading ? <h2>{heading}</h2> : null}

      {lead_in ? (
        <p>
          <strong>{lead_in}</strong>
        </p>
      ) : null}
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}

      {verse ? (
        <blockquote className="verse">
          {verse}
          {verse_cite ? <cite>{verse_cite}</cite> : null}
        </blockquote>
      ) : null}

      {cta.href && cta.label ? (
        <Link href={cta.href} className="btn btn-ghost">
          {cta.label}
        </Link>
      ) : null}
    </>
  );

  if (context.grouped) return <div>{body}</div>;

  return (
    <div className="about-strip">
      <div className="wrap">{body}</div>
    </div>
  );
}

/**
 * The mile-marker stat tiles.
 *
 * `marker` becomes data-mm, which the CSS prints in the corner through
 * ::before with attr() - so it has to be an attribute, not a child element.
 */
/**
 * Home: the full daily devotional, in the grid column the stats used to hold.
 *
 * The entry is chosen SERVER-SIDE by the same dailyDevotionalIndex() the
 * /devotionals page uses - one selector, so the two never disagree about what
 * day it is - and only that one entry reaches the markup. lib/devotionals.ts
 * is server-only, so a client import is a build error, not a fat page.
 */
function DailyDevotional({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const content = sectionContent(section.content);
  const index = dailyDevotionalIndex();

  const card = (
    <DevotionalCard
      devotional={DEVOTIONALS[index]}
      dayNumber={index + 1}
      label={content.label ?? "Today's devotional"}
      readLabel={content.read_label ?? "Read the full devotional"}
    />
  );

  if (context.grouped) return card;
  return (
    <Wrap context={context} style={{ paddingBottom: "76px" }}>
      {card}
    </Wrap>
  );
}

function MileStats({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const items = rows(section.content, "items");
  if (items.length === 0) return null;

  const grid = (
    <div className="mile-stats">
      {items.map((item, index) => (
        <div key={index} className="mile" data-mm={item.marker ?? ""}>
          <b>{item.value}</b>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );

  if (context.grouped) return grid;

  return (
    <Wrap context={context} style={{ paddingBottom: "76px" }}>
      {grid}
    </Wrap>
  );
}

function GetConnected({ section }: { section: SectionRow }) {
  const { eyebrow, heading } = sectionContent(section.content);
  const cards = rows(section.content, "cards");

  return (
    <div style={{ padding: "0 0 84px" }}>
      <div className="wrap">
        <div style={{ marginBottom: "28px" }}>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          {heading ? <h2>{heading}</h2> : null}
        </div>

        {cards.length > 0 ? (
          <div className="cardgrid">
            {cards.map((card, index) => {
              const inner = (
                <>
                  {card.kicker ? <span className="card-kicker">{card.kicker}</span> : null}
                  <h3 style={{ margin: "10px 0 6px" }}>{card.title}</h3>
                  {card.body ? <p>{card.body}</p> : null}
                </>
              );

              return card.href ? (
                <Link
                  key={index}
                  href={card.href}
                  className="card"
                  style={{ textDecoration: "none", padding: "26px 28px" }}
                >
                  {inner}
                </Link>
              ) : (
                <div key={index} className="card" style={{ padding: "26px 28px" }}>
                  {inner}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Home: this week's message, in the prototype's dark band.
 *
 * The prototype draws a play-button facade over a thumbnail. That facade is a
 * YouTube-player concern and belongs with the sermon work, so this links out
 * instead - the band, the meta line and the archive link are the prototype's.
 */
function LatestSermon({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { eyebrow, badge, archive_label, archive_href, empty } = sectionContent(
    section.content,
  );
  const latest = context.collections.sermons[0];

  return (
    <div className="sermon-band on-dark">
      <div className="wrap sermon-grid">
        <div>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}

          {latest ? (
            <>
              <h2>{latest.title}</h2>
              <div className="sermon-meta">
                {[
                  latest.series,
                  latest.scripture_ref,
                  latest.duration_min ? `${latest.duration_min} min` : null,
                ]
                  .filter(Boolean)
                  .map((bit, index) => (
                    <span key={index}>{bit}</span>
                  ))}
              </div>
              {latest.summary ? <p className="sermon-desc">{latest.summary}</p> : null}
            </>
          ) : (
            <p className="sermon-desc">{empty ?? "No sermon posted yet."}</p>
          )}

          {archive_label && archive_href ? (
            <Link href={archive_href} className="archive-link">
              {archive_label}
            </Link>
          ) : null}
        </div>

        {latest?.youtube_id ? (
          /* Plays in place rather than opening a new tab. The facade keeps the
             page cheap - nothing is requested from YouTube until someone
             presses play. See SermonPlayer. */
          <SermonPlayer
            youtubeId={latest.youtube_id}
            title={latest.title}
            badge={badge ?? undefined}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Home: the next few events, as mile-marker plates. */
function EventsPreview({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { eyebrow, heading, limit, empty } = sectionContent(section.content);
  const cta = obj(section.content, "cta");

  const count = Number.parseInt(limit ?? "", 10);
  const events = context.collections.events.slice(
    0,
    Number.isFinite(count) && count > 0 ? count : 3,
  );

  return (
    /* band-dim: the alternating paper-dim ground the Phase 1 audit deferred
       until sections had classes to carry it. Full-width div, so the tint is
       genuinely full-bleed. */
    <div className="band-dim" style={{ padding: "84px 0" }}>
      <div className="wrap">
        <SplitHead eyebrow={eyebrow} heading={heading} cta={cta} />
        <EventList events={events} empty={empty ?? "Nothing on the calendar yet."} />
      </div>
    </div>
  );
}

/**
 * Home: the bulletin board - announcements and the prayer wall.
 *
 * The prayer form is a <details> inside the second card rather than the
 * prototype's prompt() dialogs. See FF-34 for why the CTA was held back until
 * the insert policy could refuse a pre-approved submission.
 */
function Bulletin({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const content = sectionContent(section.content);
  const { announcements, prayer } = context.collections;

  return (
    /* Anchor target for "Add a request", which links to #prayer. The prayer
       wall is this section, on the home page - not /visit, where the seed
       pointed it. */
    <div id="prayer" style={{ padding: "0 0 84px" }}>
      <div className="wrap">
        <div style={{ marginBottom: "40px" }}>
          {content.eyebrow ? <span className="eyebrow">{content.eyebrow}</span> : null}
          {content.heading ? <h2>{content.heading}</h2> : null}
        </div>

        {/* items-start keeps each card content-height: one short announcement
            no longer stretches into a tall blank box to match its neighbour. */}
        <div className="cardgrid two bulletin-grid">
          <div className="bcard">
            <div className="bcard-head">
              <span className="icon-ring" aria-hidden="true">
                {/* bullhorn */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v3a1 1 0 0 0 1 1h2l3.6 4.5a1 1 0 0 0 1.8-.6V5.1a1 1 0 0 0-1.8-.6L6 9H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6.5a8 8 0 0 1 0 11"/></svg>
              </span>
              <h3>{content.announcements_title ?? "Announcements"}</h3>
            </div>

            {announcements.length > 0 ? (
              <div className="bcard-list">
                {announcements.map((item) => (
                  <div key={item.id} className="ann">
                    {/* Real data only: the chip renders when the pastor set an
                        end date, and never invents one when they did not. */}
                    {item.expires_at ? (
                      <span className="ann-when">Through {shortDate(item.expires_at)}</span>
                    ) : null}
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="bcard-empty">
                {content.announcements_empty ?? "Nothing posted this week."}
              </p>
            )}
          </div>

          <div className="bcard">
            <div className="bcard-head">
              <span className="icon-ring" aria-hidden="true">
                {/* heart */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 7a5.5 5.5 0 0 1 9.5 5c-2.5 4.4-9.5 9-9.5 9z"/></svg>
              </span>
              <h3>{content.prayer_title ?? "Prayer list"}</h3>
            </div>

            {prayer.length > 0 ? (
              <div className="bcard-list">
                {prayer.map((item) => (
                  <div key={item.id} className="ann">
                    <p>
                      {item.display_name ? <strong>{item.display_name}</strong> : null}
                      {item.display_name ? " - " : null}
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="bcard-empty">{content.prayer_empty ?? "No requests right now."}</p>
            )}

            {content.prayer_note ? (
              <div className="card-foot" style={{ paddingTop: "16px" }}>
                <span>{content.prayer_note}</span>
              </div>
            ) : null}

            <PrayerForm content={content} />

            {content.prayer_pending_note ? (
              <p style={{ marginTop: "12px", fontSize: "14px", color: "var(--kc-ink-soft)" }}>
                {content.prayer_pending_note}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Sep 13" from a timestamp, UTC like every other public date (FF-38). */
function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
}

function Expect({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { heading } = sectionContent(section.content);
  const items = rows(section.content, "items");

  return (
    <Wrap context={context}>
      {heading ? (
        <h2 style={{ fontSize: "26px", marginBottom: "18px" }}>{heading}</h2>
      ) : null}
      <div className="expect">
        {items.map((item, index) => (
          <div key={index} className="expect-item">
            <div className="ico" aria-hidden="true">
              {item.icon ?? ""}
            </div>
            <div>
              <h3>{item.title}</h3>
              {item.body ? <p>{item.body}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/**
 * Native <details>, as the prototype uses.
 *
 * Keyboard and screen-reader accessible for free, and it works with JavaScript
 * off. The +/- marker is drawn by CSS on summary::after.
 */
function Faq({ section, context }: { section: SectionRow; context: SectionContext }) {
  const { heading } = sectionContent(section.content);
  const items = rows(section.content, "items");

  return (
    <Wrap context={context}>
      <div className="faq">
        {heading ? (
          <h2 style={{ fontSize: "26px", marginBottom: "18px" }}>{heading}</h2>
        ) : null}
        <div>
          {items.map((item, index) => (
            <details key={index}>
              <summary>{item.q}</summary>
              {item.a ? <p>{item.a}</p> : null}
            </details>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

/**
 * Plan a Visit.
 *
 * Every label, placeholder and option is seeded content, so a pastor can reword
 * the whole form from the portal. The option lists are read with strings()
 * because sectionContent() keeps only scalars and would drop them.
 */
function VisitFormSection({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const content = sectionContent(section.content);

  return (
    <Wrap context={context}>
      <VisitForm
        content={content}
        whenOptions={strings(section.content, "when_options")}
        rigOptions={strings(section.content, "rig_options")}
      />
    </Wrap>
  );
}

// ---------------------------------------------------------------
// About
// ---------------------------------------------------------------

/** The dated history, as a vertical rule with dots. */
function Timeline({ section }: { section: SectionRow }) {
  const stops = rows(section.content, "stops");
  if (stops.length === 0) return null;

  return (
    <div className="wrap-narrow">
      <div className="timeline">
        {stops.map((stop, index) => (
          <div key={index} className="tstop">
            {stop.year || stop.marker ? (
              <div className="yr">
                {[stop.year, stop.marker].filter(Boolean).join(" - ")}
              </div>
            ) : null}
            <h3>{stop.title}</h3>
            {stop.body ? <p>{stop.body}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Beliefs({ section }: { section: SectionRow }) {
  const { heading, lede } = sectionContent(section.content);
  const items = rows(section.content, "items");

  return (
    <div className="wrap-narrow" style={{ paddingBottom: "40px" }}>
      {heading ? <h2 style={{ marginTop: "56px" }}>{heading}</h2> : null}
      {lede ? <p className="lede">{lede}</p> : null}

      <div className="beliefs">
        {items.map((item, index) => (
          <div key={index} className="belief">
            <h3>{item.title}</h3>
            {item.body ? <p>{item.body}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ministries: the intro copy, then the list it introduces. */
function MinistriesSection({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { heading, lede, empty } = sectionContent(section.content);

  return (
    /* Anchor target. "Where gifts go" on the home page links to /about#ministries
       - without this it lands at the top of /about and a visitor reads the
       church's founding story before reaching the ministry list. */
    <div id="ministries" className="wrap-narrow" style={{ paddingBottom: "60px" }}>
      {heading ? <h2 style={{ marginTop: "40px" }}>{heading}</h2> : null}
      {lede ? <p className="lede">{lede}</p> : null}
      <div style={{ marginTop: "24px" }}>
        <MinistryList
          ministries={context.collections.ministries}
          empty={empty ?? "Ministry list coming soon."}
        />
      </div>
    </div>
  );
}

function CtaRow({ section }: { section: SectionRow }) {
  const ctas = rows(section.content, "ctas");
  if (ctas.length === 0) return null;

  return (
    <div className="wrap" style={{ paddingBottom: "76px" }}>
      <div className="hero-ctas">{ctaLinks(ctas, false)}</div>
    </div>
  );
}

// ---------------------------------------------------------------
// Bible
// ---------------------------------------------------------------

/**
 * The Bible reader.
 *
 * An async Server Component that fetches its own passage: the book list and
 * defaults are section content, so only this component knows what to ask for.
 * No key reaches the browser - the provider module is server-only.
 *
 * Navigation runs through the URL (?book=&chapter=), same as the list filters:
 * linkable, survives a reload, works with JavaScript off. The form submits with
 * GET for exactly that reason.
 *
 * Both inputs are attacker-controlled, so both are normalised against the
 * church's own seeded book list and a 1-150 chapter range before anything
 * reaches a provider URL.
 */
async function BibleReader({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const content = sectionContent(section.content);

  /*
   * The seeded `books` array is now QUICK LINKS, not the allow-list. It used to
   * be both, which meant six books existed and ?book=Genesis silently fell back
   * to Psalms. The canon lives in lib/bible-books.ts because it is the same for
   * every church - see the note there.
   */
  const quickLinks = strings(section.content, "books");

  const fallbackBook = content.default_book ?? quickLinks[0] ?? "John";
  const book = resolveBook(context.book, fallbackBook);

  /*
   * The church's default chapter applies only to the church's default book.
   * Psalms 121 is "the driver's psalm"; carrying 121 over to Obadiah, which has
   * one chapter, would be nonsense - and resolveChapter would clamp it to 1
   * anyway, silently.
   */
  const isDefaultBook = book.name === resolveBook(fallbackBook, fallbackBook).name;
  const chapter = context.chapter
    ? resolveChapter(book, context.chapter)
    : isDefaultBook
      ? resolveChapter(book, content.default_chapter ?? "1")
      : 1;

  const provider = getBibleProvider();
  const reading = await provider.fetchPassage(book.name, chapter);

  const body = (
    <div className="reader">
      {quickLinks.length > 0 ? (
        <div className="bible-quick">
          <span className="eyebrow">Start here</span>
          <div className="bible-chips">
            {quickLinks.map((name) => (
              <Link key={name} href={`/bible?book=${encodeURIComponent(name)}#scripture`} className="chip">
                {name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/*
        Open when the reader arrives with no book chosen, closed once they are
        reading - at which point the passage is what they came for and 66 book
        buttons above it are in the way. A <details> rather than a script, for
        the same reason the mobile menu is one: it works with JavaScript off and
        every choice inside it is a real link.
      */}
      <details className="bible-picker" open={!context.book}>
        <summary>Choose a book</summary>

        {(["old", "new"] as const).map((testament) => (
          <details key={testament} className="bible-testament" open={book.testament === testament}>
            <summary>
              {testament === "old" ? "Old Testament" : "New Testament"}{" "}
              <span className="bible-count">({booksIn(testament).length})</span>
            </summary>
            <div className="bible-books">
              {booksIn(testament).map((entry) => (
                <Link
                  key={entry.name}
                  href={`/bible?book=${encodeURIComponent(entry.name)}#scripture`}
                  className={entry.name === book.name ? "bible-book is-current" : "bible-book"}
                  aria-current={entry.name === book.name ? "page" : undefined}
                >
                  {entry.name}
                </Link>
              ))}
            </div>
          </details>
        ))}
      </details>

      {/*
        Exactly as many chapters as the book has. The old control offered 1-150
        for everything, so Philemon had 149 links to chapters that do not exist.
      */}
      <nav className="bible-chapters" aria-label={`Chapters in ${book.name}`}>
        {Array.from({ length: book.chapters }, (_, index) => index + 1).map((n) => (
          <Link
            key={n}
            href={`/bible?book=${encodeURIComponent(book.name)}&chapter=${n}#scripture`}
            className={n === chapter ? "bible-chapter is-current" : "bible-chapter"}
            aria-current={n === chapter ? "page" : undefined}
          >
            {n}
          </Link>
        ))}
      </nav>

      {reading ? (
        <Scripture
          book={book}
          chapter={chapter}
          reference={reading.reference}
          translation={reading.translation}
          subtitle={isDefaultBook ? content.default_subtitle : null}
          text={reading.text}
          attribution={reading.attribution}
        />
      ) : (
        <p className="vtext">
          {content.error ?? "That passage could not be loaded right now."}
        </p>
      )}
    </div>
  );

  if (context.grouped) return body;
  return <div className="wrap">{body}</div>;
}

function VerseOfDay({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { title, verse, reference } = sectionContent(section.content);
  if (!verse) return null;

  const card = (
    <div className="side-card">
      {title ? <h4>{title}</h4> : null}
      <p
        style={{
          fontFamily: "var(--kc-font-display)",
          fontStyle: "italic",
          fontSize: "17px",
          color: "var(--kc-ink)",
          margin: "8px 0",
        }}
      >
        {verse}
      </p>
      {reference ? <p>{reference}</p> : null}
    </div>
  );

  if (context.grouped) return card;
  return <div className="wrap">{card}</div>;
}

/** reading_plan and ylcc_bridge share a shape: title, body, optional CTA. */
function CalloutCard({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { title, body, cta_label, cta_href } = sectionContent(section.content);
  if (!title && !body) return null;

  // ylcc_bridge is the branded card in the prototype's sidebar.
  const branded = section.section_key === "ylcc_bridge";

  const card = (
    <div className={branded ? "side-card ylcc" : "side-card"}>
      {title ? <h4>{title}</h4> : null}
      {body ? <p>{body}</p> : null}
      {cta_label ? (
        <Link href={cta_href ?? "#"} className="btn btn-ghost btn-sm">
          {cta_label}
        </Link>
      ) : null}
    </div>
  );

  if (context.grouped) return card;
  return <div className="wrap">{card}</div>;
}

// ---------------------------------------------------------------
// Collection pages
// ---------------------------------------------------------------

function GroupsSection({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { empty, link_label } = sectionContent(section.content);
  const filters = rows(section.content, "filters");
  const groups = context.filter
    ? context.collections.groups.filter((g) => g.location_type === context.filter)
    : context.collections.groups;

  return (
    <div className="wrap" style={{ paddingBottom: "76px" }}>
      <FilterStrip filters={filters} active={context.filter} />
      <GroupList
        groups={groups}
        empty={empty ?? "No groups listed yet."}
        linkLabel={link_label ?? "Join online"}
      />
    </div>
  );
}

function EventsSection({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { empty } = sectionContent(section.content);
  const filters = rows(section.content, "filters");
  const events = context.filter
    ? context.collections.events.filter((e) => e.event_type === context.filter)
    : context.collections.events;

  return (
    <div className="wrap" style={{ paddingBottom: "76px" }}>
      <FilterStrip filters={filters} active={context.filter} />
      <EventList events={events} empty={empty ?? "Nothing on the calendar yet."} />
    </div>
  );
}

function WorshipSection({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const { empty, play_label } = sectionContent(section.content);
  const filters = rows(section.content, "filters");
  const videos = context.filter
    ? context.collections.videos.filter((v) => v.category === context.filter)
    : context.collections.videos;

  /*
   * The seeded playlist answers to the page's OWN filters rather than a new
   * one: these are worship sets, so they show under "Everything" and under
   * "Worship sets" (music), and are correctly absent from "Driver Stories".
   * No filter was invented and none conflicts.
   */
  const showSongs = context.filter === null || context.filter === WORSHIP_CATEGORY;
  const songs = showSongs ? WORSHIP_PLAYLIST : [];

  /*
   * The seeded songs stand in for the empty state. Rendering "No worship
   * videos yet" above thirty worship videos would be absurd, so VideoGrid's
   * empty line is suppressed whenever songs are showing - the page is not
   * empty, it just has no rows in the `videos` table.
   */
  const videoEmpty = songs.length > 0 ? "" : (empty ?? "No worship videos yet.");

  return (
    <div className="wrap" style={{ paddingBottom: "76px" }}>
      <FilterStrip filters={filters} active={context.filter} />
      <VideoGrid videos={videos} empty={videoEmpty} playLabel={play_label ?? "Play"} />
      <WorshipGrid songs={songs} heading={songs.length > 0 ? "Worship playlist" : undefined} />
      <ChannelStrip channels={context.videoChannels} />
    </div>
  );
}

/**
 * "Watch on YouTube" - one button per channel.
 *
 * Rendered whether or not there are videos, not only in the empty state. The
 * channels are where the services actually live; a visitor who wants last
 * Sunday's sermon should not lose the way there the moment somebody uploads a
 * single video and the empty state disappears.
 *
 * The LABEL is the point. Two bare YouTube links tell nobody which is the
 * Sunday service and which is the midweek study, so the label from
 * church_links leads and the platform is the supporting word.
 */
function ChannelStrip({ channels }: { channels: ChurchLink[] }) {
  if (channels.length === 0) return null;

  return (
    <div style={{ marginTop: "32px" }}>
      <span className="eyebrow">Watch on YouTube</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "14px" }}>
        {channels.map((channel) => (
          <a
            key={channel.id}
            className="btn btn-ghost"
            href={channel.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            {channel.label ?? "YouTube channel"}
          </a>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Give
// ---------------------------------------------------------------

/**
 * The giving band - prose and one button out to Tithe.ly.
 *
 * DECIDED 2026-08-28 (Jason): Tithe.ly only, through the `kind = 'giving'` row
 * in church_links. No Stripe, no amount picker, no custom-amount field.
 *
 * The prototype's give-card holds a frequency toggle and an amount ladder, and
 * the seed carries values for both. They are DELIBERATELY NOT RENDERED and are
 * not a bug: amount and frequency are chosen on the Tithe.ly form itself, so
 * collecting them here would be decorative. The card keeps its shape and holds
 * the button. See FF-32.
 */
function GivingBand({
  section,
  giving,
}: {
  section: SectionRow;
  giving: ChurchLink | null;
}) {
  const { eyebrow, heading, body, note, card_title } = sectionContent(section.content);
  const bullets = strings(section.content, "bullets");
  const link = obj(section.content, "link");

  return (
    <div className="wrap" style={{ paddingBottom: "76px" }}>
      <div className="give-band on-dark">
        <div className="giving-grid">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {heading ? <h2>{heading}</h2> : null}
            {body ? <p>{body}</p> : null}

            {bullets.length > 0 ? (
              <ul style={{ marginTop: "16px", paddingLeft: "18px" }}>
                {bullets.map((bullet, index) => (
                  <li key={index}>{bullet}</li>
                ))}
              </ul>
            ) : null}

            {link.href && link.label ? (
              <p style={{ marginTop: "16px" }}>
                <Link href={link.href} className="archive-link">
                  {link.label}
                </Link>
              </p>
            ) : null}
          </div>

          {giving ? (
            <div className="give-card">
              <h3>{card_title ?? "Give securely"}</h3>
              <a
                className="btn btn-solid"
                style={{ width: "100%" }}
                href={giving.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {giving.label}
              </a>
              {note ? <p className="give-note">{note}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OtherWays({ section }: { section: SectionRow }) {
  const items = rows(section.content, "items");
  if (items.length === 0) return null;

  return (
    <div className="wrap" style={{ paddingBottom: "76px" }}>
      <div className="other-ways">
        {items.map((item, index) => (
          <div key={index} className="card" style={{ padding: "22px 24px" }}>
            <h3 style={{ fontSize: "18px", marginBottom: "6px" }}>{item.title}</h3>
            {item.body ? <p style={{ fontSize: "15px" }}>{item.body}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Shared
// ---------------------------------------------------------------

/**
 * The filter strip above a list.
 *
 * Plain links carrying `?filter=`, not client state: linkable, shareable,
 * survives a reload, needs no JavaScript, and keeps the list a Server
 * Component. `value: "all"` clears the filter rather than setting one.
 */
function FilterStrip({
  filters,
  active,
}: {
  filters: Record<string, string>[];
  active: string | null;
}) {
  const usable = filters.filter((f) => f.label && f.value);
  if (usable.length === 0) return null;

  return (
    <div className="chiprow">
      {usable.map((filter) => {
        const isAll = filter.value === "all";
        const isActive = isAll ? active === null : active === filter.value;

        return (
          <Link
            key={filter.value}
            href={isAll ? "?" : `?filter=${encodeURIComponent(filter.value)}`}
            aria-current={isActive ? "true" : undefined}
            className={isActive ? "chip sel" : "chip"}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}

/** A heading block with an optional button pushed to the right. */
function SplitHead({
  eyebrow,
  heading,
  cta,
}: {
  eyebrow?: string;
  heading?: string;
  cta: Record<string, string>;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "end",
        gap: "24px",
        marginBottom: "40px",
        flexWrap: "wrap",
      }}
    >
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        {heading ? <h2>{heading}</h2> : null}
      </div>
      {cta.href && cta.label ? (
        <Link href={cta.href} className="btn btn-ghost">
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Button row from a seeded `ctas` list.
 *
 * `style: "solid" | "ghost"` comes from the seed. On the hero the solid variant
 * is the prototype's gold button; elsewhere it is the brand fill.
 */
function ctaLinks(ctas: Record<string, string>[], gold: boolean) {
  return ctas
    .filter((cta) => cta.label && cta.href)
    .map((cta, index) => {
      const className =
        cta.style === "ghost" ? "btn btn-ghost" : gold ? "btn btn-gold" : "btn btn-solid";

      return cta.href.startsWith("/") ? (
        <Link key={index} href={cta.href} className={className}>
          {cta.label}
        </Link>
      ) : (
        <a
          key={index}
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {cta.label}
        </a>
      );
    });
}

/**
 * Development-only marker for a section with a database row and no renderer.
 *
 * Renders nothing in production, so shipping a page with an unbuilt section
 * degrades to "that part is missing" rather than "that part is a debug box".
 */
function UnbuiltSection({ sectionKey }: { sectionKey: string }) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="wrap" style={{ padding: "12px 24px" }}>
      <div
        style={{
          border: "1px dashed var(--kc-line)",
          borderRadius: "var(--kc-radius)",
          padding: "12px 16px",
          fontFamily: "var(--kc-font-utility)",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          color: "var(--kc-ink-soft)",
        }}
      >
        section not built yet <span style={{ color: "var(--kc-brand)" }}>{sectionKey}</span>
      </div>
    </div>
  );
}
