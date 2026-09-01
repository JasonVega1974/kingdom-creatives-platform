import {
  LAYOUT_GROUPS,
  SectionRenderer,
  type SectionContext,
} from "@/components/site/section-renderer";
import { Fragment, type ReactNode } from "react";

import type { SectionRow } from "@/lib/sections";

/**
 * ============================================================
 * PAGE SECTIONS - render a page's sections, honouring its layout
 * ============================================================
 *
 * Most sections are full-width bands rendered in sort order. A few are placed
 * side by side by the prototype - About beside its stat tiles, "what to expect"
 * beside the visit form, the Bible reader beside its sidebar - and those are
 * declared in LAYOUT_GROUPS.
 *
 * This is the only place that knows about grouping. No renderer consumes
 * another, and the declaration is data: hide a grouped section in the portal
 * and its column simply renders empty, which the CSS grid handles.
 */
export function PageSections({
  pageSlug,
  sections,
  context,
  afterSection,
}: {
  pageSlug: string;
  sections: SectionRow[];
  context: SectionContext;
  /**
   * Extra content to render immediately after a named section, keyed by
   * section_key. A seam, not a special case: this component still knows only
   * about ordering and grouping, and the PAGE decides what goes where. Anything
   * keyed to a section the church has hidden simply never renders, which is the
   * correct behaviour - a teaser for a band that is switched off would be
   * stranded.
   */
  afterSection?: Record<string, ReactNode>;
}) {
  // THE BANNER IS ALWAYS FIRST, whatever sort_order says.
  //
  // `hero` and `page_hero` are the page's banner. There is no arrangement in
  // which one belongs below the content, and on 2026-08-31 the live home page
  // rendered its hero third because something had moved it - most likely a
  // stray click on the move arrows in Edit My Website, where the hero is the
  // first card and "move down" is right beside it.
  //
  // Sorting here rather than repairing the row means a misclick cannot break
  // the most important element on the page, and it stays fixed for every
  // church rather than just this one. The pastor can still HIDE the banner -
  // that is the visible toggle, and it is a real choice. Where it sits is not.
  const ordered = [
    ...sections.filter((s) => s.section_key === "hero" || s.section_key === "page_hero"),
    ...sections.filter((s) => s.section_key !== "hero" && s.section_key !== "page_hero"),
  ];

  const groups = LAYOUT_GROUPS[pageSlug] ?? [];

  // Every key claimed by a group, so the ungrouped pass can skip them.
  const claimed = new Set(groups.flatMap((g) => g.columns.flat()));

  // Where each group appears in the page: at the position of the first of its
  // sections that actually exists, so a group cannot jump above a section the
  // pastor put before it.
  const anchorFor = (index: number) =>
    groups.findIndex((g) => {
      const keys = new Set(g.columns.flat());
      const first = ordered.findIndex((s) => keys.has(s.section_key));
      return first === index;
    });

  return (
    <>
      {ordered.map((section, index) => {
        const groupIndex = anchorFor(index);

        if (groupIndex !== -1) {
          const group = groups[groupIndex];
          return (
            <div key={`group-${groupIndex}`} className={group.className}>
              {group.columns.map((column, columnIndex) => (
                <div key={columnIndex}>
                  {column.map((key) => {
                    const row = ordered.find((s) => s.section_key === key);
                    if (!row) return null;
                    return (
                      <SectionRenderer
                        key={row.id}
                        section={row}
                        context={{ ...context, grouped: true }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          );
        }

        // Claimed by a group but not its anchor - already rendered above.
        if (claimed.has(section.section_key)) return null;

        return (
          <Fragment key={section.id}>
            <SectionRenderer section={section} context={context} />
            {afterSection?.[section.section_key] ?? null}
          </Fragment>
        );
      })}
    </>
  );
}
