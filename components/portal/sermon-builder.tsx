"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  finishSermonGeneration,
  publishBuiltSermon,
  retrySermonSection,
  saveSermonEdits,
} from "@/app/(portal)/portal/sermon-builder/actions";
import { Field, SelectField, TextArea } from "@/components/portal/editor-kit";
import { HelpMark } from "@/components/portal/help-mark";
import { SermonBodyEditor } from "@/components/portal/sermon-body-editor";
import { BOOKS } from "@/lib/bible-books";
import {
  SERMON_ADDONS,
  type AddonKey,
  type SlideDeck,
  type SocialSet,
  type SectionOutcome,
} from "@/lib/portal/sermon-builder-shared";
import type { JSONContent } from "@/lib/portal/sermon-extensions";

/**
 * ============================================================
 * SERMON BUILDER - generate, watch it arrive, edit, publish
 * ============================================================
 *
 * Three phases the pastor can see:
 *
 *   form       fill in title, passage, style, notes, toggles
 *   streaming  the sermon arrives word by word (generate/route.ts)
 *   ready      draft is saved; add-ons resolve on a checklist; the
 *              manuscript is editable; publish / print from here
 *
 * The old WordPress builder put a spinner on a 90-second call; the stream
 * is the fix. A failed add-on shows a Retry that regenerates only itself -
 * the draft is already safe in the database by then.
 */

type Phase = "form" | "streaming" | "ready";

/** The seven style choices, labels matching lib/portal/sermon-prompts.ts. */
const STYLE_OPTIONS = [
  { value: "", label: "Choose style..." },
  { value: "expository", label: "Traditional / Expository" },
  { value: "topical", label: "Topical Teaching" },
  { value: "narrative", label: "Narrative / Story-Based" },
  { value: "youth", label: "Youth / Student Focused" },
  { value: "evangelistic", label: "Evangelistic / Outreach" },
  { value: "devotional", label: "Short Devotional" },
  { value: "verse_by_verse", label: "Verse-by-Verse" },
];

const INCLUDE_OPTIONS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: "include_scripture", label: "Include Scripture text", defaultOn: true },
  { key: "include_examples", label: "Life applications", defaultOn: true },
  { key: "include_humor", label: "Appropriate humor", defaultOn: false },
  { key: "include_illustrations", label: "Illustrations", defaultOn: true },
  { key: "include_quotes", label: "Relevant quotes", defaultOn: false },
  { key: "include_calltoaction", label: "Call to action", defaultOn: true },
];

type SectionState = Partial<Record<AddonKey | "summary", SectionOutcome>>;

export function SermonBuilder({ remainingToday }: { remainingToday: number }) {
  const [phase, setPhase] = useState<Phase>("form");
  const [streamText, setStreamText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [sermonId, setSermonId] = useState<string | null>(null);
  const [bodyJson, setBodyJson] = useState<JSONContent | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sections, setSections] = useState<SectionState>({});
  const [addonValues, setAddonValues] = useState<{
    devotional: string | null;
    smallGroup: string | null;
    kids: string | null;
    bulletin: string | null;
    slides: SlideDeck | null;
    social: SocialSet | null;
  }>({ devotional: null, smallGroup: null, kids: null, bulletin: null, slides: null, social: null });

  const formRef = useRef<HTMLFormElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  async function generate() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    const payload = {
      title: String(fd.get("title") ?? ""),
      sermon_date: String(fd.get("sermon_date") ?? ""),
      book: String(fd.get("book") ?? ""),
      chapter: String(fd.get("chapter") ?? ""),
      verses: String(fd.get("verses") ?? ""),
      style: String(fd.get("style") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      include_scripture: fd.get("include_scripture") != null,
      include_examples: fd.get("include_examples") != null,
      include_humor: fd.get("include_humor") != null,
      include_illustrations: fd.get("include_illustrations") != null,
      include_quotes: fd.get("include_quotes") != null,
      include_calltoaction: fd.get("include_calltoaction") != null,
    };

    if (!payload.title.trim()) {
      setFormError("Give the sermon a title first - even a working one.");
      return;
    }

    const addons = SERMON_ADDONS.filter((addon) => fd.get(`addon_${addon.key}`) != null).map(
      (addon) => addon.key,
    );

    setFormError(null);
    setPhase("streaming");
    setStreamText("");

    let markdown = "";
    try {
      const response = await fetch("/portal/sermon-builder/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        /*
         * TEMPORARY DIAGNOSTIC, 2026-09-03. Read the body as TEXT before
         * trying to parse it, because what it is not is the whole point: a
         * JSON body is our own error and names its cause; an HTML body is
         * the platform's, which means the function never ran. The previous
         * version called .json().catch(() => null) and threw a generic
         * fallback, so a platform failure and a real error looked identical
         * on screen - which is why this took three rounds to corner.
         */
        const raw = await response.text().catch(() => "");
        const contentType = response.headers.get("content-type") ?? "none";
        console.error(
          `[sermon-builder] generate failed: HTTP ${response.status}, content-type ${contentType}`,
          raw.slice(0, 600),
        );

        let message: string;
        try {
          message =
            (JSON.parse(raw) as { error?: string }).error ??
            `Generation failed (HTTP ${response.status}).`;
        } catch {
          // Not JSON - surface the status and a snippet so the screen says
          // as much as the console does.
          message =
            `Generation failed (HTTP ${response.status}, ${contentType}). ` +
            (raw ? raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) : "Empty response body.");
        }
        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        markdown += decoder.decode(value, { stream: true });
        setStreamText(markdown);
        streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight });
      }

      if (!markdown.trim()) {
        throw new Error("The generation came back empty. Try again in a moment.");
      }

      // Mark the still-running sections so the checklist shows work in
      // flight, not blanks.
      const pendingSections: SectionState = { summary: undefined };
      addons.forEach((key) => (pendingSections[key] = undefined));
      setSections(pendingSections);
      setTitle(payload.title.trim());

      console.log(
        `[sermon-builder] streaming done, ${markdown.length} chars. Saving with add-ons:`,
        addons,
      );

      const result = await finishSermonGeneration({
        markdown,
        title: payload.title,
        sermonDate: payload.sermon_date,
        book: payload.book,
        chapter: payload.chapter,
        verses: payload.verses,
        style: payload.style,
        addons,
      });

      /*
       * TEMPORARY DIAGNOSTIC, 2026-09-03. The save fails with an error whose
       * detail production strips, and the Vercel logs are not always to
       * hand. This puts the action's own answer in the browser console -
       * whether it returned at all, whether it saved, the sermon id, and
       * each section's outcome - so one generation attempt is enough to see
       * what happened. Remove once saving is reliable.
       */
      console.log("[sermon-builder] finishSermonGeneration returned:", result);

      if (!result.ok) throw new Error(result.error);

      setSermonId(result.sermonId);
      setBodyJson(result.bodyJson);
      setSummary(result.summary ?? "");
      setSections(result.sections);
      setAddonValues({
        devotional: result.devotional,
        smallGroup: result.smallGroup,
        kids: result.kids,
        bulletin: result.bulletin,
        slides: result.slides,
        social: result.social,
      });
      setPhase("ready");
    } catch (error) {
      setFormError((error as Error).message);
      setPhase("form");
    }
  }

  if (phase === "ready" && sermonId && bodyJson) {
    return (
      <ReadyView
        sermonId={sermonId}
        initialBody={bodyJson}
        title={title}
        onTitle={setTitle}
        summary={summary}
        onSummary={setSummary}
        sections={sections}
        onSections={setSections}
        addonValues={addonValues}
        onAddonValues={setAddonValues}
      />
    );
  }

  return (
    <div>
      {phase === "streaming" ? (
        <section className="mb-5 rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
          <p className="font-semibold">Writing your sermon...</p>
          <p className="mt-1 text-sm text-[var(--kc-ink-soft)]">
            It arrives as it is written. Your draft saves automatically the
            moment it finishes.
          </p>
          <div
            ref={streamRef}
            aria-live="off"
            className="mt-4 max-h-[420px] overflow-y-auto rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-paper-dim)] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
          >
            {streamText || "Starting..."}
          </div>
        </section>
      ) : null}

      <form ref={formRef} className={phase === "streaming" ? "hidden" : undefined}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Field name="title" label="Sermon title" required />
            <Field name="sermon_date" label="Service date" type="date" />

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <SelectField
                  name="book"
                  label="Book"
                  options={[
                    { value: "", label: "Book..." },
                    ...BOOKS.map((book) => ({ value: book.name, label: book.name })),
                  ]}
                />
              </div>
              <Field name="chapter" label="Chapter" type="number" />
              <Field name="verses" label="Verses" hint="1-10" />
            </div>

            <SelectField name="style" label="Sermon style" options={STYLE_OPTIONS} />
            <TextArea
              name="notes"
              label="Guidance and notes"
              rows={5}
            />
          </div>

          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-sm font-semibold">
                What the sermon includes
                <HelpMark topic="builder.includes" />
              </legend>
              <div className="space-y-1.5">
                {INCLUDE_OPTIONS.map((option) => (
                  <label key={option.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={option.key}
                      defaultChecked={option.defaultOn}
                      className="h-4 w-4 accent-[var(--kc-brand)]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-sm font-semibold">
                Also create
                <HelpMark topic="builder.addons" />
              </legend>
              <div className="space-y-1.5">
                {SERMON_ADDONS.map((addon) => (
                  <label key={addon.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={`addon_${addon.key}`}
                      className="h-4 w-4 accent-[var(--kc-brand)]"
                    />
                    {addon.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={remainingToday <= 0}
            className="rounded-[var(--kc-radius)] bg-[var(--kc-brand)] px-5 py-2.5 font-semibold text-[var(--kc-brand-contrast)] disabled:opacity-60"
          >
            Generate sermon
          </button>
          <span className="text-sm text-[var(--kc-ink-soft)]">
            {remainingToday > 0
              ? `${remainingToday} of 10 generations left today`
              : "Today's 10 generations are used up - the counter resets at midnight UTC."}
          </span>
        </div>

        {formError ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {formError}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReadyView({
  sermonId,
  initialBody,
  title,
  onTitle,
  summary,
  onSummary,
  sections,
  onSections,
  addonValues,
  onAddonValues,
}: {
  sermonId: string;
  initialBody: JSONContent;
  title: string;
  onTitle: (value: string) => void;
  summary: string;
  onSummary: (value: string) => void;
  sections: SectionState;
  onSections: (value: SectionState) => void;
  addonValues: {
    devotional: string | null;
    smallGroup: string | null;
    kids: string | null;
    bulletin: string | null;
    slides: SlideDeck | null;
    social: SocialSet | null;
  };
  onAddonValues: (value: typeof addonValues) => void;
}) {
  const bodyRef = useRef<JSONContent>(initialBody);
  const [saving, startSaving] = useTransition();
  const [publishing, startPublishing] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  // The document snapshot to print, captured from the ref in the click
  // handler - refs must not be read during render.
  const [printDoc, setPrintDoc] = useState<JSONContent | null>(null);

  function save() {
    startSaving(async () => {
      const result = await saveSermonEdits({
        sermonId,
        title,
        summary,
        bodyJson: JSON.stringify(bodyRef.current),
      });
      setStatus(result.ok ? "Saved" : result.error);
    });
  }

  function publish() {
    startPublishing(async () => {
      const saveResult = await saveSermonEdits({
        sermonId,
        title,
        summary,
        bodyJson: JSON.stringify(bodyRef.current),
      });
      if (!saveResult.ok) {
        setStatus(saveResult.error);
        return;
      }
      const result = await publishBuiltSermon(sermonId);
      if (result.ok) {
        setPublished(true);
        setStatus(null);
      } else {
        setStatus(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-brand-wash)] px-4 py-3 text-sm">
        Your draft is saved. Edit anything below, then publish when it is
        ready - and once the video is on YouTube, paste its link on this
        sermon in Sermon Library so the sermon and the video become one card.
      </section>

      <ChecklistPanel
        sermonId={sermonId}
        sections={sections}
        onSections={onSections}
        onSummary={onSummary}
        addonValues={addonValues}
        onAddonValues={onAddonValues}
      />

      <div>
        <label htmlFor="builder-title" className="mb-1 block text-sm font-medium">
          Title
        </label>
        <input
          id="builder-title"
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          className="w-full rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] px-3 py-2 outline-none focus:border-[var(--kc-brand)]"
        />
      </div>

      <div>
        <label htmlFor="builder-summary" className="mb-1 block text-sm font-medium">
          Public summary
          <span className="ml-2 font-normal text-[var(--kc-ink-soft)]">
            (what visitors see on your sermons page)
          </span>
        </label>
        <textarea
          id="builder-summary"
          rows={4}
          value={summary}
          onChange={(event) => onSummary(event.target.value)}
          className="w-full rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] px-3 py-2 outline-none focus:border-[var(--kc-brand)]"
        />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium">Manuscript</span>
        <SermonBodyEditor
          initial={initialBody}
          onChange={(doc) => {
            bodyRef.current = doc;
          }}
        />
      </div>

      <AddonPanels values={addonValues} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-4 py-2 font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={publishing || published}
          className="rounded-[var(--kc-radius)] bg-[var(--kc-brand)] px-4 py-2 font-semibold text-[var(--kc-brand-contrast)] disabled:opacity-60"
        >
          {published ? "On your website" : publishing ? "Publishing..." : "Publish to my website"}
        </button>
        <button
          type="button"
          onClick={() => setPrintDoc(bodyRef.current)}
          className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-4 py-2 font-semibold"
        >
          Print / PDF
        </button>

        {status ? (
          <span
            role={status === "Saved" ? "status" : "alert"}
            className={status === "Saved" ? "text-sm text-[var(--kc-ink-soft)]" : "text-sm text-red-700"}
          >
            {status}
          </span>
        ) : null}
      </div>

      {published ? (
        <p className="text-sm text-[var(--kc-ink-soft)]">
          It is live - a text card on your sermons page until you attach the
          video. Manage it from Sermon Library from here on.
        </p>
      ) : null}

      {printDoc ? (
        <SermonPrintTarget title={title} body={printDoc} onDone={() => setPrintDoc(null)} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const SECTION_LABELS: Record<AddonKey | "summary", string> = {
  summary: "Public summary",
  devotional: "Daily Devotional",
  small_group: "Small Group Discussion",
  kids: "Kids Ministry Lesson",
  bulletin: "Bulletin Notes",
  slides: "Presentation Slides",
  social: "Social Media Posts",
};

function ChecklistPanel({
  sermonId,
  sections,
  onSections,
  onSummary,
  addonValues,
  onAddonValues,
}: {
  sermonId: string;
  sections: SectionState;
  onSections: (value: SectionState) => void;
  onSummary: (value: string) => void;
  addonValues: {
    devotional: string | null;
    smallGroup: string | null;
    kids: string | null;
    bulletin: string | null;
    slides: SlideDeck | null;
    social: SocialSet | null;
  };
  onAddonValues: (value: typeof addonValues) => void;
}) {
  const [retrying, startRetrying] = useTransition();
  const keys = Object.keys(sections) as (AddonKey | "summary")[];
  if (keys.length === 0) return null;

  const failed = keys.filter((key) => sections[key] === "failed");

  function retry(section: AddonKey | "summary") {
    startRetrying(async () => {
      const result = await retrySermonSection(sermonId, section);
      if (!result.ok) return;

      onSections({ ...sections, [section]: "ok" });
      if (section === "summary") onSummary(result.value as string);
      else if (section === "slides") onAddonValues({ ...addonValues, slides: result.value as SlideDeck });
      else if (section === "social") onAddonValues({ ...addonValues, social: result.value as SocialSet });
      else if (section === "small_group")
        onAddonValues({ ...addonValues, smallGroup: result.value as string });
      else onAddonValues({ ...addonValues, [section]: result.value as string });
    });
  }

  if (failed.length === 0) return null;

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-4">
      <p className="text-sm font-semibold">
        {failed.length === 1 ? "One piece did not generate" : "Some pieces did not generate"}
        {" - the sermon itself is saved and fine."}
      </p>
      <ul className="mt-2 space-y-1.5">
        {failed.map((section) => (
          <li key={section} className="flex items-center gap-3 text-sm">
            <span>{SECTION_LABELS[section]}</span>
            <button
              type="button"
              disabled={retrying}
              onClick={() => retry(section)}
              className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
            >
              {retrying ? "Retrying..." : "Retry"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function AddonPanels({
  values,
}: {
  values: {
    devotional: string | null;
    smallGroup: string | null;
    kids: string | null;
    bulletin: string | null;
    slides: SlideDeck | null;
    social: SocialSet | null;
  };
}) {
  const textPanels: { label: string; value: string | null }[] = [
    { label: "Daily Devotional", value: values.devotional },
    { label: "Small Group Discussion", value: values.smallGroup },
    { label: "Kids Ministry Lesson", value: values.kids },
    { label: "Bulletin Notes", value: values.bulletin },
  ];

  const anything =
    textPanels.some((panel) => panel.value) || values.slides || values.social;
  if (!anything) return null;

  return (
    <div className="space-y-4">
      {textPanels.map((panel) =>
        panel.value ? (
          <details
            key={panel.label}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-4"
          >
            <summary className="cursor-pointer font-semibold">{panel.label}</summary>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{panel.value}</p>
          </details>
        ) : null,
      )}

      {/* Array.isArray, not a truthiness check: the action validates the
          shape now, but a row written before that guard existed could still
          be an object, and a crash here would land after a successful save. */}
      {Array.isArray(values.slides) && values.slides.length > 0 ? (
        <details className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-4">
          <summary className="cursor-pointer font-semibold">
            Presentation Slides ({values.slides.length})
          </summary>
          <ol className="mt-3 space-y-3">
            {values.slides.map((slide, index) => (
              <li
                key={index}
                className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-paper-dim)] p-3"
              >
                <p className="font-semibold">
                  {index + 1}. {slide.title}
                </p>
                {slide.scripture ? (
                  <p className="text-xs text-[var(--kc-brand)]">{slide.scripture}</p>
                ) : null}
                <ul className="mt-1.5 list-disc pl-5 text-sm">
                  {(slide.bullets ?? []).map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {values.social ? (
        <details className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-4">
          <summary className="cursor-pointer font-semibold">Social Media Posts</summary>
          <dl className="mt-3 space-y-3 text-sm">
            {(
              [
                ["Facebook", values.social.facebook],
                ["Instagram", values.social.instagram],
                ["X", values.social.x],
                ["Text blast (SMS)", values.social.sms],
              ] as const
            ).map(([label, value]) =>
              value ? (
                <div key={label}>
                  <dt className="font-semibold">{label}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </details>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Print one sermon: the same single-target pattern (and the same
 * .kc-note-print-target CSS) the Notes tab shipped - at most one exists in
 * the DOM, so the print stylesheet hides everything else.
 *
 * The HTML comes from the live editor document via a throwaway hidden
 * TipTap render? No - simpler: the manuscript is already structured JSON;
 * this renders it directly to React elements, which print exactly like the
 * editor shows them.
 */
function SermonPrintTarget({
  title,
  body,
  onDone,
}: {
  title: string;
  body: JSONContent;
  onDone: () => void;
}) {
  useEffect(() => {
    window.print();
    window.addEventListener("afterprint", onDone, { once: true });
    return () => window.removeEventListener("afterprint", onDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="kc-note-print-target">
      <h1>{title}</h1>
      <DocNodes nodes={body.content ?? []} />
    </div>
  );
}

/** Render TipTap JSON to React - the closed schema makes this a short walk. */
function DocNodes({ nodes }: { nodes: JSONContent[] }) {
  return (
    <>
      {nodes.map((node, index) => (
        <DocNode key={index} node={node} />
      ))}
    </>
  );
}

function DocNode({ node }: { node: JSONContent }) {
  const children = node.content ? <DocNodes nodes={node.content} /> : null;

  switch (node.type) {
    case "heading":
      return node.attrs?.level === 2 ? <h2>{children}</h2> : <h3>{children}</h3>;
    case "paragraph":
      return <p>{children}</p>;
    case "bulletList":
      return <ul>{children}</ul>;
    case "orderedList":
      return <ol>{children}</ol>;
    case "listItem":
      return <li>{children}</li>;
    case "blockquote":
      return <blockquote>{children}</blockquote>;
    case "hardBreak":
      return <br />;
    case "text": {
      let text: React.ReactNode = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") text = <strong>{text}</strong>;
        if (mark.type === "italic") text = <em>{text}</em>;
        if (mark.type === "underline") text = <u>{text}</u>;
      }
      return <>{text}</>;
    }
    default:
      return children;
  }
}
