import Link from "next/link";

import { SermonList, StaffGrid } from "@/components/site/collections";
import { DevotionalArchive, DevotionalReading } from "@/components/site/devotionals";
import { dailyDevotionalIndex } from "@/lib/devotional-day";
import { DEVOTIONALS } from "@/lib/devotionals";
import type { SermonChannel } from "@/lib/sermon-feed";
import type { Collections } from "@/lib/collections";
import { sectionContent, type SectionRow } from "@/lib/sections";

/**
 * ============================================================
 * PAGE-LEVEL COLLECTIONS - team and sermons
 * ============================================================
 *
 * Most list pages hang their list off a section of their own:
 * `ministries_intro`, `group_filters`, `event_filters`, `worship_filters`.
 * Team and Sermons do not. Their seed rows are a `page_hero` and nothing else,
 * with the list's labels tucked into the hero's content - `empty` on both,
 * plus `watch_label` and `all_series_label` on sermons.
 *
 * So the list cannot render from the section switch: `page_hero` is shared by
 * ten pages and must not grow a per-page branch. It renders here instead,
 * after the sections, reading its labels from the hero row that carries them.
 *
 * Which pages need which collection is declared in COLLECTIONS_BY_PAGE below,
 * so a page never queries a table it does not display.
 */

/** Collections each page actually renders. Anything absent is never queried. */
export const COLLECTIONS_BY_PAGE: Record<string, Array<keyof Collections>> = {
  team: ["staff"],
  about: ["ministries"],
  groups: ["groups"],
  events: ["events"],
  sermons: ["sermons"],
  worship: ["videos"],
};

/** Labels for these lists live on the page's hero row. */
function heroContent(sections: SectionRow[]): Record<string, string> {
  const hero = sections.find((section) => section.section_key === "page_hero");
  return hero ? sectionContent(hero.content) : {};
}

export function PageCollection({
  pageSlug,
  sections,
  collections,
  channels = [],
  activeChannel = null,
  devotionalDay = null,
  devotionalPage = null,
}: {
  pageSlug: string;
  sections: SectionRow[];
  collections: Collections;
  /** YouTube channels this church has, from church_links. Empty for most. */
  channels?: SermonChannel[];
  /** ?channel= from the URL, or null for "everything". */
  activeChannel?: string | null;
  /** ?day= on /devotionals - 1-based. Null means today's. */
  devotionalDay?: string | null;
  /** ?page= on /devotionals - 1-based archive page. */
  devotionalPage?: string | null;
}) {
  if (pageSlug === "team") {
    const { empty } = heroContent(sections);
    return (
      <Band>
        <StaffGrid
          staff={collections.staff}
          empty={empty ?? "Team profiles coming soon."}
        />
      </Band>
    );
  }

  if (pageSlug === "sermons") {
    const { empty, watch_label } = heroContent(sections);

    /*
     * collections.sermons is already the merged feed by the time it arrives
     * here - YouTube's list enriched by curated rows. Filtering is by channel
     * id, which is what makes "Preaching" and "Bible Studies" separable
     * without either being hardcoded anywhere.
     */
    const shown = activeChannel
      ? collections.sermons.filter(
          (sermon) => (sermon as { channelId?: string | null }).channelId === activeChannel,
        )
      : collections.sermons;

    return (
      <Band>
        <ChannelStrip channels={channels} active={activeChannel} />
        <SermonList
          sermons={shown}
          empty={empty ?? "No sermons posted yet."}
          watchLabel={watch_label ?? "Watch"}
        />
      </Band>
    );
  }

  if (pageSlug === "devotionals") {
    const { featured_label, read_label } = heroContent(sections);

    /*
     * Which devotional to show. ?day= is 1-based and attacker-controlled, so it
     * is parsed and range-checked; anything outside 1..365 falls back to
     * today's rather than erroring. Same rule as the Bible reader's chapter.
     */
    const requested = Number.parseInt(devotionalDay ?? "", 10);
    const index =
      Number.isFinite(requested) && requested >= 1 && requested <= DEVOTIONALS.length
        ? requested - 1
        : dailyDevotionalIndex();

    const page = Number.parseInt(devotionalPage ?? "", 10);

    return (
      <Band>
        <DevotionalReading
          devotional={DEVOTIONALS[index]}
          label={devotionalDay ? undefined : (featured_label ?? "Today's devotional")}
          dayNumber={index + 1}
        />
        <DevotionalArchive
          entries={DEVOTIONALS}
          page={Number.isFinite(page) ? page : 1}
          activeIndex={index}
          readLabel={read_label ?? "Read"}
        />
      </Band>
    );
  }

  // Every other page renders its list from a section of its own.
  return null;
}

/**
 * Channel tabs, built from church_links.
 *
 * Hidden below two channels: a church with one YouTube channel has nothing to
 * choose between, and a lone "Preaching" tab next to "Everything" is furniture
 * pretending to be a control.
 *
 * Links, not client state - same bargain as every other filter on this site.
 * Each choice is a shareable URL that survives a reload and needs no
 * JavaScript.
 */
function ChannelStrip({
  channels,
  active,
}: {
  channels: SermonChannel[];
  active: string | null;
}) {
  if (channels.length < 2) return null;

  return (
    <div className="filters" style={{ marginBottom: "26px" }}>
      <Link className={active === null ? "chip is-active" : "chip"} href="/sermons">
        Everything
      </Link>
      {channels.map((channel) => (
        <Link
          key={channel.id}
          className={active === channel.id ? "chip is-active" : "chip"}
          href={`/sermons?channel=${encodeURIComponent(channel.id)}`}
        >
          {channel.label}
        </Link>
      ))}
    </div>
  );
}

/** The prototype's centred container, so these lists line up with the rest. */
function Band({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ paddingBottom: "76px" }}>
      {children}
    </div>
  );
}
