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
 * `contacts` and `prayer_requests`. Not to Web3Forms - see the banner at the
 * top of prototypes/cft-site-orange.html for why the prototype's version is
 * not the spec.
 *
 * Every label, placeholder and option comes from the seeded section content, so
 * a pastor can reword the whole form in the portal. Nothing here is a
 * hardcoded string a church cannot change.
 *
 * The success message rides along in a hidden field rather than being fetched
 * again in the action: it is seeded content the page already has, and passing
 * it avoids a second query per submission. It is display-only text - the action
 * never trusts it for anything but what to echo back.
 */

const FIELD =
  "w-full rounded-[var(--kc-radius)] border border-line bg-surface px-3 py-2 outline-none focus:border-brand";

/** Hidden from people, tempting to naive bots. Never remove without replacing. */
function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
      <label htmlFor="botcheck">Leave this blank</label>
      <input id="botcheck" name="botcheck" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

function SubmitRow({ label, state }: { label: string; state: PublicFormState }) {
  const { pending } = useFormStatus();

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--kc-radius)] bg-brand px-5 py-2.5 font-semibold text-brand-contrast disabled:opacity-60"
      >
        {pending ? "Sending..." : label}
      </button>

      {!pending && state.error ? (
        <span role="alert" className="text-sm text-red-700">
          {state.error}
        </span>
      ) : null}
      {!pending && state.ok && state.message ? (
        <span role="status" className="text-sm text-ink-soft">
          {state.message}
        </span>
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

  // A submitted form keeps its confirmation and clears its boxes. React 19
  // resets an uncontrolled form after the action resolves, which is what we
  // want here - the next visitor at the same truck stop should not find the
  // last one's details still in the fields.
  return (
    <form action={action} className="relative space-y-4">
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
        <Select name="when" label={content.when_label ?? "Which Sunday?"} options={whenOptions} />
      ) : null}
      {rigOptions.length > 0 ? (
        <Select name="rig" label={content.rig_label ?? "What are you driving?"} options={rigOptions} />
      ) : null}

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium">
          {content.note_label ?? "Anything we should know?"}
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          placeholder={content.note_placeholder}
          className={FIELD}
        />
      </div>

      <SubmitRow label={content.submit_label ?? "Send"} state={state} />

      {content.hint ? <p className="text-sm text-ink-soft">{content.hint}</p> : null}
    </form>
  );
}

/**
 * The prayer form, inside a <details> disclosure.
 *
 * The prototype collects this with browser prompt() dialogs. Those block the
 * page, cannot be styled, and are unusable with a screen reader. A <details>
 * needs no JavaScript, is keyboard accessible, and keeps the wall itself
 * readable while the form is closed - which matters more here than anywhere,
 * since the list above it is the point of the section.
 */
export function PrayerForm({ content }: { content: Record<string, string> }) {
  const [state, action] = useActionState(submitPrayer, PUBLIC_FORM_IDLE);

  return (
    <details className="mt-5 rounded-[var(--kc-radius)] border border-line bg-surface p-4">
      <summary className="cursor-pointer list-none font-semibold text-brand marker:hidden">
        {content.prayer_cta ?? "Add a request"}
      </summary>

      <form action={action} className="relative mt-4 space-y-4">
        <Honeypot />
        <input type="hidden" name="success_message" value={content.prayer_success ?? ""} />

        <Field
          name="display_name"
          label="Your first name"
          placeholder="or leave blank to stay anonymous"
        />

        <div>
          <label htmlFor="body" className="mb-1 block text-sm font-medium">
            What would you like prayer for?
          </label>
          <textarea id="body" name="body" rows={4} required className={FIELD} />
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
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        placeholder={placeholder}
        required={required}
        className={FIELD}
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
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <select id={name} name={name} className={FIELD} defaultValue="">
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
