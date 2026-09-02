import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";

import { PortalHelp } from "@/components/portal/portal-help";
import { PortalNav } from "@/components/portal/portal-nav";
import { PortalTopbar } from "@/components/portal/portal-topbar";
import { getPortalSession } from "@/lib/portal/auth";
import { buildThemeTokens } from "@/lib/theme";

/**
 * Pastor Portal shell.
 *
 * Deliberately does NOT call requirePortalUser(): /portal/login and
 * /portal/no-access live under this layout and would redirect-loop. Each page
 * asserts its own access, which is the rule anyway - a layout check protects
 * the render, never the mutation.
 *
 * When there is no session the chrome is dropped and children render bare,
 * so the login screen is a login screen and not a sidebar with nothing in it.
 */
export const metadata: Metadata = {
  title: { default: "Pastor Portal", template: "%s | Pastor Portal" },
  // Never index a church's admin, on any tenant domain.
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await getPortalSession();

  // Themed even when signed out: the login screen still belongs to this
  // church, and site is null only when the hostname matched no tenant at all.
  const tokens = buildThemeTokens(session?.site.theme ?? null) as CSSProperties;

  if (!session) {
    return (
      <div
        className="kc-portal flex min-h-full flex-col bg-[var(--kc-paper)] text-[var(--kc-ink)]"
        style={tokens}
      >
        {children}
      </div>
    );
  }

  const churchName = session.site.church.name ?? "Your church";

  return (
    <div
      className="kc-portal flex min-h-full bg-[var(--kc-paper)] text-[var(--kc-ink)]"
      style={tokens}
    >
      <PortalNav churchName={churchName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <PortalTopbar
          churchName={churchName}
          email={session.email}
          siteUrl={publicSiteUrl(session.site.church.custom_domain, session.site.church.slug)}
        />
        <main className="min-w-0 flex-1 px-5 py-7 md:px-9 md:py-10">{children}</main>
      </div>

      {/* The help bubble, panel and welcome tour. Signed-in chrome only - the
          login screen gets no tour of tabs it cannot open. */}
      <PortalHelp />
    </div>
  );
}

/**
 * Where "View my website" points.
 *
 * A church with a custom domain gets its real address; anything else falls
 * back to the slug query override, which only resolves on preview/dev hosts
 * where KC_ALLOW_CHURCH_QUERY_OVERRIDE is set. That is the honest answer -
 * a church with no domain yet has no public URL to link to.
 */
function publicSiteUrl(customDomain: string | null, slug: string): string {
  if (customDomain) return `https://${customDomain.replace(/^https?:\/\//, "")}`;
  return `/?church=${encodeURIComponent(slug)}`;
}
