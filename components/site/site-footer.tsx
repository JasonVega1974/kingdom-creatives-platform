import type { Church } from "@/lib/church";
import type { ChurchLink } from "@/lib/links";
import { footerVideo, socialLinks } from "@/lib/links";

/**
 * Phase A footer: contact details from the churches row, plus the social row.
 * Map and nav columns are still Phase B.
 */
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

  return (
    <footer className="mt-auto bg-brand-night text-brand-soft">
      <div className="mx-auto max-w-[1120px] px-6 py-14">
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
                  /* The icon carries no text, so the accessible name comes from
                     here - "Facebook Group", "Preaching" - which is also what a
                     hover tooltip shows. */
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

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[1120px] px-6 py-5 font-utility text-xs opacity-70">
          Powered by Kingdom Creatives
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
