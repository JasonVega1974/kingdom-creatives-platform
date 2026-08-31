"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { submitPrayer, submitVisit } from "@/app/(public)/actions";
import { PUBLIC_FORM_IDLE, type PublicFormState } from "@/lib/site/form-state";

/**
 * ============================================================
 * PUBLIC FORMS - Plan a Visit, and a prayer request
 * ============================================================
 *
 * Both post to Server Actions in app/(public)/actions.ts, which write to
 * `contacts` and `prayer_requests`. NOT to Web3Forms - see the banner at the
 * top of prototypes/cft-site-orange.html for why the prototype's version is not
 * the spec.
 *
 * Markup and class names are the prototype's (.formcard, .field); styling lives
 * in app/(public)/site.css.
 *
 * Every label, placeholder and option comes from the seeded section content, so
 * a pastor can reword the whole form in the portal. Nothing here is a hardcoded
 * string a church cannot change.
 *
 * The success message rides along in a hidden field rather than being fetched
 * again in the action: it is seeded content the page already has. It is
 * display-only - the action never trusts it for anything but what to echo back.
 */

/** Hidden from people, tempting to naive bots. Never remove without replacing. */
function Honeypot() {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}
    >
      <label htmlFor="botcheck">Leave this blank</label>
      <input id="botcheck" name="botcheck" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

function SubmitRow({
  label,
  state,
  full,
}: {
  label: string;
  state: PublicFormState;
  full?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <div style={{ marginTop: "8px" }}>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-gold"
        style={full ? { width: "100%" } : undefined}
      >
        {pending ? "Sending..." : label}
      </button>

      {!pending && state.error ? (
        <p role="alert" className="hint" style={{ color: "#B3261E" }}>
          {state.error}
        </p>
      ) : null}
      {!pending && state.ok && state.message ? (
        <p role="status" className="hint">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function VisitForm({
  content,
  whenOptions,
  rigOptions,
}: {
  content: Record<string, string>;
  /**
   * Passed in rather than read from `content`: the seed stores these as JSON
   * arrays and sectionContent() keeps only scalars, so they never survive the
   * flattening. The server renderer reads them with strings() instead.
   */
  whenOptions: string[];
  rigOptions: string[];
}) {
  const [state, action] = useActionState(submitVisit, PUBLIC_FORM_IDLE);

  // React 19 resets an uncontrolled form after the action resolves, which is
  // what we want: the next visitor at the same truck stop should not find the
  // last one's details still in the fields.
  return (
    <div className="formcard">
      {content.title ? <h3>{content.title}</h3> : null}
      {content.sub ? <p className="sub">{content.sub}</p> : null}

      <form action={action} style={{ position: "relative" }}>
        <Honeypot />
        <input type="hidden" name="success_message" value={content.success ?? ""} />

        <Field
          name="name"
          label={content.name_label ?? "Your name"}
          placeholder={content.name_placeholder}
          required
        />
        <Field
          name="contact"
          label={content.contact_label ?? "Email or phone"}
          placeholder={content.contact_placeholder}
          required
        />

        {whenOptions.length > 0 ? (
          <Select
            name="when"
            label={content.when_label ?? "Which Sunday?"}
            options={whenOptions}
          />
        ) : null}
        {rigOptions.length > 0 ? (
          <Select
            name="rig"
            label={content.rig_label ?? "Bringing a rig?"}
            options={rigOptions}
          />
        ) : null}

        <div className="field">
          <label htmlFor="note">{content.note_label ?? "Anything we should know?"}</label>
          <textarea id="note" name="note" rows={3} placeholder={content.note_placeholder} />
        </div>

        <SubmitRow label={content.submit_label ?? "Send"} state={state} full />

        {content.hint ? <p className="hint">{content.hint}</p> : null}
      </form>
    </div>
  );
}

/**
 * The prayer form, inside a <details> disclosure.
 *
 * The prototype collects this with browser prompt() dialogs. Those block the
 * page, cannot be styled, and are unusable with a screen reader. A <details>
 * needs no JavaScript, is keyboard accessible, and keeps the wall readable
 * while the form is closed - which matters more here than anywhere, since the
 * list above it is the point of the section.
 */
export function PrayerForm({ content }: { content: Record<string, string> }) {
  const [state, action] = useActionState(submitPrayer, PUBLIC_FORM_IDLE);

  return (
    <details style={{ marginTop: "14px" }}>
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          fontWeight: 600,
          color: "var(--kc-brand)",
        }}
      >
        {content.prayer_cta ?? "Add a request"}
      </summary>

      <form action={action} style={{ position: "relative", marginTop: "14px" }}>
        <Honeypot />
        <input type="hidden" name="success_message" value={content.prayer_success ?? ""} />

        <Field
          name="display_name"
          label="Your first name"
          placeholder="or leave blank to stay anonymous"
        />

        <div className="field">
          <label htmlFor="body">What would you like prayer for?</label>
          <textarea id="body" name="body" rows={4} required />
        </div>

        <SubmitRow label="Send request" state={state} />
      </form>
    </details>
  );
}

// ---------------------------------------------------------------

function Field({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type="text"
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: string[];
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue="">
        <option value="">No preference</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
