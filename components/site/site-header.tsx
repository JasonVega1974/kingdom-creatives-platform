import Image from "next/image";

import { mediaUrl } from "@/lib/portal/media";

import type { Church, ChurchTheme } from "@/lib/church";

/**
 * Phase A header: church identity only.
 *
 * Nav groups (Visit / Watch / Connect / Grow / Give), the language picker and
 * the Portal button land in Phase B/C - see BUILD_BRIEF_ADDENDUM_01 section B.
 */
export function SiteHeader({
  church,
  theme,
}: {
  church: Church;
  theme: ChurchTheme | null;
}) {
  const name = church.name ?? church.slug;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-6 py-4">
        {theme?.church_media ? (
          /* A library logo is in our own bucket, which next.config allow-lists,
             so it goes through next/image properly. */
          <Image
            src={mediaUrl(theme.church_media.storage_path)}
            alt={name}
            width={48}
            height={48}
            className="h-12 w-auto"
          />
        ) : theme?.logo_url ? (
          <Image
            src={theme.logo_url}
            alt={name}
            width={48}
            height={48}
            className="h-12 w-auto"
            /* Unoptimized on purpose: logo_url is a free-text column, so it can
               point outside next.config's remotePatterns and would otherwise
               throw. Retired with FF-40, once every logo is a library item. */
            unoptimized
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--kc-radius)] bg-brand font-display text-xl text-brand-contrast"
          >
            {initials(name)}
          </span>
        )}

        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight text-ink">{name}</p>
          {church.tagline ? (
            <p className="truncate font-utility text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              {church.tagline}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    // \p{L}, not [a-z]: a church named "Agape Iglesia" with an accented first
    // letter, or a non-Latin name, would otherwise be filtered out entirely and
    // render an empty brand-coloured box.
    .filter((word) => /\p{L}/u.test(word[0] ?? ""))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
