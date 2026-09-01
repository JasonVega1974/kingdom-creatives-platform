import Link from "next/link";

import { NAV } from "@/components/site/site-header";
import type { Church } from "@/lib/church";
import { LEGAL_LINKS, PLATFORM_URL } from "@/lib/legal";
import type { ChurchLink } from "@/lib/links";
import { footerVideo, socialLinks } from "@/lib/links";

/**
 * ============================================================
 * SITE FOOTER
 * ============================================================
 *
 * The link list is DERIVED FROM THE HEADER'S NAV, not typed out again. Two
 * hand-maintained lists of the same routes drift the first time somebody adds a
 * page, and the footer is exactly where nobody notices for six months.
 *
 * Flattening is the whole transformation: the header groups eleven routes under
 * five labels because a horizontal bar cannot hold eleven, and a footer column
 * has no such constraint. So the groups are dissolved and every destination is
 * listed once.
 *
 * /devotionals is excluded deliberately - the route exists but its content is
 * deferred (FF-30), so it renders a hero and little else. Sending visitors from
 * the footer to a near-empty page is worse than not listing it. Decided with
 * Jason 2026-09-01; put it back when B2 ships.
 */

/** Routes listed in the header that the footer does not repeat. */
const FOOTER_EXCLUDES = new Set(["/devotionals"]);

/** Header groups flattened to a single list of destinations. */
function footerRoutes() {
  return NAV.flatMap((entry) =>
    entry.children
      ? entry.children.map((child) => ({ href: child.href, label: child.label }))
      : entry.href
        ? [{ href: entry.href, label: entry.label }]
        : [],
  ).filter((route) => !FOOTER_EXCLUDES.has(route.href));
}

export function SiteFooter({
  church,
  links = [],
}: {
  church: Church;
  /** Every church_links row. The footer picks what it needs. */
  links?: ChurchLink[];
}) {
  const name = church.name ?? church.slug;

  /*
   * Social profiles, plus the ONE primary video channel.
   *
   * CFT has two YouTube channels and only the main one belongs here. Two
   * identical YouTube glyphs side by side would be distinguishable only by
   * hovering, which is not a choice worth offering in a footer. The Bible
   * Studies channel has a labelled home on the Worship page instead.
   */
  const video = footerVideo(links);
  const social = [...socialLinks(links), ...(video ? [video] : [])];

  /*
   * The prayer wall is a SECTION of the home page, not a route - there is no
   * /prayer. Same anchor the "Add a request" card points at, fixed in
   * migration 26. A /prayer link here would 404.
   */
  const routes = [...footerRoutes(), { href: "/#prayer", label: "Prayer Wall" }];

  return (
    <footer className="mt-auto bg-brand-night text-brand-soft">
      <div className="mx-auto max-w-[1120px] px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="font-display text-2xl text-[color:var(--kc-brand-contrast)]">{name}</p>

            <address className="mt-4 space-y-1 text-[15px] not-italic opacity-90">
              {church.address ? <p>{church.address}</p> : null}
              {church.email ? (
                <p>
                  <a className="underline-offset-4 hover:underline" href={`mailto:${church.email}`}>
                    {church.email}
                  </a>
                </p>
              ) : null}
              {church.phone ? (
                <p>
                  <a className="underline-offset-4 hover:underline" href={`tel:${church.phone}`}>
                    {church.phone}
                  </a>
                </p>
              ) : null}
            </address>

            {social.length > 0 ? (
              <ul className="mt-6 flex items-center gap-3">
                {social.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      /* The icon carries no text, so the accessible name comes
                         from here - "Facebook Group", "Preaching" - which is
                         also what a hover tooltip shows. */
                      aria-label={link.label ?? link.platform ?? "Social link"}
                      title={link.label ?? undefined}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 opacity-80 transition hover:border-white/50 hover:opacity-100"
                    >
                      <PlatformIcon platform={link.platform} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <nav aria-label="Footer">
            <h2 className="font-utility text-xs uppercase tracking-[0.14em] opacity-70">
              Explore
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[15px]">
              {routes.map((route) => (
                <li key={route.href}>
                  <Link className="underline-offset-4 hover:underline" href={route.href}>
                    {route.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-5 font-utility text-xs opacity-70">
          {/* Smaller and muted, per the brief - present and findable, not
              competing with the church's own links above. */}
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {LEGAL_LINKS.map((legal, index) => (
              <li key={legal.href} className="flex items-center gap-3">
                {index > 0 ? <span aria-hidden="true">&middot;</span> : null}
                <Link className="underline-offset-4 hover:underline" href={legal.href}>
                  {legal.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Hardcoded for now. On a white-label platform, removing this is a
              normal paid tier, which makes it a per-tenant setting rather than
              a constant - filed as FF-51 rather than invented here. */}
          <p>
            Powered by{" "}
            <a
              className="underline-offset-4 hover:underline"
              href={PLATFORM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Kingdom Creatives
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Inline SVG, deliberately not an icon library.
 *
 * Two glyphs do not justify a dependency, a font, or a sprite request, and
 * these inherit currentColor so they follow the footer's palette without
 * further styling.
 *
 * An unrecognised platform renders NOTHING rather than a generic globe. A
 * church_links row for a platform we have no mark for should be invisible until
 * someone adds one - a placeholder icon in a row of real brand marks reads as
 * broken, and there is no honest generic stand-in for a brand.
 */
function PlatformIcon({ platform }: { platform: string | null }) {
  const shared = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": true,
    focusable: false,
  } as const;

  switch (platform) {
    case "facebook":
      return (
        <svg {...shared}>
          <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
        </svg>
      );

    case "youtube":
      return (
        <svg {...shared}>
          <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2C0 8.08 0 12 0 12s0 3.92.5 5.8a3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.8ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
        </svg>
      );

    default:
      return null;
  }
}
