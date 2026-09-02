"use client";

import { useActionState, useState, useTransition } from "react";

import {
  approvePrayer,
  archivePrayer,
  keepPrayerPrivate,
  removePrayer,
  unapprovePrayer,
} from "@/app/(portal)/portal/prayer/actions";
import { ConfirmRemove, EmptyList, Field, SaveRow } from "@/components/portal/editor-kit";
import { HelpMark } from "@/components/portal/help-mark";
import type { PrayerStatus, TeamState } from "@/lib/portal/form-state";
import { TEAM_IDLE } from "@/lib/portal/form-state";

/**
 * ============================================================
 * PRAYER WALL - moderation
 * ============================================================
 *
 * Four lists, one per status, because the pastor's question differs in each.
 *
 *   Needs your eye  what do I do with this?       open, at the top
 *   On the wall     is this still right to show?  open
 *   Private         prayed over, not published    collapsed
 *   Archived        dealt with                    collapsed
 *
 * The two collapsed lists are deliberately still present. A request that
 * disappeared entirely once handled would make the tab look like it had lost
 * something, and "where did that one go" is the question this design is trying
 * never to provoke.
 *
 * "Not this one" is archive, not delete. Deleting is available underneath but
 * is never the default - a prayer request is somebody's difficult week, and the
 * cheap action should not be the irreversible one.
 */

export type PrayerRow = {
  id: string;
  body: string;
  displayName: string;
  status: PrayerStatus;
  prayedCount: number;
  createdAt: string | null;
};

export function PrayerModerator({ requests }: { requests: PrayerRow[] }) {
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");
  const kept = requests.filter((r) => r.status === "private");
  const archived = requests.filter((r) => r.status === "archived");

  return (
    <div className="space-y-10">
      <section>
        <Heading count={pending.length} help="prayer.flow">Needs your eye</Heading>
        {pending.length === 0 ? (
          <EmptyList>
            Nothing waiting. New requests from your website land here first.
          </EmptyList>
        ) : (
          <div className="space-y-5">
            {pending.map((item) => (
              <PendingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section>
        <Heading count={approved.length} help="prayer.private">On your prayer wall</Heading>
        {approved.length === 0 ? (
          <EmptyList>
            Nothing on the wall yet. Approve a request above and it appears on
            your website straight away.
          </EmptyList>
        ) : (
          <div className="space-y-5">
            {approved.map((item) => (
              <PublishedCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <Collapsed
        title="Private"
        note="Prayed over, never published. Only you see these."
        items={kept}
      />
      <Collapsed
        title="Archived"
        note="Dealt with and kept for the record."
        items={archived}
      />
    </div>
  );
}

/**
 * A waiting request: the whole decision in one card.
 *
 * The name is an editable field rather than static text because approving is
 * the moment that judgement gets made. "Dave M, Peterbilt 379" is a fine thing
 * to send a pastor and not necessarily a thing to put on a public wall, and
 * fixing it afterwards means it was public in between.
 */
function PendingCard({ item }: { item: PrayerRow }) {
  const [state, action] = useActionState(approvePrayer, TEAM_IDLE);

  return (
    <article className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <Body item={item} />

      <form action={action} className="mt-5 space-y-4 border-t border-[var(--kc-line)] pt-5">
        <input type="hidden" name="id" value={item.id} />
        <Field
          name="display_name"
          label="Show this name on the wall"
          defaultValue={item.displayName}
          hint="leave blank to post it anonymously"
        />
        <SaveRow label="Put it on the wall" state={state} />
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--kc-line)] pt-4">
        <ActionButton label="Keep private" run={() => keepPrayerPrivate(item.id)} />
        <ActionButton label="Not this one" run={() => archivePrayer(item.id)} />
        <ConfirmRemove
          itemName="this prayer request"
          note="This deletes it for good. Archiving keeps it without publishing it."
          onRemove={() => removePrayer(item.id)}
        />
      </div>
    </article>
  );
}

/** Already on the wall - the only question left is whether it stays. */
function PublishedCard({ item }: { item: PrayerRow }) {
  const prayed =
    item.prayedCount === 1
      ? "1 person has prayed for this"
      : `${item.prayedCount} people have prayed for this`;

  return (
    <article className="rounded-[var(--kc-radius)] border border-[var(--kc-brand)] bg-[var(--kc-brand-wash)] p-5">
      <Body item={item} />

      <p className="mt-2 text-xs text-[var(--kc-ink-soft)]">
        Shown as {item.displayName || "Anonymous"}
        {item.prayedCount > 0 ? ` - ${prayed}` : ""}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ActionButton label="Take it down" run={() => unapprovePrayer(item.id)} />
        <ActionButton label="Keep private" run={() => keepPrayerPrivate(item.id)} />
        <ActionButton label="Archive" run={() => archivePrayer(item.id)} />
      </div>
    </article>
  );
}

/** Private and Archived: folded away, one click from being reconsidered. */
function Collapsed({
  title,
  note,
  items,
}: {
  title: string;
  note: string;
  items: PrayerRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="font-[family-name:var(--kc-font-display)] text-xl font-bold"
      >
        {title} ({items.length}) {open ? "-" : "+"}
      </button>
      <p className="mt-1 text-sm text-[var(--kc-ink-soft)]">{note}</p>

      {open ? (
        items.length === 0 ? (
          <div className="mt-4">
            <EmptyList>Nothing here.</EmptyList>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] p-5"
              >
                <Body item={item} />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ActionButton
                    label="Move back to unread"
                    run={() => unapprovePrayer(item.id)}
                  />
                  <ConfirmRemove
                    itemName="this prayer request"
                    note="This deletes it for good."
                    onRemove={() => removePrayer(item.id)}
                  />
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}

function Body({ item }: { item: PrayerRow }) {
  return (
    <>
      <p className="whitespace-pre-line">{item.body}</p>
      <p className="mt-2 text-xs text-[var(--kc-ink-soft)]">
        {item.displayName ? item.displayName : "No name given"} - {formatWhen(item.createdAt)}
      </p>
    </>
  );
}

function Heading({
  count,
  help,
  children,
}: {
  count: number;
  /** Optional "?" beside the heading, opening a help registry topic. */
  help?: string;
  children: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="font-[family-name:var(--kc-font-display)] text-xl font-bold">
        {children} ({count})
      </h2>
      {help ? <HelpMark topic={help} /> : null}
    </div>
  );
}

/**
 * A button that runs one action and shows why it failed.
 *
 * Surfacing the error is the point. judgeWrite() distinguishes a transport blip
 * from an RLS refusal, and a moderation button that swallowed that would put a
 * pastor back in exactly the position FF-47 describes - believing a request was
 * published when it was not.
 */
function ActionButton({ label, run }: { label: string; run: () => Promise<TeamState> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await run();
            setError(result.ok ? null : result.error);
          })
        }
        className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm disabled:opacity-60"
      >
        {pending ? "Working..." : label}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** UTC, matching how every other date in the portal is read (FF-38). */
function formatWhen(value: string | null): string {
  if (!value) return "date unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date unknown";
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
