import Image from "next/image";
import Link from "next/link";

import type { Church, ChurchTheme } from "@/lib/church";
import type { ChurchLink } from "@/lib/links";
import { sermonChannels } from "@/lib/video-channels";
import { mediaUrl } from "@/lib/portal/media";

/**
 * ============================================================
 * SITE HEADER - the only way to reach the other ten pages
 * ============================================================
 *
 * This was a Phase A stub - logo and tagline, with a comment saying the nav
 * groups "land in Phase B/C". Phase B came and went and they did not, so the
 * live site had no navigation at all: a visitor on the home page could not
 * reach /about, /visit or /give except by typing the URL.
 *
 * The grouping is ADDENDUM_01 section B - "Visit, Watch (sermons/worship),
 * Connect (groups/events/team), Grow (bible/devotionals), Give" - because
 * eleven pages cannot be eleven top-level links.
 *
 * NO JAVASCRIPT. The prototype's dropdown is pure CSS: `li:hover > .dropdown`
 * and `li:focus-within > .dropdown`, so it opens on hover AND on keyboard
 * focus. The mobile menu is a <details> rather than the prototype's scripted
 * class toggle, which means it works with JavaScript off and needs no client
 * component. This whole header stays a Server Component.
 *
 * NOT PORTED from the prototype: the language picker, which is not built and
 * would be a control that does nothing.
 */

type NavChild = { href: string; label: string };
export type NavEntry = { label: string; href?: string; children?: NavChild[] };

/**
 * The nav, as real routes.
 *
 * The prototype's hrefs are hash routes (`#/visit`) for a single-file mockup.
 * These are the actual Next routes, so they prefetch, they work with
 * JavaScript off, and a middle-click opens a real page.
 */
/**
 * The site's navigation, and the ONE source of it.
 *
 * The footer builds its link list from this array rather than keeping a second
 * one. Two hand-maintained lists of the same eleven routes drift the first time
 * somebody adds a page, and the footer is where nobody notices.
 */
export const NAV: NavEntry[] = [
  { label: "Home", href: "/" },
  { label: "Visit", href: "/visit" },
  {
    label: "Watch",
    children: [
      { href: "/sermons", label: "Sermons" },
      { href: "/worship", label: "Worship Library" },
    ],
  },
  {
    label: "Connect",
    children: [
      /* "Groups" only. It used to read "Groups & Bible Studies" and point
         at /groups, which is small groups - so a visitor who came for
         Bible studies landed on the wrong page entirely. The studies now
         have their own entry under Watch, built from church_links. */
      { href: "/groups", label: "Groups" },
      { href: "/events", label: "Events" },
      { href: "/team", label: "Our Team" },
      { href: "/about", label: "About Us" },
    ],
  },
  {
    label: "Grow",
    children: [
      { href: "/bible", label: "Bible" },
      { href: "/devotionals", label: "Devotionals" },
    ],
  },
  { label: "Give", href: "/give" },
];

export function SiteHeader({
  church,
  theme,
  activeSlug,
  links = [],
}: {
  church: Church;
  theme: ChurchTheme | null;
  /** church_links, so the Watch menu can list this church's own channels. */
  links?: ChurchLink[];
  /**
   * The page being rendered, so its link can be marked current. Passed from
   * the page rather than read from a hook - this is a Server Component, and
   * usePathname would make the whole header a client bundle for one class.
   */
  activeSlug?: string;
}) {
  const name = church.name ?? church.slug;

  const isActive = (href: string) => href === `/${activeSlug ?? ""}`;

  const nav = buildNav(links);

  return (
    <header>
      <div className="wrap nav">
        <Link className="logo" href="/" aria-label={`${name} home`}>
          <Logo theme={theme} name={name} />
          {church.tagline ? <span className="logo-tag">{church.tagline}</span> : null}
        </Link>

        <ul className="nav-links">
          {nav.map((entry) =>
            entry.children ? (
              <li key={entry.label}>
                {/*
                  A button, not a link: it opens a menu rather than going
                  anywhere, and the CSS opens it on focus-within so keyboard
                  users get the same behaviour as a hover.
                */}
                <button className="navtop" aria-haspopup="true" type="button">
                  {entry.label}
                </button>
                <div className="dropdown">
                  {entry.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={isActive(child.href) ? "active" : undefined}
                      aria-current={isActive(child.href) ? "page" : undefined}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </li>
            ) : (
              <li key={entry.label}>
                <Link
                  href={entry.href!}
                  className={isActive(entry.href!) ? "active" : undefined}
                  aria-current={isActive(entry.href!) ? "page" : undefined}
                >
                  {entry.label}
                </Link>
              </li>
            ),
          )}
        </ul>

        {/* The pastor's way in. noindex is set on the portal itself. */}
        <Link className="btn btn-solid portal-btn" href="/portal">
          Portal
        </Link>

        <details className="mobile-menu">
          <summary className="menu-btn" aria-label="Menu">
            Menu
          </summary>

          <nav className="mobile-nav">
            {nav.map((entry) =>
              entry.children ? (
                <div key={entry.label}>
                  <div className="mgroup">{entry.label}</div>
                  {entry.children.map((child) => (
                    <Link key={child.href} href={child.href}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link key={entry.label} href={entry.href!}>
                  {entry.label}
                </Link>
              ),
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}

/**
 * The church's mark.
 *
 * A library logo goes through next/image - our own bucket is allow-listed. A
 * hand-pasted logo_url does not, because it can point at any host and
 * next/image throws on one that is not allow-listed (FF-40). With neither, the
 * prototype's text mark carries the church's name.
 */
function Logo({ theme, name }: { theme: ChurchTheme | null; name: string }) {
  if (theme?.church_media) {
    return (
      <Image
        src={mediaUrl(theme.church_media.storage_path)}
        alt={name}
        width={48}
        height={48}
        style={{ height: "48px", width: "auto" }}
      />
    );
  }

  if (theme?.logo_url) {
    return (
      <Image
        src={theme.logo_url}
        alt={name}
        width={48}
        height={48}
        style={{ height: "48px", width: "auto" }}
        unoptimized
      />
    );
  }

  return (
    <span className="logo-mark">
      {name.split(/\s+/).map((word, index) => (
        <span key={index} style={{ display: "block" }}>
          {word}
        </span>
      ))}
    </span>
  );
}

/**
 * The nav for ONE church: the shared skeleton, plus that church's own video
 * channels under Watch.
 *
 * The channel ids are per-church data and must never appear in this file. They
 * come from church_links, and so do the labels - "Preaching" and "Bible
 * Studies" are what THIS church called its channels, not a platform constant.
 * Another church's menu will read whatever it called its own.
 *
 * A church with no usable channels gets NAV back unchanged, which is exactly
 * the menu the site had before any of this - the array is returned by
 * reference, so there is not even a copy to diverge.
 *
 * Entries land between Sermons and Worship Library: "everything", then each
 * channel, then the other library. sermonChannels() is reused rather than
 * re-filtering here, so the rule that an external_id must be a UC... id lives
 * in exactly one place.
 */
export function buildNav(links: ChurchLink[] = []): NavEntry[] {
  const channels = sermonChannels(links);
  if (channels.length === 0) return NAV;

  return NAV.map((entry) => {
    if (entry.label !== "Watch" || !entry.children) return entry;

    const sermons = entry.children.filter((child) => child.href === "/sermons");
    const rest = entry.children.filter((child) => child.href !== "/sermons");

    return {
      ...entry,
      children: [
        ...sermons,
        ...channels.map((channel) => ({
          href: `/sermons?channel=${encodeURIComponent(channel.id)}`,
          label: channel.label,
        })),
        ...rest,
      ],
    };
  });
}
