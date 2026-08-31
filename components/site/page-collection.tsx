import { SermonList, StaffGrid } from "@/components/site/collections";
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
}: {
  pageSlug: string;
  sections: SectionRow[];
  collections: Collections;
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
    return (
      <Band>
        <SermonList
          sermons={collections.sermons}
          empty={empty ?? "No sermons posted yet."}
          watchLabel={watch_label ?? "Watch"}
        />
      </Band>
    );
  }

  // Every other page renders its list from a section of its own.
  return null;
}

/** The prototype's centred container, so these lists line up with the rest. */
function Band({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ paddingBottom: "76px" }}>
      {children}
    </div>
  );
}
