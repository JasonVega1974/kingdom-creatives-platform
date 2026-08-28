import type { Metadata } from "next";

import {
  BrandingForm,
  IdentityForm,
  ServiceTimesForm,
} from "@/components/portal/details-forms";
import { parseServiceTimes } from "@/lib/church";
import { requirePortalUser } from "@/lib/portal/auth";
import type { LibraryItem } from "@/components/portal/media-picker";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME } from "@/lib/theme";

export const metadata: Metadata = { title: "Church Details" };

/**
 * "Church Details" - the facts about the church itself.
 *
 * This tab is the fix for the specific failure that killed the WordPress
 * version: intake collected name, tagline, address, contact details, service
 * times and brand colours, and then nothing could ever edit them again. Same
 * shape in, same shape out.
 *
 * Everything here is already loaded on the request by getCurrentChurchSite(),
 * so there is no second query.
 */
export default async function DetailsPage() {
  const session = await requirePortalUser();
  const { church, theme } = session.site;

  const supabase = await createClient();
  const { data: libraryRows } = await supabase
    .from("church_media")
    .select("id, storage_path, title, alt_text")
    .eq("church_id", church.id)
    .order("created_at", { ascending: false });

  const library: LibraryItem[] = (libraryRows ?? []).map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    title: row.title ?? "",
    altText: row.alt_text ?? "",
  }));

  return (
    <div className="max-w-3xl">
      <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-semibold">
        Church Details
      </h1>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        The facts about your church. Changing anything here updates every page
        of your website at once.
      </p>

      <div className="space-y-5">
        <IdentityForm
          name={church.name ?? ""}
          tagline={church.tagline ?? ""}
          address={church.address ?? ""}
          phone={church.phone ?? ""}
          email={church.email ?? ""}
        />

        <ServiceTimesForm services={parseServiceTimes(church.service_times)} />

        <BrandingForm
          primary={theme?.color_primary ?? DEFAULT_THEME.color_primary}
          secondary={theme?.color_secondary ?? DEFAULT_THEME.color_secondary}
          accent={theme?.color_accent ?? DEFAULT_THEME.color_accent}
          logoUrl={theme?.logo_url ?? ""}
          logoMediaId={theme?.logo_media_id ?? null}
          library={library}
        />

        {/* Social, video and giving links are multi-valued and live in
            church_links, which does not exist in the database yet - see
            supabase/drafts/09_church_links.sql. Saying so beats shipping a
            form that silently drops the second YouTube channel. */}
        <section className="rounded-[var(--kc-radius)] border border-dashed border-[var(--kc-line)] p-5">
          <h2 className="font-[family-name:var(--kc-font-display)] text-xl font-semibold">
            Social, video and giving links
          </h2>
          <p className="mt-1 text-sm text-[var(--kc-ink-soft)]">
            Coming next. This is where your YouTube channels, Facebook group and
            Give button will live - each one addable more than once, so a second
            channel is a normal thing rather than a rebuild.
          </p>
        </section>

        <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-paper-dim)] p-5">
          <h2 className="text-sm font-semibold">Your website address</h2>
          <p className="mt-1 text-sm text-[var(--kc-ink-soft)]">
            {church.custom_domain ?? `${church.slug} (no custom domain yet)`}. To
            change this, contact Kingdom Creatives - it affects how people find
            you, so we do it with you rather than for you.
          </p>
        </section>
      </div>
    </div>
  );
}
