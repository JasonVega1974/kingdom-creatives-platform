"use client";

import { useActionState, useState } from "react";

import {
  addAnnouncement,
  moveAnnouncement,
  removeAnnouncement,
  setAnnouncementVisible,
  updateAnnouncement,
} from "@/app/(portal)/portal/announcements/actions";
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
 * ANNOUNCEMENTS
 * ============================================================
 *
 * The left-hand column of the home page bulletin board.
 *
 * The expiry date is the point of this tab. A bulletin fills up with notices
 * that were true last month and nobody enjoys tidying, so an announcement can
 * be given an end date when it is written and then forgotten about - which is
 * the only way tidying ever actually happens. The public read already drops
 * anything past its date.
 *
 * An expired announcement stays in this list, marked, rather than vanishing.
 * A pastor looking for "the one about the coat drive" should find it.
 */

export type AnnouncementRow = {
  id: string;
  body: string;
  expiresAt: string;
  visible: boolean;
};

export function AnnouncementsEditor({ items }: { items: AnnouncementRow[] }) {
  return (
    <div className="space-y-5">
      <AddAnnouncement />

      {items.length === 0 ? (
        <EmptyList>
          Nothing posted yet. Add your first announcement above - it stays off
          your website until you switch it on.
        </EmptyList>
      ) : (
        items.map((item, index) => (
          <AnnouncementCard
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

function AddAnnouncement() {
  const [state, action] = useActionState(addAnnouncement, TEAM_IDLE);

  return (
    <AddCard label="+ Add an announcement">
      <form action={action} className="space-y-4">
        <TextArea name="body" label="What do you want to say?" rows={4} />
        <Field
          name="expires_at"
          label="Take it down on"
          type="date"
          hint="leave blank to keep it until you remove it"
        />
        <p className="text-sm text-[var(--kc-ink-soft)]">
          New announcements stay off your website until you switch them on.
        </p>
        <SaveRow label="Add" state={state} />
      </form>
    </AddCard>
  );
}

function AnnouncementCard({
  item,
  isFirst,
  isLast,
}: {
  item: AnnouncementRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, action] = useActionState(updateAnnouncement, TEAM_IDLE);
  const [open, setOpen] = useState(false);

  const expired = isExpired(item.expiresAt);

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-line">{item.body}</p>

          <p className="mt-2 text-xs text-[var(--kc-ink-soft)]">
            {expired
              ? `Came down on ${formatDate(item.expiresAt)} - no longer on your website`
              : item.expiresAt
                ? `Comes down on ${formatDate(item.expiresAt)}`
                : item.visible
                  ? "On your website"
                  : "Not on your website yet"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <MoveButtons
            isFirst={isFirst}
            isLast={isLast}
            onMove={(direction) => moveAnnouncement(item.id, direction)}
          />
          <VisibleCheckbox
            itemName="this announcement"
            visible={item.visible}
            onToggle={(next) => setAnnouncementVisible(item.id, next)}
          />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : "Edit"}
          </button>
          <ConfirmRemove
            itemName="this announcement"
            onRemove={() => removeAnnouncement(item.id)}
          />
        </div>
      </div>

      {open ? (
        <form action={action} className="mt-5 space-y-4 border-t border-[var(--kc-line)] pt-5">
          <input type="hidden" name="id" value={item.id} />
          <TextArea
            name="body"
            label="What do you want to say?"
            defaultValue={item.body}
            rows={4}
          />
          <Field
            name="expires_at"
            label="Take it down on"
            type="date"
            defaultValue={item.expiresAt}
            hint="leave blank to keep it until you remove it"
          />
          <SaveRow label="Save" state={state} />
        </form>
      ) : null}
    </section>
  );
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Whether the public read has already dropped this one. */
function isExpired(expiresAt: string): boolean {
  if (!expiresAt) return false;
  const date = new Date(`${expiresAt}T23:59:59Z`);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}
