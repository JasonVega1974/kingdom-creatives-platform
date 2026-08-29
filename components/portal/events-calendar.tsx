import Link from "next/link";

import type { EventRow } from "@/components/portal/events-editor";

/**
 * ============================================================
 * EVENTS - MONTH VIEW
 * ============================================================
 *
 * The prototype had this as its own "Calendar" sidebar tab. It is a VIEW of the
 * same events table, with the same rows and the same actions available on
 * them, so it is a toggle on the Events tab instead - decided 2026-08-28.
 *
 * Two places showing the same data is two places to look and two things to keep
 * consistent, and the sidebar is already twenty items. That diverges from the
 * prototype's sidebar deliberately, which is recorded rather than done quietly.
 *
 * A Server Component with no state: the month comes from `?month=YYYY-MM` and
 * the arrows are links. Same reasoning as the public filters - shareable,
 * survives a reload, works without JavaScript.
 *
 * DATES ARE READ IN UTC, matching how they are stored and shown everywhere else
 * (FF-38). Using the reader's zone here would land an event on the wrong day
 * for anyone east or west of the server.
 */

const DAY_HEADS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function EventsCalendar({
  events,
  month,
}: {
  events: EventRow[];
  /** First day of the displayed month, UTC. */
  month: Date;
}) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();

  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  // Events that fall in this month, keyed by day-of-month. An event with no
  // parseable date is dropped rather than landed on day 1.
  const byDay = new Map<number, EventRow[]>();
  for (const event of events) {
    if (!event.startsAt) continue;
    const date = new Date(`${event.startsAt}Z`);
    if (Number.isNaN(date.getTime())) continue;
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex) continue;

    const day = date.getUTCDate();
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <MonthLink month={monthIndex - 1} year={year}>
          Previous
        </MonthLink>
        <h2 className="font-[family-name:var(--kc-font-display)] text-xl font-semibold">
          {month.toLocaleDateString("en-US", {
            timeZone: "UTC",
            month: "long",
            year: "numeric",
          })}
        </h2>
        <MonthLink month={monthIndex + 1} year={year}>
          Next
        </MonthLink>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DAY_HEADS.map((day) => (
          <div
            key={day}
            className="py-1.5 text-center font-utility text-[10px] uppercase tracking-[0.12em] text-[var(--kc-ink-soft)]"
          >
            {day}
          </div>
        ))}

        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`pad-${index}`} aria-hidden="true" />;
          }

          const dayEvents = byDay.get(day) ?? [];

          return (
            <div
              key={day}
              className={
                dayEvents.length > 0
                  ? "min-h-[86px] rounded-[var(--kc-radius)] border border-[var(--kc-brand)] bg-[var(--kc-brand-wash)] p-1.5"
                  : "min-h-[86px] rounded-[var(--kc-radius)] border border-[var(--kc-line)] p-1.5"
              }
            >
              <span className="text-xs text-[var(--kc-ink-soft)]">{day}</span>

              <ul className="mt-1 space-y-1">
                {dayEvents.map((event) => (
                  <li
                    key={event.id}
                    title={event.title}
                    className={
                      event.published
                        ? "truncate rounded bg-[var(--kc-brand)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--kc-brand-contrast)]"
                        : "truncate rounded border border-dashed border-[var(--kc-line)] px-1.5 py-0.5 text-[10px] text-[var(--kc-ink-soft)]"
                    }
                  >
                    {event.title}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-[var(--kc-ink-soft)]">
        Solid means it is on your website. Outlined means it is not switched on
        yet. Switch to the list to change anything.
      </p>
    </div>
  );
}

/**
 * Month stepper.
 *
 * Date.UTC normalises an out-of-range month, so December + 1 becomes January of
 * the next year without any wrapping arithmetic here.
 */
function MonthLink({
  month,
  year,
  children,
}: {
  month: number;
  year: number;
  children: React.ReactNode;
}) {
  const target = new Date(Date.UTC(year, month, 1));
  const value = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <Link
      href={`?view=month&month=${value}`}
      className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
    >
      {children}
    </Link>
  );
}
