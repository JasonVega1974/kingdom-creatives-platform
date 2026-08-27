"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  moveSection,
  saveSectionContent,
  setSectionVisible,
  type SaveState,
} from "@/app/(portal)/portal/website/actions";
import type { FieldKind } from "@/lib/portal/sections";

export type EditableField = {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  value: string;
};

export type EditableSection = {
  id: string;
  pageSlug: string;
  sectionKey: string;
  label: string;
  description: string;
  visible: boolean;
  fields: EditableField[];
};

/** How long after the last keystroke a save fires. Matches the prototype. */
const AUTOSAVE_DELAY_MS = 800;

export function SectionEditor({ sections }: { sections: EditableSection[] }) {
  return (
    <ol className="space-y-3">
      {sections.map((section, index) => (
        <li key={section.id}>
          <SectionCard
            section={section}
            isFirst={index === 0}
            isLast={index === sections.length - 1}
          />
        </li>
      ))}
    </ol>
  );
}

function SectionCard({
  section,
  isFirst,
  isLast,
}: {
  section: EditableSection;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [visible, setVisible] = useState(section.visible);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SaveState>({ ok: false, error: null, savedAt: null });
  const [, startTransition] = useTransition();

  const hasFields = section.fields.length > 0;

  function toggleVisible() {
    const next = !visible;
    // Optimistic: the switch moves under the finger, then reverts if the
    // write fails. A switch that waits on a round trip feels broken.
    setVisible(next);

    startTransition(async () => {
      const result = await setSectionVisible(section.id, next);
      setStatus(result);
      if (!result.ok) setVisible(!next);
    });
  }

  function move(direction: "up" | "down") {
    startTransition(async () => {
      setStatus(await moveSection(section.id, direction));
    });
  }

  return (
    <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => move("up")}
            disabled={isFirst}
            aria-label={`Move ${section.label} up`}
            className="px-1 leading-none text-[var(--kc-ink-soft)] disabled:opacity-25"
          >
            &#9650;
          </button>
          <button
            type="button"
            onClick={() => move("down")}
            disabled={isLast}
            aria-label={`Move ${section.label} down`}
            className="px-1 leading-none text-[var(--kc-ink-soft)] disabled:opacity-25"
          >
            &#9660;
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold">{section.label}</p>
          <p className="text-sm text-[var(--kc-ink-soft)]">{section.description}</p>
        </div>

        {hasFields && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm hover:bg-[var(--kc-paper-dim)]"
          >
            {open ? "Done" : "Change words"}
          </button>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <span className="sr-only">Show {section.label} on the website</span>
          <input
            type="checkbox"
            checked={visible}
            onChange={toggleVisible}
            className="h-5 w-5 accent-[var(--kc-brand)]"
          />
          <span aria-hidden className="w-10 text-[var(--kc-ink-soft)]">
            {visible ? "Shown" : "Hidden"}
          </span>
        </label>
      </div>

      {open && hasFields && (
        <div className="space-y-4 border-t border-[var(--kc-line)] px-4 py-4">
          {section.fields.map((field) => (
            <FieldEditor
              key={field.key}
              section={section}
              field={field}
              onSaved={setStatus}
            />
          ))}
        </div>
      )}

      <StatusLine status={status} />
    </div>
  );
}

function FieldEditor({
  section,
  field,
  onSaved,
}: {
  section: EditableSection;
  field: EditableField;
  onSaved: (state: SaveState) => void;
}) {
  const [value, setValue] = useState(field.value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set while a save is debounced, cleared once it fires. Written only from
   *  event handlers and effects, never during render. */
  const pending = useRef<string | null>(null);

  const save = useCallback(
    (next: string) => {
      void saveSectionContent(section.id, section.pageSlug, section.sectionKey, {
        [field.key]: next,
      }).then(onSaved);
    },
    [section.id, section.pageSlug, section.sectionKey, field.key, onSaved],
  );

  function onChange(next: string) {
    setValue(next);
    pending.current = next;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = null;
      save(next);
    }, AUTOSAVE_DELAY_MS);
  }

  // A debounced save must not be lost because the pastor collapsed the card or
  // navigated away inside the 800ms window. Flush on unmount rather than
  // letting the timer die with the component.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) save(pending.current);
    };
  }, [save]);

  const inputId = `${section.id}-${field.key}`;
  const shared =
    "w-full rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] px-3 py-2 outline-none focus:border-[var(--kc-brand)]";

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
        {field.label}
        {field.hint && (
          <span className="ml-2 font-normal text-[var(--kc-ink-soft)]">({field.hint})</span>
        )}
      </label>

      {field.kind === "textarea" ? (
        <textarea
          id={inputId}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={shared}
        />
      ) : (
        <input
          id={inputId}
          type={field.kind === "url" ? "url" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Image fields hold a stored path today. Until the Photos tab ships
          // there is no picker to open, so this stays a plain box rather than
          // pretending to be one.
          placeholder={field.kind === "image" ? "Paste a photo link for now" : undefined}
          className={shared}
        />
      )}
    </div>
  );
}

function StatusLine({ status }: { status: SaveState }) {
  if (status.error) {
    return (
      <p role="alert" className="border-t border-[var(--kc-line)] px-4 py-2 text-sm text-red-700">
        {status.error}
      </p>
    );
  }

  if (status.ok) {
    return (
      <p
        role="status"
        className="border-t border-[var(--kc-line)] px-4 py-2 text-sm text-[var(--kc-ink-soft)]"
      >
        Saved and live on the website
      </p>
    );
  }

  return null;
}
