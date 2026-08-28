import Link from "next/link";

import {
  EventList,
  GroupList,
  MinistryList,
  SermonList,
  VideoGrid,
} from "@/components/site/collections";
import type { Collections } from "@/lib/collections";
import { PrayerForm, VisitForm } from "@/components/site/public-forms";
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
      return <Hero section={section} large />;
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
  // `body` is a list of paragraphs here, not a single string.
  const paragraphs = strings(section.content, "body");
  const cta = obj(section.content, "cta");

  return (
    <Band>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {heading ? <Heading>{heading}</Heading> : null}

      {lead_in ? <p className="mt-4 max-w-[62ch] text-lg text-ink">{lead_in}</p> : null}

      {paragraphs.map((paragraph, index) => (
        <p key={index} className="mt-4 max-w-[62ch] text-ink-soft">
          {paragraph}
        </p>
      ))}

      {verse ? (
        <blockquote className="mt-8 max-w-[62ch] border-l-2 border-brand pl-5">
          <p className="text-lg text-ink italic">{verse}</p>
          {verse_cite ? (
            <cite className="mt-2 block font-utility text-xs uppercase not-italic tracking-[0.14em] text-ink-soft">
              {verse_cite}
            </cite>
          ) : null}
        </blockquote>
      ) : null}

      {cta.href && cta.label ? <CtaButtons ctas={[cta]} /> : null}
    </Band>
  );
}

function MileStats({ section }: { section: SectionRow }) {
  const items = rows(section.content, "items");
  if (items.length === 0) return null;

  return (
    <Band tint>
      <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {items.map((item, index) => (
          <div key={index}>
            {item.marker ? (
              <p className="font-utility text-[11px] uppercase tracking-[0.16em] text-brand">
                {item.marker}
              </p>
            ) : null}
            <dd className="mt-1 text-[clamp(28px,3.6vw,40px)] leading-none text-ink">
              {item.value}
            </dd>
            <dt className="mt-2 text-sm text-ink-soft">{item.label}</dt>
          </div>
        ))}
      </dl>
    </Band>
  );
}

function GetConnected({ section }: { section: SectionRow }) {
  const { eyebrow, heading } = sectionContent(section.content);
  const cards = rows(section.content, "cards");

  return (
    <Band>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {heading ? <Heading>{heading}</Heading> : null}

      {cards.length > 0 ? (
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {cards.map((card, index) => {
            const inner = (
              <>
                {card.kicker ? (
                  <p className="font-utility text-[11px] uppercase tracking-[0.16em] text-brand">
                    {card.kicker}
                  </p>
                ) : null}
                <h3 className="mt-2 text-xl text-ink">{card.title}</h3>
                {card.body ? <p className="mt-2 text-sm text-ink-soft">{card.body}</p> : null}
              </>
            );

            const className =
              "block rounded-[var(--kc-radius)] border border-line bg-surface p-5 transition-colors hover:border-brand";

            return card.href ? (
              <Link key={index} href={card.href} className={className}>
                {inner}
              </Link>
            ) : (
              <div key={index} className={className}>
                {inner}
              </div>
            );
          })}
        </div>
      ) : null}
    </Band>
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

/** Home: the most recent published sermon, or the seeded empty line. */
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
  // getSermons() already orders newest first.
  const latest = context.collections.sermons[0];

  return (
    <Band>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {badge ? (
        <p className="mt-2 font-utility text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          {badge}
        </p>
      ) : null}

      <div className="mt-6">
        <SermonList
          sermons={latest ? [latest] : []}
          empty={empty ?? "No sermon posted yet."}
          watchLabel="Watch this message"
        />
      </div>

      {archive_label && archive_href ? (
        <CtaButtons ctas={[{ label: archive_label, href: archive_href, style: "ghost" }]} />
      ) : null}
    </Band>
  );
}

/** Home: the next few events. `limit` comes from the seed, not a constant. */
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
    <Band tint>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {heading ? <Heading>{heading}</Heading> : null}

      <div className="mt-8">
        <EventList events={events} empty={empty ?? "Nothing on the calendar yet."} />
      </div>

      {cta.href && cta.label ? <CtaButtons ctas={[cta]} /> : null}
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
 * The "Add a request" form is live as of draft 21 (FF-34). Before that, the
 * insert policy was `with check (true)` and anyone with the anon key could POST
 * straight to this wall with status = 'approved', publishing unmoderated - so
 * the CTA was deliberately held back until the policy could refuse it.
 *
 * Submissions arrive as 'pending' and stay invisible here until a pastor
 * approves them, which is what prayer_pending_note promises the visitor.
 */
function Bulletin({
  section,
  context,
}: {
  section: SectionRow;
  context: SectionContext;
}) {
  const {
    eyebrow,
    heading,
    announcements_title,
    announcements_empty,
    prayer_title,
    prayer_note,
    prayer_empty,
    prayer_pending_note,
  } = sectionContent(section.content);

  const { announcements, prayer } = context.collections;

  return (
    <Band>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {heading ? <Heading>{heading}</Heading> : null}

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="font-utility text-xs uppercase tracking-[0.16em] text-brand">
            {announcements_title ?? "Announcements"}
          </h3>
          {announcements.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {announcements.map((item) => (
                <li key={item.id} className="text-ink-soft">
                  {item.body}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-ink-soft">
              {announcements_empty ?? "Nothing posted this week."}
            </p>
          )}
        </div>

        <div>
          <h3 className="font-utility text-xs uppercase tracking-[0.16em] text-brand">
            {prayer_title ?? "Prayer list"}
          </h3>
          {prayer_note ? (
            <p className="mt-1 text-sm text-ink-soft">{prayer_note}</p>
          ) : null}

          {prayer.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {prayer.map((item) => (
                <li key={item.id}>
                  <p className="text-ink-soft">{item.body}</p>
                  {item.display_name ? (
                    <p className="mt-1 font-utility text-xs text-ink-soft">
                      {item.display_name}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-ink-soft">
              {prayer_empty ?? "No requests right now."}
            </p>
          )}

          {prayer_pending_note ? (
            <p className="mt-4 text-sm text-ink-soft">{prayer_pending_note}</p>
          ) : null}

          <PrayerForm content={sectionContent(section.content)} />
        </div>
      </div>
    </Band>
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
 * The seed carries a full donation widget - `frequencies`, `amounts`,
 * `default_amount`, `custom_placeholder`, `submit_label`. Those fields are
 * DELIBERATELY NOT RENDERED and are not a bug to fix. Amount and frequency are
 * chosen on the Tithe.ly form itself, so collecting them here would either be
 * decorative or would need Tithe.ly to accept them as parameters - a real
 * integration nobody has asked for. See FF-32.
 *
 * A church with no giving link gets no button rather than a dead one.
 */
function GivingBand({ section, giving }: { section: SectionRow; giving: ChurchLink | null }) {
  const { eyebrow, heading, body, note } = sectionContent(section.content);
  const bullets = strings(section.content, "bullets");
  const link = obj(section.content, "link");

  return (
    <Band tint>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {heading ? <Heading>{heading}</Heading> : null}
      {body ? <p className="mt-4 max-w-[62ch] text-lg text-ink-soft">{body}</p> : null}

      {bullets.length > 0 ? (
        <ul className="mt-6 grid gap-2 md:grid-cols-2">
          {bullets.map((bullet, index) => (
            <li key={index} className="flex gap-3 text-ink-soft">
              <span aria-hidden="true" className="text-brand">
                -
              </span>
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {giving ? (
          <a
            href={giving.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-[var(--kc-radius)] bg-brand px-5 py-2.5 font-semibold text-brand-contrast"
          >
            {giving.label}
          </a>
        ) : null}

        {link.href && link.label ? (
          <Link
            href={link.href}
            className="inline-flex items-center rounded-[var(--kc-radius)] border border-line px-5 py-2.5 text-ink"
          >
            {link.label}
          </Link>
        ) : null}
      </div>

      {note ? <p className="mt-4 max-w-[62ch] text-sm text-ink-soft">{note}</p> : null}
    </Band>
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
