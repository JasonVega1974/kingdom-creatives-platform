"use server";

import { requirePortalUser } from "@/lib/portal/auth";
import {
  judgeWrite,
  nullableText,
  publishChange,
  text,
} from "@/lib/portal/collection-write";
import type { TeamState } from "@/lib/portal/form-state";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * Server Actions for "Prayer Wall"
 * ============================================================
 *
 * Moderation only. Nothing here creates a prayer request - those arrive from
 * the public form in app/(public)/actions.ts, always as status = 'pending',
 * which draft 21's insert policy enforces rather than trusts.
 *
 * This tab exists because that was only half a loop. Requests submitted fine
 * and nothing could move them off 'pending', so the wall was permanently empty
 * and the seed copy - "Requests are read by a person before they appear here"
 * - was a promise the software could not keep (FF-47).
 *
 * WHY EVERY WRITE CHAINS .select("id")
 * An UPDATE that RLS filters out is not an error: Postgres reports 0 rows,
 * PostgREST answers 204, supabase-js returns { error: null }. Identical to
 * success. judgeWrite() treats an empty array as a definite refusal. That is
 * FF-27's rule and it is not optional here - a moderation action that silently
 * did nothing would leave a pastor believing they had published a request that
 * is still invisible.
 *
 * The RLS side is already in place: "prayer_requests: member full access"
 * (migration 13) is FOR ALL with a matching `with check`, so a member may write
 * both the before- and after-image. Verified before this was built rather than
 * assumed - that assumption is exactly what failed in FF-27, FF-31 and FF-42.
 */

/** Columns every moderation write touches. */
function moderated(status: string, userId: string | null) {
  return {
    status,
    // approved_at/approved_by are the audit trail, and they are only meaningful
    // for the one status that publishes. Cleared otherwise so a request that
    // was approved and later withdrawn does not still claim it is on the wall.
    approved_at: status === "approved" ? new Date().toISOString() : null,
    approved_by: status === "approved" ? userId : null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Approve, publishing to the wall - and set the name that shows with it.
 *
 * The display name is editable HERE rather than formatted at render time
 * because trimming "Dave M, Peterbilt 379" to "Dave" is a judgement about what
 * a person wants public, not a formatting rule. Storing the pastor's edit means
 * the decision survives and the original submission is not silently displayed
 * somewhere else later.
 *
 * An empty name is stored as NULL, which the wall renders as anonymous. That is
 * a legitimate choice a pastor may make on the submitter's behalf.
 */
export async function approvePrayer(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const requestId = text(formData, "id");
  if (!requestId) return { ok: false, error: "That request could not be found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prayer_requests")
    .update({
      ...moderated("approved", session.userId),
      display_name: nullableText(formData, "display_name"),
    })
    .eq("id", requestId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("approvePrayer", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * Keep private - prayed over, never published.
 *
 * Not a rejection. Someone asking for prayer about a diagnosis or a marriage
 * may want it read and held rather than posted, and a moderation tab with only
 * "publish" and "reject" forces the wrong choice on the pastor.
 */
export async function keepPrayerPrivate(requestId: string): Promise<TeamState> {
  return setPrayerStatus("keepPrayerPrivate", requestId, "private");
}

/** Archive - dealt with, kept for the record, off the wall. */
export async function archivePrayer(requestId: string): Promise<TeamState> {
  return setPrayerStatus("archivePrayer", requestId, "archived");
}

/**
 * Back to the unread pile.
 *
 * The undo for every other action, including taking something off the wall.
 * moderated() clears approved_at/approved_by, so a re-approval later records
 * who actually made that second decision.
 */
export async function unapprovePrayer(requestId: string): Promise<TeamState> {
  return setPrayerStatus("unapprovePrayer", requestId, "pending");
}

/**
 * Delete outright.
 *
 * Archiving is the softer option and the UI leads with it. This exists because
 * a prayer request can contain something a person later asks to have removed,
 * and "we can only hide it" is not an acceptable answer to that request.
 */
export async function removePrayer(requestId: string): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prayer_requests")
    .delete()
    .eq("id", requestId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite("removePrayer", session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}

/**
 * The three status-only moves.
 *
 * Private, archived and pending differ from approved in one way that matters
 * here: none of them needs a name edit, because none of them publishes. Only
 * approvePrayer takes a form.
 */
async function setPrayerStatus(
  what: string,
  requestId: string,
  status: string,
): Promise<TeamState> {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prayer_requests")
    .update(moderated(status, session.userId))
    .eq("id", requestId)
    .eq("church_id", session.site.church.id)
    .select("id");

  const outcome = judgeWrite(what, session.site.church.id, error, data);
  if (!outcome.ok) return outcome;

  publishChange(session.site.church.slug);
  return { ok: true, error: null };
}
