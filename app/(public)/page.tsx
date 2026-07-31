import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { getCurrentChurchSite, getCurrentTenant, parseServiceTimes } from "@/lib/church";
import { DEFAULT_THEME } from "@/lib/theme";

/**
 * ============================================================
 * PHASE A HOME PAGE
 * ============================================================
 *
 * Every string below comes from the tenant's `churches` row and every colour
 * from its `church_theme` row - nothing is hardcoded. That is the whole point
 * of Phase A: prove hostname -> church_id -> themed render against live data.
 *
 * Phase B replaces this with the section renderer driven by `church_sections`
 * (page_slug = 'home'), per BUILD_BRIEF section 5 and ADDENDUM section A.
 * The Phase A checkpoint panel at the bottom goes away with it.
 */
export default async function HomePage() {
  const site = await getCurrentChurchSite();
  if (!site) notFound();

  const tenant = await getCurrentTenant();
  const { church, theme } = site;
  const serviceTimes = parseServiceTimes(church.service_times);

  return (
    <>
      <SiteHeader church={church} theme={theme} />

      <main>
        <section className="mx-auto max-w-[1120px] px-6 pt-16 pb-20 sm:pt-24">
          {church.address ? (
            <p className="font-utility text-xs uppercase tracking-[0.14em] text-brand">
              {church.address}
            </p>
          ) : null}

          <h1 className="mt-4 text-[clamp(38px,5.2vw,58px)] text-ink">
            {church.name ?? church.slug}
          </h1>

          {church.tagline ? (
            <p className="mt-4 max-w-[58ch] text-lg text-ink-soft">{church.tagline}</p>
          ) : null}

          {church.email ? (
            <Button asChild className="mt-8">
              <a href={`mailto:${church.email}`}>Get in touch</a>
            </Button>
          ) : null}

          {serviceTimes.length > 0 ? (
            <div className="mt-14 max-w-xl overflow-hidden rounded-[var(--kc-radius)] border border-line bg-surface font-utility text-sm">
              <div className="flex items-center justify-between border-b border-line bg-paper-dim px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
                <span>Service times</span>
                <span>{serviceTimes[0]?.tz ?? ""}</span>
              </div>
              <dl>
                {serviceTimes.map((slot, index) => (
                  <div
                    key={`${slot.day ?? "day"}-${slot.time ?? index}`}
                    className="flex flex-wrap justify-between gap-4 border-b border-line/70 px-4 py-3 last:border-b-0"
                  >
                    <dt className="text-ink-soft">
                      {[slot.day, slot.time].filter(Boolean).join(" - ")}
                    </dt>
                    <dd className="text-right font-medium text-brand">{slot.label ?? ""}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </section>

        <PhaseACheckpoint
          slug={tenant?.slug ?? ""}
          churchId={tenant?.id ?? ""}
          host={tenant?.host ?? ""}
          theme={theme}
        />
      </main>

      <SiteFooter church={church} />
    </>
  );
}

/**
 * Temporary Phase A verification panel.
 *
 * Ground rule 0.4 says verify live rather than trust reports - this shows, on
 * the deployed page itself, which tenant resolved and which theme values came
 * back from Supabase. Deleted in Phase B.
 */
function PhaseACheckpoint({
  slug,
  churchId,
  host,
  theme,
}: {
  slug: string;
  churchId: string;
  host: string;
  theme: { color_primary: string; color_secondary: string; color_accent: string; font_heading: string | null; font_body: string | null } | null;
}) {
  const rows: Array<[string, string]> = [
    ["hostname", host || "(none)"],
    ["churches.slug", slug],
    ["churches.id", churchId],
    ["church_theme row", theme ? "found" : "missing - platform defaults in use"],
    ["color_primary -> --kc-brand", theme?.color_primary ?? DEFAULT_THEME.color_primary],
    ["color_secondary -> --kc-accent", theme?.color_secondary ?? DEFAULT_THEME.color_secondary],
    [
      "color_accent -> --kc-brand-contrast",
      theme?.color_accent ?? DEFAULT_THEME.color_accent,
    ],
    ["font_heading -> --kc-font-display", theme?.font_heading ?? DEFAULT_THEME.font_heading],
    ["font_body -> --kc-font-body", theme?.font_body ?? DEFAULT_THEME.font_body],
  ];

  return (
    <section className="mx-auto max-w-[1120px] px-6 pb-24">
      <div className="rounded-[var(--kc-radius)] border border-dashed border-line bg-brand-wash p-6">
        <p className="font-utility text-[11px] uppercase tracking-[0.16em] text-brand">
          Phase A checkpoint - removed in Phase B
        </p>
        <h2 className="mt-2 text-2xl text-ink">Rendered from live Supabase data</h2>

        <dl className="mt-6 grid gap-x-8 gap-y-2 font-utility text-[13px] sm:grid-cols-[auto_1fr]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-soft">{label}</dt>
              <dd className="text-ink break-all">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <Swatch label="--kc-brand" className="bg-brand" />
          <Swatch label="--kc-brand-deep" className="bg-brand-deep" />
          <Swatch label="--kc-brand-night" className="bg-brand-night" />
          <Swatch label="--kc-brand-soft" className="bg-brand-soft" />
          <Swatch label="--kc-accent" className="bg-kc-accent" />
        </div>
      </div>
    </section>
  );
}

function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="w-32">
      <div className={`h-12 rounded-md border border-line ${className}`} />
      <p className="mt-1.5 font-utility text-[10px] text-ink-soft">{label}</p>
    </div>
  );
}
