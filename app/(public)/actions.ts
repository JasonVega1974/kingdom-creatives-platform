"use server";

import { getCurrentChurchSite } from "@/lib/church";
import type { PublicFormState } from "@/lib/site/form-state";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * PUBLIC FORM ACTIONS - Plan a Visit, and prayer requests
 * ============================================================
 *
 * The replacement for what the prototype does with Web3Forms. See the banner at
 * the top of prototypes/cft-site-orange.html: posting these to a third-party
 * form-to-email service would send the church's own data somewhere the pastor
 * cannot see it, and leave the portal's Prayer and Church Office tabs empty.
 *
 * THE CHURCH ID COMES FROM THE HOSTNAME, never the form. Same rule as the
 * portal: the tenant is resolved server-side by proxy.ts, and a client never
 * gets to say which church a submission belongs to. A hidden church_id field
 * would be a cross-tenant write waiting to happen.
 *
 * WHY THESE DO NOT CHAIN .select() - and the portal actions do.
 *
 * FF-27's rule is that a write must ask for its rows back, because an UPDATE
 * refused by RLS returns 204 with error null and looks exactly like success.
 * That rule does not transfer here, and applying it would break both forms:
 *
 *   - an INSERT refused by RLS RAISES 42501. `error` is non-null, so there is
 *     a real failure signal to check. Nothing is silent.
 *   - neither table grants anon SELECT on the rows being written. contacts has
 *     no anon read policy at all; prayer_requests admits only status =
 *     'approved' and these arrive 'pending'. A .select() would come back empty
 *     on a SUCCESSFUL insert and be reported as a failure.
 *
 * That second point is not hypothetical - it is exactly the bug in draft 21's
 * first probe, which counted its own row as anon and read 0 as a refusal. See
 * FF-35.
 *
 * Uses the session-less public client so a submission behaves identically for a
 * signed-out visitor and a signed-in pastor previewing their own site.
 */

/** Generic failure text. A visitor never sees a database message. */
const FAILED = "That did not send. Please try again in a moment.";

/**
 * Honeypot. The prototype carries one (`botcheck`) and it is worth keeping:
 * a field hidden from people and left empty by them, which naive bots fill.
 *
 * A filled honeypot returns SUCCESS rather than an error, deliberately. Telling
 * a bot it was detected invites another attempt with the field left alone.
 */
function isBot(formData: FormData): boolean {
  return String(formData.get("botcheck") ?? "").trim() !== "";
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Empty string -> null, so an untouched optional field is NULL not "". */
function nullable(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

/**
 * Plan a Visit -> public.contacts
 *
 * `type = 'visit'` is what separates these from a general contact-form message
 * in the pastor's inbox. The RLS policy from draft 21 constrains type to the
 * four the application uses, so a crafted post cannot invent a fifth and hide
 * itself from every tab that reads this table.
 */
export async function submitVisit(
  _prev: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  const successMessage = text(formData, "success_message") || "Thank you - we will be in touch.";

  if (isBot(formData)) {
    return { ok: true, error: null, message: successMessage };
  }

  const site = await getCurrentChurchSite();
  if (!site) return { ok: false, error: FAILED, message: null };

  const name = text(formData, "name");
  const contact = text(formData, "contact");

  if (!name || !contact) {
    return {
      ok: false,
      error: "Please add your name and an email or phone number.",
      message: null,
    };
  }

  // One free-text box in the portal beats four columns that do not exist. The
  // seeded form asks which Sunday and what they drive; contacts has no column
  // for either, so they are folded into the message the pastor reads.
  const details = [
    text(formData, "when") ? `Sunday: ${text(formData, "when")}` : null,
    text(formData, "rig") ? `Driving: ${text(formData, "rig")}` : null,
    nullable(formData, "note"),
  ]
    .filter(Boolean)
    .join("\n");

  // An email has an @ and a dot after it; anything else is treated as a phone
  // number. Deliberately loose - a visitor mistyping their own contact details
  // is the pastor's problem to sort out by replying, not ours to reject.
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);

  const { error } = await createPublicClient()
    .from("contacts")
    .insert({
      church_id: site.church.id,
      type: "visit",
      name,
      email: looksLikeEmail ? contact : null,
      phone: looksLikeEmail ? null : contact,
      subject: "Plan a visit",
      message: details || null,
    });

  if (error) {
    console.error(
      `[site] visit submission failed for church ${site.church.slug}: ${error.message}`,
    );
    return { ok: false, error: FAILED, message: null };
  }

  return { ok: true, error: null, message: successMessage };
}

/**
 * Prayer request -> public.prayer_requests
 *
 * `status = 'pending'` is set here AND enforced by the RLS policy from draft 21.
 * The policy is what actually holds: the REST endpoint is public and the anon
 * key ships in every browser, so a direct POST bypasses this function entirely.
 * Before draft 21 that meant anyone could publish straight to the wall by
 * sending status = 'approved' (FF-34).
 *
 * `display_name` is optional. The seed offers anonymity, and a prayer request
 * is exactly the kind of thing someone may not want their name on.
 */
export async function submitPrayer(
  _prev: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  const successMessage =
    text(formData, "success_message") || "Received - someone will pray over this.";

  if (isBot(formData)) {
    return { ok: true, error: null, message: successMessage };
  }

  const site = await getCurrentChurchSite();
  if (!site) return { ok: false, error: FAILED, message: null };

  const body = text(formData, "body");
  if (!body) {
    return { ok: false, error: "Please tell us what to pray for.", message: null };
  }

  const { error } = await createPublicClient().from("prayer_requests").insert({
    church_id: site.church.id,
    body,
    display_name: nullable(formData, "display_name"),
    status: "pending",
  });

  if (error) {
    console.error(
      `[site] prayer submission failed for church ${site.church.slug}: ${error.message}`,
    );
    return { ok: false, error: FAILED, message: null };
  }

  return { ok: true, error: null, message: successMessage };
}
