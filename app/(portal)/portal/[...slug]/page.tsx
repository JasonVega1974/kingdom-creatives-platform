import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePortalUser } from "@/lib/portal/auth";
import { findNavItem } from "@/lib/portal/nav";

/**
 * Placeholder for sidebar tabs that are declared but not built yet.
 *
 * Catch-all, so it only ever runs for a path no real page claimed. A path that
 * is not in the nav registry 404s - this is not a "anything under /portal is
 * fine" route.
 *
 * These tabs are in the sidebar on purpose. A sidebar that grows week by week
 * reads as unfinished software; a tab that says what it will do reads as a
 * roadmap. The pastor knows what is coming and does not go looking for it.
 */
type Params = { slug: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = findNavItem(`/portal/${slug.join("/")}`);
  return { title: item?.label ?? "Not found" };
}

export default async function PortalPlaceholderPage({
  params,
}: {
  params: Promise<Params>;
}) {
  await requirePortalUser();

  const { slug } = await params;
  const item = findNavItem(`/portal/${slug.join("/")}`);

  if (!item || item.built) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-bold">
        {item.label}
      </h1>
      <p className="mt-2 text-[var(--kc-ink-soft)]">{item.blurb}</p>

      <p className="mt-6 inline-block rounded-[var(--kc-radius)] bg-[var(--kc-brand-wash)] px-3 py-2 text-sm">
        This part of your portal is not ready yet. Nothing is missing from your
        website because of it.
      </p>
    </div>
  );
}
