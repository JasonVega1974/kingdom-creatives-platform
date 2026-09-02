"use client";

import { useEffect, useRef, useState } from "react";

import { findTopic } from "@/lib/portal/help-content";

/**
 * A small "?" beside a control or heading, opening that spot's explanation.
 *
 * Self-contained on purpose: it takes a topic id, looks the content up in the
 * help registry, and manages its own popover - no context, no provider, so a
 * tab can drop one next to anything with a single import. The same topic is
 * also findable through the help bubble's search; this is just the shortest
 * path to it.
 *
 * A mistyped id renders nothing and warns in development, rather than
 * crashing the tab over a help icon.
 */
export function HelpMark({ topic: topicId }: { topic: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const topic = findTopic(topicId);

  useEffect(() => {
    if (!topic && process.env.NODE_ENV !== "production") {
      console.warn(`[portal help] HelpMark topic not found: ${topicId}`);
    }
  }, [topic, topicId]);

  /* Close on click-outside and Esc. Listeners exist only while open. */
  useEffect(() => {
    if (!open) return;

    function onDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!topic) return null;

  return (
    <span ref={wrapRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Help: ${topic.title}`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[var(--kc-line)] text-[11px] font-bold text-[var(--kc-ink-soft)] hover:border-[var(--kc-brand)] hover:text-[var(--kc-brand)]"
      >
        ?
      </button>

      {open ? (
        <div
          role="note"
          className="absolute top-[26px] left-0 z-[60] w-[min(320px,calc(100vw-40px))] rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-4 shadow-lg"
        >
          <p className="font-semibold">{topic.title}</p>
          {topic.body.map((paragraph, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed text-[var(--kc-ink-soft)]">
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}
    </span>
  );
}
