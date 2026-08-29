"use client";

import { useActionState, useState } from "react";

import {
  addMinistry,
  moveMinistry,
  removeMinistry,
  setMinistryVisible,
  updateMinistry,
} from "@/app/(portal)/portal/ministries/actions";
import {
  AddCard,
  ConfirmRemove,
  EmptyList,
  Field,
  MoveButtons,
  SaveRow,
  TextArea,
  VisibleCheckbox,
} from "@/components/portal/editor-kit";
import { TEAM_IDLE } from "@/lib/portal/form-state";

/**
 * ============================================================
 * MINISTRIES
 * ============================================================
 *
 * The list under "Ministries we support" on /about.
 *
 * Structurally Groups again. The difference worth naming is that a ministry is
 * usually somebody else's organisation the church partners with - so the link
 * points off-site and there is no meeting time.
 */

export type MinistryRow = {
  id: string;
  name: string;
  description: string;
  websiteUrl: string;
  logoUrl: string;
  visible: boolean;
};

export function MinistriesEditor({ items }: { items: MinistryRow[] }) {
  return (
    <div className="space-y-5">
      <AddMinistry />

      {items.length === 0 ? (
        <EmptyList>
          No ministries listed yet. Add your first one above - it stays off your
          website until you switch it on.
        </EmptyList>
      ) : (
        items.map((item, index) => (
          <MinistryCard
            key={item.id}
            item={item}
            isFirst={index === 0}
            isLast={index === items.length - 1}
          />
        ))
      )}
    </div>
  );
}

function AddMinistry() {
  const [state, action] = useActionState(addMinistry, TEAM_IDLE);

  return (
    <AddCard label="+ Add a ministry">
      <form action={action} className="space-y-4">
        <MinistryFields />
        <p className="text-sm text-[var(--kc-ink-soft)]">
          New ministries stay off your website until you switch them on.
        </p>
        <SaveRow label="Add" state={state} />
      </form>
    </AddCard>
  );
}

function MinistryCard({
  item,
  isFirst,
  isLast,
}: {
  item: MinistryRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, action] = useActionState(updateMinistry, TEAM_IDLE);
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{item.name}</h2>
          {item.description ? (
            <p className="text-sm text-[var(--kc-ink-soft)]">{item.description}</p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--kc-ink-soft)]">
            {item.visible ? "On your About page" : "Not on your About page yet"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <MoveButtons
            isFirst={isFirst}
            isLast={isLast}
            onMove={(direction) => moveMinistry(item.id, direction)}
          />
          <VisibleCheckbox
            itemName={item.name}
            visible={item.visible}
            onToggle={(next) => setMinistryVisible(item.id, next)}
          />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : "Edit"}
          </button>
          <ConfirmRemove
            itemName={item.name}
            onRemove={() => removeMinistry(item.id)}
          />
        </div>
      </div>

      {open ? (
        <form action={action} className="mt-5 space-y-4 border-t border-[var(--kc-line)] pt-5">
          <input type="hidden" name="id" value={item.id} />
          <MinistryFields item={item} />
          <SaveRow label="Save" state={state} />
        </form>
      ) : null}
    </section>
  );
}

function MinistryFields({ item }: { item?: MinistryRow }) {
  return (
    <>
      <Field name="name" label="Name" defaultValue={item?.name} required />
      <TextArea
        name="description"
        label="What they do"
        defaultValue={item?.description}
      />
      <Field
        name="website_url"
        label="Their website"
        defaultValue={item?.websiteUrl}
        hint="opens in a new tab for visitors"
      />
      <Field
        name="logo_url"
        label="Their logo"
        defaultValue={item?.logoUrl}
        hint="a link from their own site - not the Photos tab"
      />
    </>
  );
}
