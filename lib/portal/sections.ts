/**
 * ============================================================
 * SECTION REGISTRY - the plain-language map of a church website
 * ============================================================
 *
 * `church_sections` stores `(page_slug, section_key, content, visible,
 * sort_order)`. Those keys are developer names. A pastor must never see one.
 * This file is the translation layer: `page_hero` becomes "Page banner",
 * `bulletin` becomes "Announcements and prayer list".
 *
 * It is also the answer to "where did the 24 feature toggles go". The
 * WordPress intake form collected 24 checkboxes that had no runtime effect,
 * and the WP portal separately kept 128 flat `sm_*` option keys. Both collapse
 * into this: the registry of what CAN exist lives here in code, the per-church
 * on/off state lives in `church_sections.visible`. One fact, one home - see
 * docs/PORTAL_SPEC.md section 2.2.
 *
 * Adding a section: add it here AND add its renderer in the Phase B section
 * switch. A key with no renderer renders nothing, so registry-first is safe.
 * A key in the database with no registry entry still renders on the public
 * site - it simply cannot be edited in the portal until described here.
 */

/**
 * Which editor the portal shows for a content field.
 *
 * `paragraphs` is a textarea whose value is stored as an ARRAY of paragraph
 * strings, not one string. It exists because home.about_strip.body is a list
 * and was declared `textarea`: the editor sent a string, the save overwrote the
 * array with it, and the renderer - which reads the key with strings() - got []
 * back and showed nothing. The home page's two About paragraphs would vanish
 * and the portal would say "Saved". See FF-48.
 *
 * ANY key stored as a list of plain strings must be declared `paragraphs`, not
 * `textarea`. Declaring it `textarea` is silently destructive.
 */
export type FieldKind = "text" | "textarea" | "paragraphs" | "image" | "url";

export type SectionField = {
  /** Key inside church_sections.content. */
  key: string;
  /** What the pastor reads. Never the key. */
  label: string;
  kind: FieldKind;
  /** Optional one-line "why does this exist", shown small next to the label. */
  hint?: string;
};

export type SectionDef = {
  key: string;
  /** Pastor-facing name. Sentence case, no jargon. */
  label: string;
  /** One line under the label explaining what it is. */
  description: string;
  /**
   * True when the section fills itself from another tab (Sermon Library,
   * Events, Announcements). The pastor can still show/hide and reorder it,
   * but there is no text to edit here - the portal says so rather than
   * showing an empty editor.
   */
  auto?: boolean;
  fields?: SectionField[];
};

export type PageDef = {
  slug: string;
  /** Pastor-facing page name, as it appears in the "Which page?" picker. */
  label: string;
  sections: SectionDef[];
};

const HERO_FIELDS: SectionField[] = [
  { key: "eyebrow", label: "Small line above the title", kind: "text" },
  { key: "headline", label: "Title", kind: "text" },
  { key: "lede", label: "Welcome message", kind: "textarea", hint: "The paragraph under the title" },
];

/**
 * Every page the public site can render, in sidebar order.
 *
 * Page slugs match `church_sections.page_slug` and the seed in
 * supabase/drafts/04_cft_sections_seed.sql.
 */
export const PAGES: PageDef[] = [
  {
    slug: "home",
    label: "Home page",
    sections: [
      {
        key: "hero",
        label: "Big welcome banner",
        description: "Your hero image and tagline - the first thing anyone sees",
        fields: [
          ...HERO_FIELDS,
          { key: "image_desktop", label: "Banner photo (computer)", kind: "image" },
          { key: "image_mobile", label: "Banner photo (phone)", kind: "image" },
        ],
      },
      {
        key: "about_strip",
        label: "Who we are",
        description: "A short introduction under the banner",
        /*
         * `heading`, not `headline` - the data has never had a `headline`, so
         * that box saved and changed nothing. `body` is a LIST of paragraphs
         * and must be `paragraphs`; as `textarea` it destroyed them on save.
         */
        fields: [
          { key: "eyebrow", label: "Small line above the title", kind: "text" },
          { key: "heading", label: "Title", kind: "text" },
          { key: "lead_in", label: "Opening line", kind: "textarea" },
          { key: "body", label: "Text", kind: "paragraphs", hint: "blank line between paragraphs" },
          { key: "verse", label: "Verse", kind: "textarea" },
          { key: "verse_cite", label: "Verse reference", kind: "text" },
        ],
      },
      {
        key: "mile_stats",
        label: "Numbers strip",
        description: "The row of figures - miles, states, drivers",
      },
      {
        key: "latest_sermon",
        label: "This week's sermon",
        description: "Fills in automatically from your Sermon Library",
        auto: true,
      },
      {
        key: "events_preview",
        label: "Upcoming events",
        description: "Fills in automatically from Events",
        auto: true,
      },
      {
        key: "bulletin",
        label: "Announcements and prayer list",
        description: "The bulletin board. Fills in from Announcements and the Prayer Wall",
        auto: true,
      },
      {
        key: "get_connected",
        label: "Get connected",
        description: "The strip pointing visitors to groups and studies",
        /*
         * These were `headline` and `body`, which the seed does not store -
         * it holds `eyebrow`, `heading` and `cards`. The portal showed two
         * empty boxes that wrote keys nothing renders, so editing them looked
         * like it saved and changed nothing.
         *
         * `cards` is deliberately absent: it is a list of objects and the
         * section editor only edits scalars. The three cards are not editable
         * from the portal yet - see FF-45.
         */
        fields: [
          { key: "eyebrow", label: "Small line above the title", kind: "text" },
          { key: "heading", label: "Title", kind: "text" },
        ],
      },
      {
        key: "giving_band",
        label: "Giving",
        description: "Your Give button and the words around it",
        /* `heading`, not `headline`. The amount picker's fields are not offered
           - they are deliberately unrendered, see FF-32. */
        fields: [
          { key: "eyebrow", label: "Small line above the title", kind: "text" },
          { key: "heading", label: "Title", kind: "text" },
          { key: "body", label: "Text", kind: "textarea" },
          { key: "note", label: "Small print under the button", kind: "textarea" },
        ],
      },
    ],
  },
  {
    slug: "visit",
    label: "Plan a Visit",
    sections: [
      { key: "page_hero", label: "Page banner", description: "Title at the top of the page", fields: HERO_FIELDS },
      {
        key: "expect",
        label: "What to expect",
        description: "What happens when someone shows up for the first time",
        /*
         * Both declared fields were phantom - the data has `heading` and
         * `items`, never `headline` or `body`. `items` is a list of objects
         * (icon, title, body) and the editor only handles scalars, so the five
         * entries stay seeded-only. See FF-45.
         */
        fields: [{ key: "heading", label: "Title", kind: "text" }],
      },
      { key: "faq", label: "Common questions", description: "The question-and-answer list" },
      { key: "visit_form", label: "Let us know you're coming", description: "The form a visitor fills in", auto: true },
    ],
  },
  {
    slug: "about",
    label: "About Us",
    sections: [
      { key: "page_hero", label: "Page banner", description: "Title at the top of the page", fields: HERO_FIELDS },
      { key: "timeline", label: "Our story", description: "The dated history of the church" },
      { key: "beliefs", label: "What we believe", description: "Your statement of faith" },
      { key: "ministries_intro", label: "Ministries introduction", description: "The words above your ministry list" },
      { key: "about_ctas", label: "Next steps", description: "The buttons at the bottom of the page" },
    ],
  },
  {
    slug: "team",
    label: "Our Team",
    sections: [
      { key: "page_hero", label: "Page banner", description: "Title at the top of the page", fields: HERO_FIELDS },
    ],
  },
  {
    slug: "groups",
    label: "Groups & Bible Studies",
    sections: [
      { key: "page_hero", label: "Page banner", description: "Title at the top of the page", fields: HERO_FIELDS },
      { key: "group_filters", label: "Group filters", description: "How visitors narrow the list", auto: true },
    ],
  },
  {
    slug: "events",
    label: "Events",
    sections: [
      { key: "page_hero", label: "Page banner", description: "Title at the top of the page", fields: HERO_FIELDS },
      { key: "event_filters", label: "Event filters", description: "How visitors narrow the list", auto: true },
    ],
  },
  {
    slug: "sermons",
    label: "Sermons",
    sections: [
      { key: "page_hero", label: "Page banner", description: "Title at the top of the page", fields: HERO_FIELDS },
    ],
  },
  {
    slug: "worship",
    label: "Worship",
    sections: [
      { key: "page_hero", label: "Page banner", description: "Title at the top of the page", fields: HERO_FIELDS },
      { key: "worship_filters", label: "Worship filters", description: "How visitors narrow the list", auto: true },
    ],
  },
  {
    slug: "bible",
    label: "Bible",
    sections: [
      { key: "page_hero", label: "Page banner", description: "Title at the top of the page", fields: HERO_FIELDS },
      { key: "reader", label: "Bible reader", description: "The passage reader itself", auto: true },
      { key: "verse_of_day", label: "Verse of the day", description: "Updates itself daily", auto: true },
      { key: "reading_plan", label: "Reading plan", description: "The plan visitors can follow" },
      { key: "ylcc_bridge", label: "YourLife CC link", description: "The card pointing to YourLife CC" },
    ],
  },
  {
    slug: "devotionals",
    label: "Devotionals",
    sections: [
      { key: "page_hero", label: "Page banner", description: "Title at the top of the page", fields: HERO_FIELDS },
    ],
  },
  {
    slug: "give",
    label: "Give",
    sections: [
      { key: "page_hero", label: "Page banner", description: "Title at the top of the page", fields: HERO_FIELDS },
      {
        key: "give_band",
        label: "Giving",
        description: "Your Give button and the words around it",
        /* `heading`, not `headline`. `bullets` is a list and is not offered
           here - see the structured-content limit in FF-45. */
        fields: [
          { key: "heading", label: "Title", kind: "text" },
          { key: "body", label: "Text", kind: "textarea" },
          { key: "note", label: "Small print under the button", kind: "textarea" },
        ],
      },
      { key: "other_ways", label: "Other ways to give", description: "Mail, in person, anything that is not the button" },
    ],
  },
];

const PAGE_BY_SLUG = new Map(PAGES.map((page) => [page.slug, page]));

export function findPage(slug: string): PageDef | null {
  return PAGE_BY_SLUG.get(slug) ?? null;
}

export function findSection(pageSlug: string, sectionKey: string): SectionDef | null {
  return findPage(pageSlug)?.sections.find((s) => s.key === sectionKey) ?? null;
}

/**
 * Fallback label for a section row that exists in the database but not in the
 * registry - a key seeded ahead of its registry entry, or one left behind by a
 * rename. Better than showing a raw key or hiding the row: the pastor can
 * still toggle and reorder it, and it is visibly odd enough to get reported.
 */
export function describeUnknownSection(sectionKey: string): SectionDef {
  return {
    key: sectionKey,
    label: sectionKey.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    description: "This section is on your website but has no editor yet",
    auto: true,
  };
}
