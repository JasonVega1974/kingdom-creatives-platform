"use server";

import { revalidatePath, updateTag } from "next/cache";

import { churchTag, type ServiceTime } from "@/lib/church";
import { requirePortalUser } from "@/lib/portal/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions for "Church Details".
 *
 * These write the facts the WordPress portal collected at intake and then had
 * no editor for: name, tagline, address, contact details, service times and
 * brand colours. Same shape in, same shape out - docs/PORTAL_SPEC.md
 * principle 4.
 *
 * `slug` and `custom_domain` are deliberately NOT editable here. Changing
 * either re-points the tenant lookup and can take a live church off the
 * internet; that stays a Kingdom Creatives operation.
 */

export type DetailsState = { ok: boolean; error: string | null };

export const IDLE: DetailsState = { ok: false, error: null };

function publish(slug: string): void {
  updateTag(churchTag(slug));
  revalidatePath("/", "layout");
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Nullable text column: an emptied box means NULL, not "". */
function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

export async function saveIdentity(
  _prev: DetailsState,
  formData: FormData,
): Promise<DetailsState> {
  const session = await requirePortalUser();

  const name = text(formData, "name");
  if (!name) {
    return { ok: false, error: "Your church needs a name." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("churches")
    .update({
      name,
      tagline: nullableText(formData, "tagline"),
      address: nullableText(formData, "address"),
      phone: nullableText(formData, "phone"),
      email: nullableText(formData, "email"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.site.church.id);

  if (error) {
    return { ok: false, error: "That did not save. Try again in a moment." };
  }

  publish(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Replace the whole service-times list.
 *
 * The form posts parallel arrays (day[], time[], label[], streaming[]) which
 * are zipped back into the jsonb array. Rows with neither a day nor a time are
 * dropped, so "add a row, change your mind, save" does the obvious thing
 * instead of storing an empty entry.
 *
 * An unchecked checkbox posts nothing at all, so `streaming` cannot be a
 * positional array - one unchecked row would shift every later flag by one.
 * Each checkbox posts its own row index instead, and the action treats the
 * result as a set.
 */
export async function saveServiceTimes(
  _prev: DetailsState,
  formData: FormData,
): Promise<DetailsState> {
  const session = await requirePortalUser();

  const days = formData.getAll("service_day").map(String);
  const times = formData.getAll("service_time").map(String);
  const labels = formData.getAll("service_label").map(String);
  const streaming = new Set(formData.getAll("service_streaming").map(String));

  const rowCount = Math.max(days.length, times.length, labels.length);

  const services: ServiceTime[] = [];
  for (let i = 0; i < rowCount; i += 1) {
    const day = (days[i] ?? "").trim();
    const time = (times[i] ?? "").trim();
    const label = (labels[i] ?? "").trim();

    if (!day && !time) continue;

    services.push({
      day,
      time,
      label,
      streaming: streaming.has(String(i)),
    });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("churches")
    .update({ service_times: services, updated_at: new Date().toISOString() })
    .eq("id", session.site.church.id);

  if (error) {
    return { ok: false, error: "That did not save. Try again in a moment." };
  }

  publish(session.site.church.slug);
  return { ok: true, error: null };
}

/** #abc and #aabbcc, with or without the hash. Anything else is rejected. */
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(value: string): string | null {
  if (!HEX.test(value)) return null;
  const raw = value.replace(/^#/, "");
  const full =
    raw.length === 3 ? raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2] : raw;
  return `#${full.toUpperCase()}`;
}

export async function saveBranding(
  _prev: DetailsState,
  formData: FormData,
): Promise<DetailsState> {
  const session = await requirePortalUser();

  const primary = normalizeHex(text(formData, "color_primary"));
  const secondary = normalizeHex(text(formData, "color_secondary"));
  const accent = normalizeHex(text(formData, "color_accent"));

  if (!primary || !secondary || !accent) {
    return { ok: false, error: "Colours need to look like #A1B2C3." };
  }

  const supabase = await createClient();

  // upsert, not update: a church provisioned without a theme row would
  // otherwise save successfully and change nothing.
  //
  // An upsert writes the WHOLE row, so the fonts have to be carried across
  // explicitly - omitting them would silently reset a church's typography
  // every time someone nudged a colour. This form does not edit them yet.
  const { data: existing } = await supabase
    .from("church_theme")
    .select("font_heading, font_body")
    .eq("church_id", session.site.church.id)
    .maybeSingle();

  const { error } = await supabase.from("church_theme").upsert(
    {
      church_id: session.site.church.id,
      color_primary: primary,
      color_secondary: secondary,
      color_accent: accent,
      font_heading: existing?.font_heading ?? null,
      font_body: existing?.font_body ?? null,
      logo_url: nullableText(formData, "logo_url"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "church_id" },
  );

  if (error) {
    return { ok: false, error: "That did not save. Try again in a moment." };
  }

  publish(session.site.church.slug);
  return { ok: true, error: null };
}
