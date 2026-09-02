/**
 * Portal sidebar. Groups, order and labels come from
 * prototypes/cft-pastor-portal.html and are not to be reworded - they were
 * written for a reader who does not use the word "CMS".
 *
 * `built: false` items still appear, because a sidebar that grows week by week
 * makes the product feel unfinished in a way a visibly-not-yet-built tab does
 * not. They render a short "coming soon" panel instead of 404ing.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  built: boolean;
  /** Shown on the placeholder screen for items that are not built yet. */
  blurb?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    label: "This week",
    items: [{ href: "/portal", label: "Home", icon: "\u{1F3E0}", built: true }],
  },
  {
    label: "Preach",
    items: [
      {
        href: "/portal/sermon-builder",
        label: "Sermon Builder",
        icon: "\u{270D}",
        built: true,
      },
      { href: "/portal/sermons", label: "Sermon Library", icon: "\u{1F4DA}", built: true },
      {
        href: "/portal/notes",
        // Not "My Notes" - as of 2026-09-01 (supabase/drafts/33_notes.sql)
        // this table is church-shared, not owner-private. The old label and
        // its lock icon both implied privacy the RLS no longer grants; see
        // the in-tab banner in components/portal/notes-editor.tsx for the
        // same fact stated where a pastor actually reads it.
        label: "Notes",
        icon: "\u{1F5D2}",
        built: true,
      },
    ],
  },
  {
    label: "Your website",
    items: [
      { href: "/portal/website", label: "Edit My Website", icon: "\u{1F5A5}", built: true },
      { href: "/portal/details", label: "Church Details", icon: "\u{1F4CB}", built: true },
      {
        href: "/portal/photos",
        label: "Photos",
        icon: "\u{1F4F7}",
        built: true,
      },
      {
        href: "/portal/videos",
        label: "Videos",
        icon: "\u{1F3AC}",
        built: false,
        blurb: "Your YouTube channels and any video you want on the site.",
      },
      { href: "/portal/announcements", label: "Announcements", icon: "\u{1F4E3}", built: true },
      {
        href: "/portal/prayer",
        label: "Prayer Wall",
        icon: "\u{1F64F}",
        built: true,
        blurb: "Read prayer requests and choose which ones appear publicly.",
      },
      {
        href: "/portal/groups",
        label: "Groups & Studies",
        icon: "\u{1F9ED}",
        built: true,
      },
      { href: "/portal/ministries", label: "Ministries", icon: "\u{1F932}", built: true },
    ],
  },
  {
    label: "People",
    items: [
      {
        href: "/portal/emails",
        label: "Send Emails",
        icon: "\u{2709}",
        built: false,
        blurb: "Write to your congregation, and manage who is on which list.",
      },
      {
        href: "/portal/events",
        label: "Events",
        icon: "\u{1F4C5}",
        built: true,
      },
      { href: "/portal/team", label: "Our Team", icon: "\u{1F465}", built: true },
    ],
  },
  {
    label: "Church office",
    items: [
      // "Giving" tab removed 2026-09-02. There was never a second thing for it
      // to do beyond what Church Details' Links panel already does - editing
      // the giving link - and FF-32 closed the door on the one thing that
      // would have earned it its own screen (a built-in gift list; Tithe.ly
      // is the decided answer, and Tithe.ly does not push data into this
      // database for a report to read). See components/portal/links-panel.tsx
      // for where the giving link and the Tithe.ly dashboard link-out live
      // now. If built-in giving becomes a real Phase E feature, it earns a
      // tab back then - not before.
      {
        href: "/portal/documents",
        label: "Documents",
        icon: "\u{1F5C4}",
        built: false,
        blurb: "Private files for you and your board.",
      },
      {
        href: "/portal/account",
        label: "Help & Account",
        icon: "\u{1F6DF}",
        built: false,
        blurb: "Your password, who else can sign in, and how to reach us.",
      },
    ],
  },
];

const ITEMS = NAV.flatMap((group) => group.items);

export function findNavItem(href: string): NavItem | null {
  return ITEMS.find((item) => item.href === href) ?? null;
}
