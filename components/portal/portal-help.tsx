"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { WelcomeTour } from "@/components/portal/welcome-tour";
import {
  HELP_TOPICS,
  searchTopics,
  topicsForTab,
  type HelpTopic,
} from "@/lib/portal/help-content";

/**
 * ============================================================
 * PORTAL HELP - the trigger, the callout, and the panel
 * ============================================================
 *
 * One client component owns all the help state, rendered inline in the
 * topbar between the signed-in line and "View my website": the "?" trigger,
 * the first-visit callout that offers the tour, the search-and-browse panel,
 * and the running tour. HelpMark is deliberately NOT part of this tree -
 * marks are self-contained so tabs can use them with a single import.
 *
 * POSITION: in the header, not floating. The first build floated it
 * bottom-left, where it sat on top of the sidebar and covered the Events
 * item - a help button that hides a nav item is a joke at its own expense.
 *
 * The callout and panel hang below the header, aligned to the viewport's
 * RIGHT edge rather than to the trigger. Anchoring to the trigger fails on
 * a phone: at 375px the "?" sits mid-bar (View my website and Sign out
 * follow it), and a 280px card right-aligned to it would run off the left
 * edge of the screen - measured, not guessed. So the top comes from the
 * trigger's measured rect (tracking scroll and resize, the same way the
 * tour tracks its targets) and the right edge comes from the viewport,
 * which is on-screen by construction at every width.
 *
 * FIRST VISIT: localStorage only ("kc-help-intro-seen"). Per-device, so a
 * pastor on a new phone sees the offer once more - acceptable, arguably
 * right. No schema, no account state (ground rule 0.3 untouched). The flag
 * is read after mount, never during render, so the server and first client
 * render agree (no hydration mismatch) and the callout simply appears a
 * frame later on a first visit.
 *
 * The gentle bounce that draws the eye to the trigger exists only while the
 * callout is showing, and only for people who have not asked the OS for
 * reduced motion - the keyframes in globals.css are wrapped in a
 * prefers-reduced-motion guard, so for everyone else the trigger simply
 * sits still.
 */

const INTRO_KEY = "kc-help-intro-seen";

export function PortalHelp() {
  const pathname = usePathname();
  const [panelOpen, setPanelOpen] = useState(false);
  const [tourRunning, setTourRunning] = useState(false);
  const [showCallout, setShowCallout] = useState(false);
  const [dropTop, setDropTop] = useState<number | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  /* Where the callout/panel start vertically: just under the trigger,
     re-measured on scroll and resize while either is showing. */
  useEffect(() => {
    if (!panelOpen && !showCallout) return;

    function update() {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) setDropTop(Math.round(rect.bottom + 8));
    }

    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [panelOpen, showCallout]);

  useEffect(() => {
    // Deferred a tick so the first client render matches the server render
    // (no callout), then the offer appears - see the header comment.
    const timer = setTimeout(() => {
      try {
        if (!localStorage.getItem(INTRO_KEY)) setShowCallout(true);
      } catch {
        /* Storage blocked (private mode etc.) - skip the callout, keep the trigger. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  /* Close the panel on Esc or a press outside the whole help unit. The ref
     sits on the wrapper - trigger included - so clicking the trigger while
     the panel is open reaches its own toggle instead of being treated as
     "outside" and closed-then-reopened in the same gesture. */
  useEffect(() => {
    if (!panelOpen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPanelOpen(false);
    }
    function onDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setPanelOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [panelOpen]);

  function markIntroSeen() {
    setShowCallout(false);
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* If storage is blocked the callout returns next session. Harmless. */
    }
  }

  function startTour() {
    markIntroSeen();
    setPanelOpen(false);
    setTourRunning(true);
  }

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        data-tour="help-bubble"
        aria-label="Help and tutorial"
        aria-expanded={panelOpen}
        onClick={() => {
          markIntroSeen();
          setPanelOpen((value) => !value);
        }}
        className={
          "flex h-8 w-8 items-center justify-center rounded-full border border-[var(--kc-line)] text-sm font-bold text-[var(--kc-brand-deep)] hover:border-[var(--kc-brand)] hover:bg-[var(--kc-brand-wash)]" +
          (showCallout ? " kc-help-bounce" : "")
        }
      >
        ?
      </button>

      {showCallout && !tourRunning ? (
        <div
          role="dialog"
          aria-label="Welcome offer"
          style={{ top: dropTop ?? 64 }}
          className="fixed right-4 z-50 w-[min(280px,calc(100vw-32px))] rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-4 shadow-xl"
        >
          <p className="font-semibold">New here?</p>
          <p className="mt-1 text-sm text-[var(--kc-ink-soft)]">
            A one-minute tour shows you where everything lives.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={startTour}
              className="rounded-[var(--kc-radius)] bg-[var(--kc-brand)] px-3 py-1.5 text-sm font-semibold text-[var(--kc-brand-contrast)]"
            >
              Take the tour
            </button>
            <button
              type="button"
              onClick={markIntroSeen}
              className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
            >
              Maybe later
            </button>
          </div>
        </div>
      ) : null}

      {panelOpen ? (
        <HelpPanel pathname={pathname} top={dropTop ?? 64} onStartTour={startTour} />
      ) : null}

      {tourRunning ? <WelcomeTour onExit={() => setTourRunning(false)} /> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */

function HelpPanel({
  pathname,
  top,
  onStartTour,
}: {
  pathname: string;
  top: number;
  onStartTour: () => void;
}) {
  const [query, setQuery] = useState("");
  const [reading, setReading] = useState<HelpTopic | null>(null);

  const results = query.trim() ? searchTopics(query) : null;
  const here = topicsForTab(pathname);

  /* Everything else, grouped by tab, in registry order. */
  const groups: { label: string; topics: HelpTopic[] }[] = [];
  for (const topic of HELP_TOPICS) {
    if (topic.tab === pathname) continue;
    const group = groups.find((g) => g.label === topic.tabLabel);
    if (group) group.topics.push(topic);
    else groups.push({ label: topic.tabLabel, topics: [topic] });
  }

  return (
    <div
      role="dialog"
      aria-label="Help"
      style={{ top, maxHeight: `calc(100vh - ${top + 16}px)` }}
      className="fixed right-4 z-50 flex w-[min(340px,calc(100vw-32px))] flex-col rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] shadow-xl"
    >
      {reading ? (
        <div className="overflow-y-auto p-5">
          <button
            type="button"
            onClick={() => setReading(null)}
            className="text-sm text-[var(--kc-brand)]"
          >
            {"←"} Back
          </button>
          <h2 className="mt-3 font-[family-name:var(--kc-font-display)] text-lg font-bold">
            {reading.title}
          </h2>
          <p className="mt-0.5 text-xs tracking-wide text-[var(--kc-ink-soft)] uppercase">
            {reading.tabLabel}
          </p>
          {reading.body.map((paragraph, i) => (
            <p key={i} className="mt-3 text-sm leading-relaxed text-[var(--kc-ink-soft)]">
              {paragraph}
            </p>
          ))}
        </div>
      ) : (
        <>
          <div className="border-b border-[var(--kc-line)] p-4">
            <label htmlFor="kc-help-search" className="sr-only">
              Search help
            </label>
            <input
              id="kc-help-search"
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What do you need help with?"
              className="w-full rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--kc-brand)]"
            />
          </div>

          <div className="overflow-y-auto p-4">
            {results ? (
              results.length === 0 ? (
                <p className="text-sm text-[var(--kc-ink-soft)]">
                  Nothing matched. Try a different word - or take the tour below
                  for the overall picture.
                </p>
              ) : (
                <TopicList topics={results} onPick={setReading} showTab />
              )
            ) : (
              <>
                {here.length > 0 ? (
                  <section className="mb-4">
                    <GroupHeading>On this page</GroupHeading>
                    <TopicList topics={here} onPick={setReading} />
                  </section>
                ) : null}

                {groups.map((group) => (
                  <section key={group.label} className="mb-4">
                    <GroupHeading>{group.label}</GroupHeading>
                    <TopicList topics={group.topics} onPick={setReading} />
                  </section>
                ))}
              </>
            )}
          </div>

          <div className="border-t border-[var(--kc-line)] p-4">
            <button
              type="button"
              onClick={onStartTour}
              className="w-full rounded-[var(--kc-radius)] bg-[var(--kc-brand)] px-4 py-2 text-sm font-semibold text-[var(--kc-brand-contrast)]"
            >
              Take the welcome tour
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function GroupHeading({ children }: { children: string }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-[var(--kc-ink-soft)] uppercase">
      {children}
    </p>
  );
}

function TopicList({
  topics,
  onPick,
  showTab,
}: {
  topics: HelpTopic[];
  onPick: (topic: HelpTopic) => void;
  showTab?: boolean;
}) {
  return (
    <ul className="space-y-0.5">
      {topics.map((topic) => (
        <li key={topic.id}>
          <button
            type="button"
            onClick={() => onPick(topic)}
            className="w-full rounded-[var(--kc-radius)] px-2 py-1.5 text-left text-sm hover:bg-[var(--kc-paper-dim)]"
          >
            {topic.title}
            {showTab ? (
              <span className="ml-2 text-xs text-[var(--kc-ink-soft)]">
                {topic.tabLabel}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
