"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TOUR_STEPS } from "@/lib/portal/help-content";

/**
 * ============================================================
 * WELCOME TOUR - spotlight and card
 * ============================================================
 *
 * Hand-rolled rather than a tour library, for three reasons that are all
 * about fit: the target set is closed and known (sidebar items carry stable
 * data-tour attributes), the card must wear each church's own theme tokens
 * exactly, and the mobile sidebar drawer needs opening and closing in step
 * with the tour - which no library coordinates.
 *
 * THE SPOTLIGHT is one div placed over the target with an enormous box-shadow
 * around it. The shadow is the darkness; the div's own area is transparent,
 * so the target shows through untouched at its natural z-index. No cloning,
 * no elevating the target, no fighting its stacking context.
 *
 * MOBILE: the sidebar is a drawer, closed by default. Steps marked inSidebar
 * ask PortalNav to open it via a CustomEvent ("kc-portal-drawer") - the nav
 * listens, this fires; neither imports the other. The drawer's 200ms slide
 * means the target is measured again shortly after the event, so the ring
 * lands where the link ends up, not where it started.
 *
 * A selector that matches nothing falls back to a centered card and warns in
 * development - a refactor that renames a data-tour attribute degrades one
 * stop instead of crashing the tour.
 */

type Rect = { top: number; left: number; width: number; height: number };

const RING_PAD = 6;
const CARD_WIDTH = 320;
const GAP = 14;

export function WelcomeTour({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[index];
  const isSmall = () => window.matchMedia("(max-width: 767px)").matches;

  /* Ask the sidebar drawer to open or close (mobile only; harmless on
     desktop, where the nav ignores it because the sidebar is static). */
  const setDrawer = useCallback((open: boolean) => {
    window.dispatchEvent(new CustomEvent("kc-portal-drawer", { detail: { open } }));
  }, []);

  const measure = useCallback(() => {
    if (!step.target) {
      setRect(null);
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[portal help] tour target not found: ${step.target}`);
      }
      setRect(null);
      return;
    }

    el.scrollIntoView({ block: "nearest" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step.target]);

  /* Measure on step change - after paint (rAF), and again after the mobile
     drawer's slide when a step lives inside it. */
  useEffect(() => {
    if (step.inSidebar && isSmall()) {
      setDrawer(true);
      const raf = requestAnimationFrame(measure);
      const timer = setTimeout(measure, 250);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [step, measure, setDrawer]);

  /* Track resize and any scroll (capture phase catches the sidebar's own
     scroller, not just the window). */
  useEffect(() => {
    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  /* Lock body scroll while the tour runs. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /* Close the drawer we opened when the tour ends, however it ends. */
  const exit = useCallback(() => {
    setDrawer(false);
    onExit();
  }, [setDrawer, onExit]);

  const isLast = index === TOUR_STEPS.length - 1;
  const next = useCallback(() => {
    if (isLast) exit();
    else setIndex((value) => value + 1);
  }, [isLast, exit]);
  const back = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);

  /* Keyboard: Esc exits, arrows navigate. Focus lands on the primary button
     each step so Enter always means "Next". */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") exit();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit, next, back]);

  useEffect(() => {
    cardRef.current
      ?.querySelector<HTMLButtonElement>("[data-tour-primary]")
      ?.focus();
  }, [index]);

  const card = placeCard(rect);

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      {rect ? (
        /* The spotlight: transparent over the target, darkness everywhere
           else via the box-shadow. motion-safe eases the ring between stops;
           reduced-motion users get instant repositioning. */
        <div
          aria-hidden
          className="absolute rounded-[10px] shadow-[0_0_0_9999px_rgba(20,12,6,0.62)] ring-2 ring-[var(--kc-brand)] motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: rect.top - RING_PAD,
            left: rect.left - RING_PAD,
            width: rect.width + RING_PAD * 2,
            height: rect.height + RING_PAD * 2,
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(20,12,6,0.62)]" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${index + 1} of ${TOUR_STEPS.length}: ${step.title}`}
        className="absolute w-[min(320px,calc(100vw-32px))] rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5 shadow-xl"
        style={card}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--kc-brand)] text-sm font-bold text-[var(--kc-brand-contrast)]"
          >
            ?
          </span>
          <h2 className="font-[family-name:var(--kc-font-display)] text-lg font-bold">
            {step.title}
          </h2>
        </div>

        <p className="mt-2.5 text-sm leading-relaxed text-[var(--kc-ink-soft)]">
          {step.body}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <span className="mr-auto text-xs text-[var(--kc-ink-soft)]">
            {index + 1} of {TOUR_STEPS.length}
          </span>

          {index > 0 ? (
            <button
              type="button"
              onClick={back}
              className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
            >
              Back
            </button>
          ) : null}

          <button
            type="button"
            data-tour-primary
            onClick={next}
            className="rounded-[var(--kc-radius)] bg-[var(--kc-brand)] px-4 py-1.5 text-sm font-semibold text-[var(--kc-brand-contrast)]"
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>

        {!isLast ? (
          <button
            type="button"
            onClick={exit}
            className="mt-3 text-xs text-[var(--kc-ink-soft)] underline underline-offset-2"
          >
            Skip the tour
          </button>
        ) : null}
      </div>

      {/* Step announcements for screen readers. */}
      <div aria-live="polite" className="sr-only">
        Step {index + 1} of {TOUR_STEPS.length}: {step.title}. {step.body}
      </div>
    </div>
  );
}

/**
 * Where the card goes: beside the target when there is room - right of the
 * sidebar items, below anything else - and centered when there is not, or
 * when the step has no target at all.
 */
function placeCard(rect: Rect | null): React.CSSProperties {
  if (typeof window === "undefined" || !rect) {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Right of the target, vertically aligned with it.
  if (rect.left + rect.width + GAP + CARD_WIDTH < vw) {
    return {
      top: Math.min(Math.max(rect.top, 16), vh - 260),
      left: rect.left + rect.width + GAP,
    };
  }

  // Below it.
  if (rect.top + rect.height + GAP + 240 < vh) {
    return {
      top: rect.top + rect.height + GAP,
      left: Math.min(Math.max(rect.left, 16), vw - CARD_WIDTH - 16),
    };
  }

  // Above it.
  if (rect.top - GAP - 240 > 0) {
    return {
      top: rect.top - GAP - 240,
      left: Math.min(Math.max(rect.left, 16), vw - CARD_WIDTH - 16),
    };
  }

  return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
}
