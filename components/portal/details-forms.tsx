"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  saveBranding,
  saveIdentity,
  saveServiceTimes,
} from "@/app/(portal)/portal/details/actions";
import { DETAILS_IDLE, type DetailsState } from "@/lib/portal/form-state";
import { HelpMark } from "@/components/portal/help-mark";
import { MediaPicker, type LibraryItem } from "@/components/portal/media-picker";
import type { ServiceTime } from "@/lib/church";

const FIELD =
  "w-full rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] px-3 py-2 outline-none focus:border-[var(--kc-brand)]";

function Card({
  title,
  hint,
  helpTopic,
  children,
}: {
  title: string;
  hint: string;
  /** Optional "?" beside the title, opening a help registry topic. */
  helpTopic?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <div className="flex items-center gap-2">
        <h2 className="font-[family-name:var(--kc-font-display)] text-xl font-bold">
          {title}
        </h2>
        {helpTopic ? <HelpMark topic={helpTopic} /> : null}
      </div>
      <p className="mt-1 mb-5 text-sm text-[var(--kc-ink-soft)]">{hint}</p>
      {children}
    </section>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  hint,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal text-[var(--kc-ink-soft)]">({hint})</span>}
      </label>
      <input id={name} name={name} type={type} defaultValue={defaultValue} className={FIELD} />
    </div>
  );
}

function SaveRow({ state }: { state: DetailsState }) {
  const { pending } = useFormStatus();

  return (
    <div className="mt-5 flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--kc-radius)] bg-[var(--kc-brand)] px-4 py-2 font-semibold text-[var(--kc-brand-contrast)] disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>

      {!pending && state.error && (
        <span role="alert" className="text-sm text-red-700">
          {state.error}
        </span>
      )}
      {!pending && state.ok && !state.error && (
        <span role="status" className="text-sm text-[var(--kc-ink-soft)]">
          Saved and live on the website
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------

export function IdentityForm({
  name,
  tagline,
  address,
  phone,
  email,
}: {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
}) {
  const [state, action] = useActionState(saveIdentity, DETAILS_IDLE);

  return (
    <Card
      title="Church details"
      helpTopic="details.identity"
      hint="Your name, and how people reach you. This appears in your header, your footer and on your contact page."
    >
      <form action={action} className="space-y-4">
        <Field name="name" label="Church name" defaultValue={name} />
        <Field
          name="tagline"
          label="Tagline"
          defaultValue={tagline}
          hint="the short line under your name"
        />
        <Field name="address" label="Address" defaultValue={address} />
        <Field name="phone" label="Phone number" defaultValue={phone} type="tel" />
        <Field name="email" label="Email address" defaultValue={email} type="email" />
        <SaveRow state={state} />
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------

type Row = { key: number; day: string; time: string; label: string; streaming: boolean };

let nextKey = 0;

export function ServiceTimesForm({ services }: { services: ServiceTime[] }) {
  const [state, action] = useActionState(saveServiceTimes, DETAILS_IDLE);
  const [rows, setRows] = useState<Row[]>(() =>
    services.length
      ? services.map((s) => ({
          key: (nextKey += 1),
          day: s.day ?? "",
          time: s.time ?? "",
          label: s.label ?? "",
          streaming: s.streaming === true,
        }))
      : [{ key: (nextKey += 1), day: "", time: "", label: "", streaming: false }],
  );

  return (
    <Card
      title="Service times"
      helpTopic="details.services"
      hint="When you meet. Add a row for each service - Sunday worship, midweek study, anything with a time."
    >
      <form action={action}>
        <ol className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="grid gap-2 rounded-[var(--kc-radius)] border border-[var(--kc-line)] p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]"
            >
              <input
                name="service_day"
                defaultValue={row.day}
                aria-label={`Day for service ${index + 1}`}
                placeholder="Sunday"
                className={FIELD}
              />
              <input
                name="service_time"
                defaultValue={row.time}
                aria-label={`Time for service ${index + 1}`}
                placeholder="10:00 AM"
                className={FIELD}
              />
              <input
                name="service_label"
                defaultValue={row.label}
                aria-label={`Name for service ${index + 1}`}
                placeholder="Sunday Worship"
                className={FIELD}
              />

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                  {/* Posts its ROW INDEX, not "on". An unchecked box posts
                      nothing at all, so a positional array would shift every
                      later row's flag by one; a set of checked indexes cannot. */}
                  <input
                    type="checkbox"
                    name="service_streaming"
                    value={String(index)}
                    defaultChecked={row.streaming}
                    className="h-4 w-4 accent-[var(--kc-brand)]"
                  />
                  Streamed
                </label>

                <button
                  type="button"
                  onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                  className="text-sm text-[var(--kc-ink-soft)] underline-offset-4 hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() =>
            setRows((r) => [
              ...r,
              { key: (nextKey += 1), day: "", time: "", label: "", streaming: false },
            ])
          }
          className="mt-3 rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm hover:bg-[var(--kc-paper-dim)]"
        >
          Add another service
        </button>

        <SaveRow state={state} />
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------

export function BrandingForm({
  primary,
  secondary,
  accent,
  logoUrl,
  logoMediaId,
  library,
}: {
  primary: string;
  secondary: string;
  accent: string;
  logoUrl: string;
  logoMediaId: string | null;
  library: LibraryItem[];
}) {
  const [state, action] = useActionState(saveBranding, DETAILS_IDLE);

  return (
    <Card
      title="Colours and logo"
      helpTopic="details.branding"
      hint="Your brand. These colours are used across every page of your website."
    >
      <form action={action} className="space-y-4">
        <ColorField name="color_primary" label="Main colour" defaultValue={primary} />
        <ColorField name="color_secondary" label="Second colour" defaultValue={secondary} />
        <ColorField
          name="color_accent"
          label="Text on your main colour"
          defaultValue={accent}
        />
        <MediaPicker
          name="logo_media_id"
          label="Logo"
          library={library}
          value={logoMediaId}
          fallbackUrl={logoUrl}
        />
        <SaveRow state={state} />
      </form>
    </Card>
  );
}

function ColorField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  // The two inputs share one name, so the last one in the DOM is what posts.
  // The text box is last on purpose: someone who types a hex code should not
  // have it overridden by a swatch they never touched.
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`${label} colour picker`}
          className="h-10 w-14 shrink-0 rounded border border-[var(--kc-line)] bg-[var(--kc-surface)] p-1"
        />
        <input
          id={name}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          className={FIELD}
        />
      </div>
    </div>
  );
}
