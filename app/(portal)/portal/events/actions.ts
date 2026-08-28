"use server";

import { requirePortalUser } from "@/lib/portal/auth";
import {
  judgeWrite,
  nullableText,
  nullableUuid,
  nullableTimestamp,
  publishChange,
  text,
  writeFailed,
} from "@/lib/portal/collection-write";
import type { TeamState } from "@/lib/portal/form-state";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * Server Actions for "Events"
 * ============================================================
 *
 * Writes public.events - the calendar on /events and the next few on the home
 * page. Same pattern as Our Team, with a boolean `published` rather than
 * `visible`, which is this schema's third naming convention for the same idea.
 *
 * `event_type` matters more here than it looks: the public /events filter strip
 * is seeded with `in_person` and `retreat`, and it filters on this column. A
 * typed-in value that is not in that list makes an event unreachable from the
 * filters even though it is published, so the tab offers a picker rather than
 * a free-text box.
 *
 * TIMES ARE STORED AS UTC WALL-CLOCK. See nullableTimestamp() and FF-38 -
 * the church has no timezone column, so the typed time is pinned to UTC and
 * rendered back in UTC. Self-consistent, and wrong for anything that leaves
 * the site with real timezone meaning.
 */

/**
 * Add an event.
 *
 * Arrives UNPUBLISHED, same reasoning as hidden team members and draft
 * sermons: a half-entered event should not appear on the calendar.
 */
export async function addEvent(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const title = text(formData, "title");
  if (!title) return { ok: false, error: "An event needs a title." };

  const startsAt = nullableTimestamp(formData, "starts_at");
  if (!startsAt) {
    return { ok: false, error: "An event needs a date and time to start." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      church_id: session.site.church.id,
      title,
      description: nullableText(formData, "description"),
      starts_at: startsAt,
      ends_at: nullableTimestamp(formData, "ends_at"),
      location: nullableText(formData, "location"),
      event_type: nullableText(formData, "event_type"),
      registration_url: nullableText(formData, "registration_url"),
      media_id: nullableUuid(formData, "media_id"),
      published: false,
    })
    .select("id");

  const outcome = judgeWrite("addEvent", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function updateEvent(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const id = text(formData, "id");
  const title = text(formData, "title");

  if (!id) return writeFailed;
  if (!title) return { ok: false, error: "An event needs a title." };

  const startsAt = nullableTimestamp(formData, "starts_at");
  if (!startsAt) {
    return { ok: false, error: "An event needs a date and time to start." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({
      title,
      description: nullableText(formData, "description"),
      starts_at: startsAt,
      ends_at: nullableTimestamp(formData, "ends_at"),
      location: nullableText(formData, "location"),
      event_type: nullableText(formData, "event_type"),
      registration_url: nullableText(formData, "registration_url"),
      media_id: nullableUuid(formData, "media_id"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("updateEvent", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function setEventPublished(
  eventId: string,
  published: boolean,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("setEventPublished", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

export async function removeEvent(eventId: string): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("removeEvent", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}
