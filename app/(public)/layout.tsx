import "./site.css";
// Imported after site.css so our own decisions win over the generated port.
import "./site-overrides.css";

import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCurrentChurchSite } from "@/lib/church";
import { buildThemeTokens } from "@/lib/theme";

/**
 * Public church site shell.
 *
 * Resolves the tenant the proxy stamped on the request, pulls its
 * church_theme row, and emits the token set as CSS custom properties on a
 * wrapper element. Everything below this layout reads variables only.
 *
 * Tokens go on a style object rather than an injected <style> string: React
 * supports custom properties natively, so there is no HTML to escape and no
 * hydration mismatch to reason about.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentChurchSite();
  if (!site) return { title: "Not found" };

  const name = site.church.name ?? "Church";

  return {
    title: { default: name, template: `%s | ${name}` },
    description: site.church.tagline ?? undefined,
  };
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const site = await getCurrentChurchSite();

  // No church matched this hostname. Themed 404 rather than a blank platform
  // page - see BUILD_BRIEF_ADDENDUM_01 section A.
  if (!site) notFound();

  const tokens = buildThemeTokens(site.theme) as CSSProperties;

  return (
    <div className="kc-site flex min-h-full flex-col" style={tokens}>
      {children}
    </div>
  );
}
