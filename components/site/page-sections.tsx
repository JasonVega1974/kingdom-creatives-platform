import {
  LAYOUT_GROUPS,
  SectionRenderer,
  type SectionContext,
} from "@/components/site/section-renderer";
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
}: {
  pageSlug: string;
  sections: SectionRow[];
  context: SectionContext;
}) {
  const groups = LAYOUT_GROUPS[pageSlug] ?? [];

  // Every key claimed by a group, so the ungrouped pass can skip them.
  const claimed = new Set(groups.flatMap((g) => g.columns.flat()));

  // Where each group appears in the page: at the position of the first of its
  // sections that actually exists, so a group cannot jump above a section the
  // pastor put before it.
  const anchorFor = (index: number) =>
    groups.findIndex((g) => {
      const keys = new Set(g.columns.flat());
      const first = sections.findIndex((s) => keys.has(s.section_key));
      return first === index;
    });

  return (
    <>
      {sections.map((section, index) => {
        const groupIndex = anchorFor(index);

        if (groupIndex !== -1) {
          const group = groups[groupIndex];
          return (
            <div key={`group-${groupIndex}`} className={group.className}>
              {group.columns.map((column, columnIndex) => (
                <div key={columnIndex}>
                  {column.map((key) => {
                    const row = sections.find((s) => s.section_key === key);
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

        return <SectionRenderer key={section.id} section={section} context={context} />;
      })}
    </>
  );
}
