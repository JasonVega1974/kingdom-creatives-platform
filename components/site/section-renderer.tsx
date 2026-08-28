import { sectionContent, type SectionRow } from "@/lib/sections";

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
 * STEP 1 SCOPE. Only the two hero keys are real. Every other key in the seed
 * falls through to the placeholder. Step 2 fills in the static sections
 * (about_strip, expect, faq, timeline, beliefs, giving_band and the rest),
 * step 3 the collection-backed ones.
 */

export function SectionRenderer({ section }: { section: SectionRow }) {
  switch (section.section_key) {
    // Both hero keys share a renderer. `hero` is the home page's full-height
    // banner and `page_hero` the shorter inner-page one; the seeded fields are
    // identical (eyebrow / headline / lede), so they differ by scale, not
    // structure. Step 2 splits them if the home hero grows its image fields.
    case "hero":
    case "page_hero":
      return <Hero section={section} large={section.section_key === "hero"} />;

    default:
      return <UnbuiltSection sectionKey={section.section_key} />;
  }
}

function Hero({ section, large }: { section: SectionRow; large: boolean }) {
  const { eyebrow, headline, lede } = sectionContent(section.content);

  // A hero with no headline is a seeding mistake, not a layout to render
  // around. Drop it rather than emit an empty band.
  if (!headline) return null;

  return (
    <section className={large ? "px-6 pt-16 pb-20 sm:pt-24" : "px-6 pt-12 pb-10 sm:pt-16"}>
      <div className="mx-auto max-w-[1120px]">
        {eyebrow ? (
          <p className="font-utility text-xs uppercase tracking-[0.14em] text-brand">
            {eyebrow}
          </p>
        ) : null}

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
      </div>
    </section>
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
