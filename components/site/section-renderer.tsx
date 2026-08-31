import Link from "next/link";

import {
  EventList,
  GroupList,
  MinistryList,
  VideoGrid,
} from "@/components/site/collections";
import type { Church } from "@/lib/church";
import { parseServiceTimes } from "@/lib/church";
import type { Collections } from "@/lib/collections";
import { PrayerForm, VisitForm } from "@/components/site/public-forms";
import {
  getBibleProvider,
  normalizeBook,
  normalizeChapter,
} from "@/lib/bible";
import type { ChurchLink } from "@/lib/links";
import { obj, rows, sectionContent, strings, type SectionRow } from "@/lib/sections";

/**
 * ============================================================
 * SECTION RENDERER - church_sections row -> markup
 * ============================================================
 *
 * The switch `lib/portal/sections.ts` refers to when it says "add its renderer
 * in the Phase B section switch". One entry per section_key.
 *
 * WHO DECIDES WHAT RENDERS. The database, not the registry. A row in
 * church_sections renders if this switch knows its key; the registry governs
 * whether a pastor can EDIT it in the portal. The two are deliberately
 * independent, so a section can ship to the public site before it is
 * editable, or be described for the portal before its renderer exists.
 *
 * An unknown key renders nothing in production. In development it renders a
 * labelled placeholder instead, so an unbuilt section is visible while
 * building rather than silently absent - which would look identical to a
 * section that failed to load.
 *
 * STEP 2 SCOPE: every prose section across all eleven pages. What still falls
 * through to the placeholder is deliberate and falls in two groups:
 *
 *   - collection-backed (step 3): latest_sermon, events_preview, bulletin,
 *     ministries list, group/event/worship filters
 *   - interactive (step 4+): visit_form, reader, and the giving amount picker
 *
 * The giving sections are a special case: their PROSE renders here, and only
 * the amount picker is held back. See GivingBand below.
 */

export type SectionContext = {
  /** The tenant. The hero's logbook renders churches.service_times. */
  church: Church;
  /** Resolved once per page and passed down; see givingLink(). */
  giving: ChurchLink | null;
  /** Only the collections this page asked for are populated. */
  collections: Collections;
  /**
   * The active `?filter=` value, or null for "all".
   *
   * Filters run through the URL rather than client state on purpose: the
   * result is linkable, survives a reload, and works with JavaScript off.
   * The lists stay Server Components either way.
   */
  filter: string | null;
  /** ?book= and ?chapter= for the Bible reader. Null when absent. */
  book: string | null;
  chapter: string | null;
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
      return <Hero section={section} large={false} />;

    case "about_strip":
      return <AboutStrip section={section} />;
    case "mile_stats":
      return <MileStats section={section} />;
    case "get_connected":
      return <GetConnected section={section} />;

    case "expect":
      return <IconList section={section} />;
    case "faq":
      return <Faq section={section} />;

    case "timeline":
      return <Timeline section={section} />;
    case "beliefs":
      return <Beliefs section={section} />;
    case "ministries_intro":
      return <MinistriesSection section={section} context={context} />;
    case "about_ctas":
      return <CtaRow section={section} />;

    case "verse_of_day":
      return <VerseOfDay section={section} />;
    case "reading_plan":
    case "ylcc_bridge":
      return <CalloutCard section={section} />;

    // The filter strips themselves are interactive and belong to step 4. The
    // LIST each one heads is the page's actual content, so it renders now -
    // an events page with working filters and no events would be backwards.
    case "group_filters":
      return <GroupsSection section={section} context={context} />;
    case "event_filters":
      return <EventsSection section={section} context={context} />;
    case "worship_filters":
      return <WorshipSection section={section} context={context} />;

    case "latest_sermon":
      return <LatestSermon section={section} context={context} />;
    case "events_preview":
      return <EventsPreview section={section} context={context} />;
    case "bulletin":
      return <Bulletin section={section} context={context} />;
    case "visit_form":
      return <VisitFormSection section={section} />;
    case "reader":
      return <BibleReader section={section} context={context} />;

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
// Layout primitives. Every section is a full-width band with the same
// centred measure, so the page reads as one column at every breakpoint.
// ---------------------------------------------------------------

function Band({
  children,
  tint = false,
}: {
  children: React.ReactNode;
  tint?: boolean;
}) {
  return (
    <section className={tint ? "bg-paper-dim px-6 py-14" : "px-6 py-14"}>
      <div className="mx-auto max-w-[1120px]">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="font-utility text-xs uppercase tracking-[0.14em] text-brand">{children}</p>
  );
}

function Heading({ children }: { children: string }) {
  return <h2 className="mt-3 text-[clamp(26px,3.4vw,38px)] text-ink">{children}</h2>;
}

// ---------------------------------------------------------------
// Sections
// ---------------------------------------------------------------

/**
 * The home hero, as the prototype draws it.
 *
 * Three parts: a full-bleed banner, the welcome copy with its buttons, and the
 * "driver's log" - the church's service times as a timetable panel beside the
 * copy.
 *
 * THE LOGBOOK READS churches.service_times, not the section content. The seed
 * supplies only its heading and timezone (`logbook_title`, `logbook_tz`); the
 * rows are the same service times the pastor edits in Church Details, so the
 * hero cannot drift from the rest of the site. Nothing rendered these before -
 * they were seeded and ignored.
 *
 * The visible heading is the banner image, so the H1 is screen-reader only.
 * That is the prototype's own structure: a page still needs exactly one H1 and
 * it should say what the banner says.
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

  const heading = [headline, context.church.tagline, context.church.address]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="hero">
      <div className="wrap">
        <h1 className="sr-only">{heading || headline || context.church.slug}</h1>

        {image_desktop ? (
          <div className="hero-banner">
            {/* Unoptimized: the banner is a full-bleed art-directed image and
                next/image would need its intrinsic size, which the section
                content does not carry. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image_desktop} alt={headline ?? ""} />
          </div>
        ) : null}

        <div className="hero-under">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {lede ? <p className="lede">{lede}</p> : null}
            {ctas.length > 0 ? (
              <div className="hero-ctas">
                {ctas.map((cta, index) =>
                  cta.label && cta.href ? (
                    <Link
                      key={index}
                      href={cta.href}
                      className={cta.style === "ghost" ? "btn btn-ghost" : "btn btn-gold"}
                    >
                      {cta.label}
                    </Link>
                  ) : null,
                )}
              </div>
            ) : null}
          </div>

          {services.length > 0 ? (
            <div className="logbook" role="table" aria-label="Service times">
              <div className="logbook-head">
                <span>{logbook_title ?? "Service times"}</span>
                <span>{logbook_tz ?? services[0]?.tz ?? ""}</span>
              </div>
              {services.map((slot, index) => (
                <div key={index} className="logbook-row">
                  <span className="k">{[slot.day, slot.time].filter(Boolean).join(" ")}</span>
                  <span className="v">
                    {slot.streaming ? (
                      <span className="live-dot" aria-hidden="true" />
                    ) : null}
                    {slot.label ?? ""}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Hero({ section, large }: { section: SectionRow; large: boolean }) {
  const { eyebrow, headline, lede } = sectionContent(section.content);
  const ctas = rows(section.content, "ctas");

  // A hero with no headline is a seeding mistake, not a layout to render
  // around. Drop it rather than emit an empty band.
  if (!headline) return null;

  return (
    <section className={large ? "px-6 pt-16 pb-20 sm:pt-24" : "px-6 pt-12 pb-10 sm:pt-16"}>
      <div className="mx-auto max-w-[1120px]">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}

        <h1
          className={
            large
              ? "mt-4 text-[clamp(38px,5.2vw,58px)] text-ink"
              : "mt-3 text-[clamp(30px,4vw,44px)] text-ink"
          }
        >
          {headline}
        </h1>

        {lede ? <p className="mt-4 max-w-[58ch] text-lg text-ink-soft">{lede}</p> : null}

        {ctas.length > 0 ? <CtaButtons ctas={ctas} /> : null}
      </div>
    </section>
  );
}

function AboutStrip({ section }: { section: SectionRow }) {
  const { eyebrow, heading, lead_in, verse, verse_cite } = sectionContent(section.content);
  const paragraphs = strings(section.content, "body");
  const cta = obj(section.content, "cta");

  return (
    <div className="about-strip">
      <div className="wrap">
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
      </div>
    </div>
  );
}

/**
 * The mile-marker stat tiles.
 *
 * `marker` becomes the data-mm attribute the CSS prints in the corner - the
 * prototype styles it through ::before with attr(), so the value has to be an
 * attribute rather than a child element.
 *
 * The prototype puts these beside the About copy in a two-column grid. They are
 * separate rows in church_sections with their own sort order and visibility, so
 * they render as their own band here and stack instead. Pairing them would mean
 * one renderer consuming the next section, which is more coupling than the
 * layout is worth.
 */
function MileStats({ section }: { section: SectionRow }) {
  const items = rows(section.content, "items");
  if (items.length === 0) return null;

  return (
    <div className="wrap" style={{ paddingBottom: "76px" }}>
      <div className="mile-stats">
        {items.map((item, index) => (
          <div key={index} className="mile" data-mm={item.marker ?? ""}>
            <b>{item.value}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
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

/** "What to expect" - a titled list where each entry carries a small marker. */
function IconList({ section }: { section: SectionRow }) {
  const { heading } = sectionContent(section.content);
  const items = rows(section.content, "items");

  return (
    <Band>
      {heading ? <Heading>{heading}</Heading> : null}

      <ul className="mt-8 grid gap-6 md:grid-cols-2">
        {items.map((item, index) => (
          <li key={index} className="flex gap-4">
            {item.icon ? (
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-wash font-utility text-sm text-brand"
              >
                {item.icon}
              </span>
            ) : null}
            <div>
              <h3 className="text-lg text-ink">{item.title}</h3>
              {item.body ? <p className="mt-1 text-sm text-ink-soft">{item.body}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </Band>
  );
}

function Faq({ section }: { section: SectionRow }) {
  const { heading } = sectionContent(section.content);
  const items = rows(section.content, "items");

  return (
    <Band tint>
      {heading ? <Heading>{heading}</Heading> : null}

      {/* <details> rather than a scripted accordion: it is keyboard and screen
          reader accessible for free, and works with JavaScript disabled. */}
      <div className="mt-8 divide-y divide-line border-y border-line">
        {items.map((item, index) => (
          <details key={index} className="group py-4">
            <summary className="cursor-pointer list-none text-lg text-ink marker:hidden">
              <span className="inline-block w-5 font-utility text-brand transition-transform group-open:rotate-90">
                &gt;
              </span>
              {item.q}
            </summary>
            {item.a ? <p className="mt-3 pl-5 text-ink-soft">{item.a}</p> : null}
          </details>
        ))}
      </div>
    </Band>
  );
}

function Timeline({ section }: { section: SectionRow }) {
  const stops = rows(section.content, "stops");
  if (stops.length === 0) return null;

  return (
    <Band>
      <ol className="relative border-l border-line pl-8">
        {stops.map((stop, index) => (
          <li key={index} className="pb-10 last:pb-0">
            <span
              aria-hidden="true"
              className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-paper bg-brand"
            />
            {stop.year ? (
              <p className="font-utility text-xs uppercase tracking-[0.16em] text-brand">
                {stop.year}
                {stop.marker ? <span className="ml-2 text-ink-soft">{stop.marker}</span> : null}
              </p>
            ) : null}
            <h3 className="mt-1 text-xl text-ink">{stop.title}</h3>
            {stop.body ? <p className="mt-2 max-w-[62ch] text-ink-soft">{stop.body}</p> : null}
          </li>
        ))}
      </ol>
    </Band>
  );
}

function Beliefs({ section }: { section: SectionRow }) {
  const { heading, lede } = sectionContent(section.content);
  const items = rows(section.content, "items");

  return (
    <Band tint>
      {heading ? <Heading>{heading}</Heading> : null}
      {lede ? <p className="mt-4 max-w-[62ch] text-lg text-ink-soft">{lede}</p> : null}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-[var(--kc-radius)] border border-line bg-surface p-5"
          >
            <h3 className="text-lg text-ink">{item.title}</h3>
            {item.body ? <p className="mt-2 text-sm text-ink-soft">{item.body}</p> : null}
          </div>
        ))}
      </div>
    </Band>
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
    <Band>
      {heading ? <Heading>{heading}</Heading> : null}
      {lede ? <p className="mt-4 max-w-[62ch] text-lg text-ink-soft">{lede}</p> : null}
      <div className="mt-8">
        <MinistryList
          ministries={context.collections.ministries}
          empty={empty ?? "Ministry list coming soon."}
        />
      </div>
    </Band>
  );
}

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
    <Band>
      <FilterStrip filters={filters} active={context.filter} />
      <GroupList
        groups={groups}
        empty={empty ?? "No groups listed yet."}
        linkLabel={link_label ?? "Join online"}
      />
    </Band>
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
    <Band>
      <FilterStrip filters={filters} active={context.filter} />
      <EventList
        events={events}
        empty={empty ?? "Nothing on the calendar yet."}
      />
    </Band>
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

  return (
    <Band>
      <FilterStrip filters={filters} active={context.filter} />
      <VideoGrid
        videos={videos}
        empty={empty ?? "No worship videos yet."}
        playLabel={play_label ?? "Play"}
      />
    </Band>
  );
}

/**
 * The filter strip above a list.
 *
 * Plain links carrying `?filter=`, not client state. The result is linkable and
 * shareable, survives a reload, needs no JavaScript, and keeps the list a
 * Server Component. `value: "all"` clears the filter rather than setting one.
 *
 * Which column each strip filters is the list section's business, not this
 * component's: groups by location_type, events by event_type, videos by
 * category. The seed supplies only labels and values.
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
    <div className="mb-8 flex flex-wrap gap-2">
      {usable.map((filter) => {
        const isAll = filter.value === "all";
        const isActive = isAll ? active === null : active === filter.value;

        return (
          <Link
            key={filter.value}
            href={isAll ? "?" : `?filter=${encodeURIComponent(filter.value)}`}
            aria-current={isActive ? "true" : undefined}
            className={
              isActive
                ? "rounded-full bg-brand px-4 py-1.5 font-utility text-xs uppercase tracking-[0.14em] text-brand-contrast"
                : "rounded-full border border-line px-4 py-1.5 font-utility text-xs uppercase tracking-[0.14em] text-ink-soft hover:border-brand hover:text-brand"
            }
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Home: this week's message, in the prototype's dark band.
 *
 * The prototype draws a play-button thumbnail; that is a facade for the YouTube
 * player and belongs with the sermon work rather than here, so the card links
 * out to the video instead. Everything else - the band, the meta line, the
 * archive link - is the prototype's.
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
          <a
            className="player"
            href={`https://www.youtube.com/watch?v=${latest.youtube_id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Watch ${latest.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="thumb"
              src={`https://i.ytimg.com/vi/${latest.youtube_id}/hqdefault.jpg`}
              alt=""
            />
            {badge ? <span className="badge">{badge}</span> : null}
            <span className="play-ring">
              <span className="disc" />
            </span>
          </a>
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
    <div style={{ padding: "84px 0" }}>
      <div className="wrap">
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

        {events.length === 0 ? (
          <p style={{ color: "var(--kc-ink-soft)" }}>
            {empty ?? "Nothing on the calendar yet."}
          </p>
        ) : (
          <div className="event-list">
            {events.map((event) => {
              const when = new Date(event.starts_at);
              const valid = !Number.isNaN(when.getTime());

              return (
                <article key={event.id} className="event">
                  <div className="mm-plate" aria-hidden="true">
                    <div className="mo">
                      {valid
                        ? when.toLocaleDateString("en-US", {
                            timeZone: "UTC",
                            month: "short",
                          })
                        : ""}
                    </div>
                    <div className="day">{valid ? when.getUTCDate() : ""}</div>
                  </div>
                  <div>
                    <h3>{event.title}</h3>
                    {event.location ? (
                      <p className="where">{event.location}</p>
                    ) : null}
                    {event.description ? <p>{event.description}</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The Bible reader.
 *
 * An async Server Component that fetches its own passage rather than having the
 * page do it: the book list and defaults are section content, so only this
 * component knows what to ask for. No key reaches the browser - the provider
 * module is server-only.
 *
 * Navigation runs through the URL (?book=&chapter=), same as the list filters:
 * linkable, shareable, survives a reload, works with JavaScript off. The form
 * below submits with GET for exactly that reason.
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
  const books = strings(section.content, "books");

  const fallbackBook = content.default_book ?? books[0] ?? "John";
  const fallbackChapter = Number.parseInt(content.default_chapter ?? "1", 10) || 1;

  const book = normalizeBook(context.book, books, fallbackBook);
  const chapter = normalizeChapter(context.chapter, fallbackChapter);

  const provider = getBibleProvider();
  const reading = await provider.fetchPassage(book, chapter);

  return (
    <Band>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="book" className="mb-1 block text-sm font-medium">
            Book
          </label>
          <select
            id="book"
            name="book"
            defaultValue={book}
            className="rounded-[var(--kc-radius)] border border-line bg-surface px-3 py-2"
          >
            {books.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="chapter" className="mb-1 block text-sm font-medium">
            Chapter
          </label>
          <input
            id="chapter"
            name="chapter"
            type="number"
            min={1}
            max={150}
            defaultValue={chapter}
            className="w-24 rounded-[var(--kc-radius)] border border-line bg-surface px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="rounded-[var(--kc-radius)] bg-brand px-5 py-2.5 font-semibold text-brand-contrast"
        >
          {content.load_label ?? "Read"}
        </button>
      </form>

      {reading ? (
        <article className="mt-8">
          <h3 className="text-2xl text-ink">
            {reading.reference}
            <span className="ml-3 font-utility text-xs uppercase tracking-[0.16em] text-brand">
              {reading.translation}
            </span>
          </h3>

          {content.default_subtitle ? (
            <p className="mt-1 text-sm text-ink-soft">{content.default_subtitle}</p>
          ) : null}

          <p className="mt-5 max-w-[68ch] text-lg leading-relaxed text-ink">
            {reading.text}
          </p>

          {/* Licence condition for several providers, not decoration. Printed
              verbatim as the adapter returned it - see lib/bible.ts. */}
          <p className="mt-6 font-utility text-xs text-ink-soft">{reading.attribution}</p>
        </article>
      ) : (
        <p className="mt-8 rounded-[var(--kc-radius)] border border-dashed border-line px-5 py-8 text-center text-ink-soft">
          {content.error ?? "That passage could not be loaded right now."}
        </p>
      )}
    </Band>
  );
}

/**
 * Plan a Visit.
 *
 * Every label, placeholder and option is seeded content, so a pastor can reword
 * the whole form from the portal. The option lists are read with strings()
 * because sectionContent() keeps only scalars and would drop them.
 */
function VisitFormSection({ section }: { section: SectionRow }) {
  const content = sectionContent(section.content);

  return (
    <Band tint>
      {content.title ? <Heading>{content.title}</Heading> : null}
      {content.sub ? (
        <p className="mt-3 max-w-[62ch] text-ink-soft">{content.sub}</p>
      ) : null}

      <div className="mt-8 max-w-xl">
        <VisitForm
          content={content}
          whenOptions={strings(section.content, "when_options")}
          rigOptions={strings(section.content, "rig_options")}
        />
      </div>
    </Band>
  );
}

/**
 * Home: the bulletin board - announcements and the prayer wall.
 *
 * Two cards side by side, as the prototype draws it. The prayer form is a
 * <details> inside the second card rather than the prototype's prompt()
 * dialogs - see FF-34 for why the CTA was held back until the insert policy
 * could refuse a pre-approved submission.
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
    <div style={{ padding: "0 0 84px" }}>
      <div className="wrap">
        <div style={{ marginBottom: "40px" }}>
          {content.eyebrow ? <span className="eyebrow">{content.eyebrow}</span> : null}
          {content.heading ? <h2>{content.heading}</h2> : null}
        </div>

        <div className="cardgrid two">
          <div className="card" style={{ padding: "26px 28px" }}>
            <span className="card-kicker">
              {content.announcements_title ?? "Announcements"}
            </span>

            {announcements.length > 0 ? (
              <div style={{ marginTop: "14px" }}>
                {announcements.map((item) => (
                  <div key={item.id} className="logbook-row" style={{ padding: "12px 0" }}>
                    <span>{item.body}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ marginTop: "14px", color: "var(--kc-ink-soft)" }}>
                {content.announcements_empty ?? "Nothing posted this week."}
              </p>
            )}
          </div>

          <div className="card" style={{ padding: "26px 28px" }}>
            <span className="card-kicker">{content.prayer_title ?? "Prayer list"}</span>

            {prayer.length > 0 ? (
              <div style={{ marginTop: "14px" }}>
                {prayer.map((item) => (
                  <div key={item.id} className="logbook-row" style={{ padding: "12px 0" }}>
                    <span>
                      {item.display_name ? <strong>{item.display_name}</strong> : null}
                      {item.display_name ? " - " : null}
                      {item.body}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ marginTop: "14px", color: "var(--kc-ink-soft)" }}>
                {content.prayer_empty ?? "No requests right now."}
              </p>
            )}

            <div className="card-foot" style={{ paddingTop: "16px" }}>
              <span>{content.prayer_note ?? ""}</span>
            </div>

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

function CtaRow({ section }: { section: SectionRow }) {
  const ctas = rows(section.content, "ctas");
  if (ctas.length === 0) return null;

  return (
    <Band>
      <CtaButtons ctas={ctas} />
    </Band>
  );
}

function VerseOfDay({ section }: { section: SectionRow }) {
  const { title, verse, reference } = sectionContent(section.content);
  if (!verse) return null;

  return (
    <Band tint>
      {title ? <Eyebrow>{title}</Eyebrow> : null}
      <blockquote className="mt-3 max-w-[62ch]">
        <p className="text-[clamp(20px,2.4vw,26px)] text-ink italic">{verse}</p>
        {reference ? (
          <cite className="mt-3 block font-utility text-xs uppercase not-italic tracking-[0.14em] text-brand">
            {reference}
          </cite>
        ) : null}
      </blockquote>
    </Band>
  );
}

/** reading_plan and ylcc_bridge share a shape: title, body, optional CTA. */
function CalloutCard({ section }: { section: SectionRow }) {
  const { title, body, cta_label, cta_href } = sectionContent(section.content);
  if (!title && !body) return null;

  return (
    <Band>
      <div className="rounded-[var(--kc-radius)] border border-line bg-surface p-6">
        {title ? <h3 className="text-xl text-ink">{title}</h3> : null}
        {body ? <p className="mt-2 max-w-[62ch] text-ink-soft">{body}</p> : null}
        {cta_label ? (
          <CtaButtons ctas={[{ label: cta_label, href: cta_href ?? "", style: "ghost" }]} />
        ) : null}
      </div>
    </Band>
  );
}

/**
 * The giving band - prose and one button out to Tithe.ly.
 *
 * DECIDED 2026-08-28 (Jason): Tithe.ly only, through the `kind = 'giving'` row
 * in church_links. No Stripe, no amount picker, no custom-amount field.
 *
 * The prototype's give-card holds a frequency toggle and an amount ladder, and
 * the seed carries the values for both. They are DELIBERATELY NOT RENDERED and
 * are not a bug to fix: amount and frequency are chosen on the Tithe.ly form
 * itself, so collecting them here would be decorative. The card keeps its
 * shape and holds the button. See FF-32.
 *
 * A church with no giving link gets no button rather than a dead one.
 */
function GivingBand({ section, giving }: { section: SectionRow; giving: ChurchLink | null }) {
  const { eyebrow, heading, body, note, card_title } = sectionContent(section.content);
  const bullets = strings(section.content, "bullets");
  const link = obj(section.content, "link");

  return (
    <div className="wrap">
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
    <Band>
      <div className="grid gap-5 md:grid-cols-3">
        {items.map((item, index) => (
          <div key={index}>
            <h3 className="text-lg text-ink">{item.title}</h3>
            {item.body ? <p className="mt-2 text-sm text-ink-soft">{item.body}</p> : null}
          </div>
        ))}
      </div>
    </Band>
  );
}

// ---------------------------------------------------------------
// Shared
// ---------------------------------------------------------------

/**
 * Button row. `style: "solid" | "ghost"` comes from the seed.
 *
 * next/link for internal hrefs, a plain anchor for anything absolute - Link
 * prefetching an external URL is wasted work.
 */
function CtaButtons({ ctas }: { ctas: Record<string, string>[] }) {
  const usable = ctas.filter((cta) => cta.label && cta.href);
  if (usable.length === 0) return null;

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {usable.map((cta, index) => {
        const className =
          cta.style === "ghost"
            ? "inline-flex items-center rounded-[var(--kc-radius)] border border-line px-5 py-2.5 text-ink"
            : "inline-flex items-center rounded-[var(--kc-radius)] bg-brand px-5 py-2.5 font-semibold text-brand-contrast";

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
      })}
    </div>
  );
}

/**
 * Development-only marker for a section that has a database row but no
 * renderer yet.
 *
 * Renders nothing in production, so shipping a page with unbuilt sections
 * degrades to "that part is missing" rather than "that part is a debug box".
 */
function UnbuiltSection({ sectionKey }: { sectionKey: string }) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <section className="px-6 py-3">
      <div className="mx-auto max-w-[1120px] rounded-[var(--kc-radius)] border border-dashed border-line bg-brand-wash/40 px-4 py-3">
        <p className="font-utility text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          section not built yet
          <span className="ml-2 normal-case tracking-normal text-brand">{sectionKey}</span>
        </p>
      </div>
    </section>
  );
}
