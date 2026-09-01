import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPage } from "@/components/site/legal-page";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getCurrentChurchSite } from "@/lib/church";
import { LEGAL_UPDATED, termsOfUse } from "@/lib/legal";
import { getChurchLinks } from "@/lib/links";

export const metadata: Metadata = { title: "Terms of Use" };

/**
 * Terms of Use.
 *
 * A static segment, so it wins over [slug] in the router the same way /portal
 * does - this is not a church_sections page and is not pastor-editable. The
 * wording is the platform's; the church name, domain and contact come from the
 * churches row. See lib/legal.ts for why.
 */
export default async function TermsOfUsePage() {
  const site = await getCurrentChurchSite();
  if (!site) notFound();

  const links = await getChurchLinks(site.church.slug, site.church.id);

  return (
    <>
      <SiteHeader church={site.church} theme={site.theme} activeSlug="terms" links={links} />
      <main>
        <LegalPage doc={termsOfUse(site.church)} updated={LEGAL_UPDATED} />
      </main>
      <SiteFooter church={site.church} links={links} />
    </>
  );
}
