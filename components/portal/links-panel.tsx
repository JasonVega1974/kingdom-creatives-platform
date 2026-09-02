"use client";

import { useActionState, useState, useTransition } from "react";

import {
  addLink,
  removeLink,
  setLinkPrimary,
  updateLink,
} from "@/app/(portal)/portal/details/links-actions";
import { HelpMark } from "@/components/portal/help-mark";
import {
  AddCard,
  ConfirmRemove,
  Field,
  SaveRow,
  SelectField,
} from "@/components/portal/editor-kit";
import { TEAM_IDLE } from "@/lib/portal/form-state";

/**
 * ============================================================
 * LINKS - giving, video channels, social
 * ============================================================
 *
 * A fourth panel in Church Details rather than a "Giving" tab of its own. The
 * prototype's Giving screen promised a list of gifts, which is a Stripe
 * feature; giving here is Tithe.ly and `gifts` has no data source, so that
 * screen would be permanently empty and read as broken. This edits the one
 * thing that is real: where the links point.
 *
 * Grouped by kind, because the three do different jobs:
 *
 *   giving  - where the Give button sends people
 *   video   - the YouTube channels a sermon can be attributed to
 *   social  - the church's own accounts
 *
 * Only the giving and video kinds have a "use this one" choice. A church has
 * one Give button; it may have several social accounts and show them all.
 *
 * The Giving group also links out to Tithe.ly's own admin dashboard for
 * transaction history and export - researched 2026-09-02: Tithe.ly's API is
 * request-gated and its documented Transactions resource is for creating
 * donations, not reading giving history, so a reports view built against it
 * cannot be promised. Tithe.ly already has one; pointing to it is the honest
 * answer. lib/portal/nav.ts's separate "Giving" tab stub was removed the same
 * day - this panel is where that link now lives.
 */

export type LinkRow = {
  id: string;
  kind: string;
  platform: string;
  label: string;
  url: string;
  externalId: string;
  isPrimary: boolean;
};

const KINDS = [
  {
    value: "giving",
    label: "Giving",
    blurb: "Where your Give button sends people.",
  },
  {
    value: "video",
    label: "Video channels",
    blurb:
      "Your YouTube channels. Sermons can say which one they came from, using the names you give them here.",
  },
  {
    value: "social",
    label: "Social",
    blurb: "Your church's own accounts.",
  },
];

export function LinksPanel({ links }: { links: LinkRow[] }) {
  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <div className="flex items-center gap-2">
        <h2 className="font-[family-name:var(--kc-font-display)] text-xl font-bold">
          Links
        </h2>
        <HelpMark topic="details.links" />
      </div>
      <p className="mt-1 mb-5 text-sm text-[var(--kc-ink-soft)]">
        Where your Give button goes, your video channels, and your social
        accounts.
      </p>

      <div className="space-y-7">
        {KINDS.map((kind) => (
          <LinkGroup
            key={kind.value}
            kind={kind}
            links={links.filter((link) => link.kind === kind.value)}
          />
        ))}
      </div>
    </section>
  );
}

function LinkGroup({
  kind,
  links,
}: {
  kind: (typeof KINDS)[number];
  links: LinkRow[];
}) {
  const showPrimary = kind.value !== "social";

  return (
    <div>
      <h3 className="font-semibold">{kind.label}</h3>
      <p className="mt-1 mb-3 text-sm text-[var(--kc-ink-soft)]">{kind.blurb}</p>

      {kind.value === "giving" ? (
        <p className="mb-3 text-sm text-[var(--kc-ink-soft)]">
          Need your transaction history, or to export gifts?{" "}
          <a
            href="https://app.tithely.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[var(--kc-brand)] underline"
          >
            Open your Tithe.ly dashboard
          </a>{" "}
          - giving reports live there, not here.
        </p>
      ) : null}

      {links.length === 0 ? (
        <p className="mb-3 rounded-[var(--kc-radius)] border border-dashed border-[var(--kc-line)] px-4 py-5 text-center text-sm text-[var(--kc-ink-soft)]">
          {kind.value === "giving"
            ? "No giving link yet - your Give button will not appear until you add one."
            : "Nothing here yet."}
        </p>
      ) : (
        <ul className="mb-3 space-y-3">
          {links.map((link) => (
            <li key={link.id}>
              <LinkCard link={link} showPrimary={showPrimary} />
            </li>
          ))}
        </ul>
      )}

      <AddLink kindValue={kind.value} kindLabel={kind.label} />
    </div>
  );
}

function LinkCard({ link, showPrimary }: { link: LinkRow; showPrimary: boolean }) {
  const [state, action] = useActionState(updateLink, TEAM_IDLE);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {link.label}
            {link.isPrimary && showPrimary ? (
              <span className="ml-2 rounded-full bg-[var(--kc-brand)] px-2 py-0.5 text-[11px] font-semibold text-[var(--kc-brand-contrast)]">
                In use
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-[var(--kc-ink-soft)]">{link.url}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showPrimary && !link.isPrimary ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await setLinkPrimary(link.id);
                })
              }
              className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm disabled:opacity-60"
            >
              Use this one
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : "Edit"}
          </button>

          <ConfirmRemove
            itemName={link.label}
            note={
              link.kind === "video"
                ? `Remove "${link.label}"? Sermons from this channel keep their video - they just stop saying which channel it was.`
                : undefined
            }
            onRemove={() => removeLink(link.id)}
          />
        </div>
      </div>

      {open ? (
        <form action={action} className="mt-4 space-y-3 border-t border-[var(--kc-line)] pt-4">
          <input type="hidden" name="id" value={link.id} />
          <LinkFields kind={link.kind} link={link} />
          <SaveRow label="Save" state={state} />
        </form>
      ) : null}
    </div>
  );
}

function AddLink({ kindValue, kindLabel }: { kindValue: string; kindLabel: string }) {
  const [state, action] = useActionState(addLink, TEAM_IDLE);

  return (
    <AddCard label={`+ Add to ${kindLabel.toLowerCase()}`}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="kind" value={kindValue} />
        <LinkFields kind={kindValue} />
        <SaveRow label="Add" state={state} />
      </form>
    </AddCard>
  );
}

function LinkFields({ kind, link }: { kind: string; link?: LinkRow }) {
  return (
    <>
      <Field
        name="label"
        label="Name"
        defaultValue={link?.label}
        required
        hint={
          kind === "video"
            ? "what you call this channel - Preaching, Bible Studies"
            : undefined
        }
      />
      <Field name="url" label="Web address" defaultValue={link?.url} required />

      {kind === "social" ? (
        <SelectField
          name="platform"
          label="Which service"
          defaultValue={link?.platform ?? "facebook"}
          options={[
            { value: "facebook", label: "Facebook" },
            { value: "instagram", label: "Instagram" },
            { value: "youtube", label: "YouTube" },
            { value: "x", label: "X" },
            { value: "other", label: "Something else" },
          ]}
        />
      ) : (
        <input type="hidden" name="platform" value={link?.platform ?? kind} />
      )}

      {kind === "video" ? (
        <Field
          name="external_id"
          label="Channel ID"
          defaultValue={link?.externalId}
          hint="optional - used later by the automatic sermon import"
        />
      ) : null}
    </>
  );
}
