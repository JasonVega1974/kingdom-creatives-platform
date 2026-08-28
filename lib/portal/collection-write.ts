import "server-only";

import { revalidatePath, updateTag } from "next/cache";

import { churchTag } from "@/lib/church";
import type { TeamState } from "@/lib/portal/form-state";

/**
 * ============================================================
 * SHARED WRITE HELPERS for the collection tabs
 * ============================================================
 *
 * Our Team, Sermon Library, Events and Groups all judge a write the same way
 * and all publish the same way. Four copies of judge() would drift, and the
 * thing they encode - FF-27's rule - is the one piece of this codebase most
 * expensive to get subtly wrong.
 *
 * NOT a "use server" module. It exports non-async values, which a "use server"
 * file may not do; the actions files import from here. See
 * lib/portal/form-state.ts for the same constraint.
 */

const WRITE_FAILED = "That did not save. Try again in a moment.";
const WRITE_REFUSED =
  "That did not save. Your account is not allowed to change this - nothing was written. Please contact Kingdom Creatives.";

/**
 * Turn a supabase-js result into a state a form can render.
 *
 * FF-27: an UPDATE or DELETE that RLS filters out is NOT an error. Postgres
 * reports 0 rows changed, PostgREST answers 204, and supabase-js returns
 * { error: null } - identical to a successful write. So every caller chains
 * .select() and passes the returned rows here; an empty array is a definite
 * refusal.
 *
 * The two failures read differently on purpose. "Try again" is honest for a
 * transport blip and misleading for a permission problem, which will never
 * succeed however many times someone clicks Save.
 *
 * This is safe for the portal tabs because a pastor can read back every row
 * they can write, including hidden ones. It is NOT safe for the public forms,
 * where the writer deliberately cannot read what it wrote - see
 * app/(public)/actions.ts.
 */
export function judgeWrite(
  what: string,
  churchId: string,
  error: { message: string } | null,
  rows: unknown[] | null,
): TeamState {
  if (error) {
    console.error(`[portal] ${what} failed for church ${churchId}: ${error.message}`);
    return { ok: false, error: WRITE_FAILED };
  }

  if (!rows || rows.length === 0) {
    console.error(
      `[portal] ${what} for church ${churchId} affected 0 rows - RLS refused the write, or the row is gone.`,
    );
    return { ok: false, error: WRITE_REFUSED };
  }

  return { ok: true, error: null };
}

export const writeFailed: TeamState = { ok: false, error: WRITE_FAILED };

/**
 * Push a change to the live public site immediately.
 *
 * updateTag is a no-op against unstable_cache (FF-29) - the revalidatePath is
 * what actually works. Both are kept until lib/church.ts moves to `use cache`,
 * at which point updateTag becomes the correct call and revalidatePath can go.
 */
export function publishChange(slug: string): void {
  updateTag(churchTag(slug));
  revalidatePath("/", "layout");
}

/** Trimmed form value. */
export function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Nullable text column: an emptied box means NULL, not "". */
export function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

/** A checkbox that was ticked. Unticked checkboxes post nothing at all. */
export function checked(formData: FormData, key: string): boolean {
  return formData.get(key) != null;
}

/**
 * A <input type="datetime-local"> value as an ISO timestamp, or null.
 *
 * KNOWN LIMITATION - see FF-38. `datetime-local` posts "2026-09-13T10:30" with
 * no timezone, and there is nowhere on `churches` to look one up: only
 * `service_times` carries a `tz`, per slot, and events are not service times.
 *
 * So the wall-clock time is pinned to UTC deliberately, rather than letting
 * `new Date(raw)` interpret it in whatever zone the server happens to run in.
 * Vercel runs UTC, so the two agree today - but "happens to agree" is not a
 * rule, and a region change would silently shift every event by hours.
 *
 * The consequence, stated plainly: the stored instant is NOT the real instant
 * unless the church is on UTC. It round-trips exactly - the pastor types 10:30
 * and every reader renders 10:30, because the events list formats with
 * timeZone: "UTC" to match - so the site is self-consistent and predictable.
 * It would be wrong for anything that leaves the site with real timezone
 * meaning, such as a calendar export or a reminder email.
 *
 * The fix is a church timezone column, which is a schema change and therefore
 * a draft, not a decision to make inside a helper.
 */
export function nullableTimestamp(formData: FormData, key: string): string | null {
  const raw = text(formData, key);
  if (raw === "") return null;

  // Append Z so the string is parsed as UTC rather than as server-local time.
  const hasZone = /[Zz]|[+-]\d{2}:\d{2}$/.test(raw);
  const parsed = new Date(hasZone ? raw : `${raw}Z`);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
