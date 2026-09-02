"use client";

import { useId, useState } from "react";

import { BOOKS, findBook, resolveChapter } from "@/lib/bible-books";
import { FIELD } from "@/components/portal/editor-kit";

/**
 * Book -> chapter -> verse range, for attaching a note to a passage.
 *
 * Driven by lib/bible-books.ts's canon rather than free text, per the My
 * Notes scope: the chapter dropdown only ever offers chapters the selected
 * book actually has, the same rule the public Bible reader already follows.
 *
 * Uncontrolled except for which book is picked - the chapter select's option
 * list depends on that, so book selection is the only piece that needs to
 * live in React state. Chapter and verse stay plain named inputs read
 * straight out of FormData on submit, same as everything else in this form.
 */
export function ScripturePicker({
  defaultBook,
  defaultChapter,
  defaultVerseStart,
  defaultVerseEnd,
}: {
  defaultBook?: string | null;
  defaultChapter?: number | null;
  defaultVerseStart?: number | null;
  defaultVerseEnd?: number | null;
}) {
  const bookId = useId();
  const chapterId = useId();
  const startId = useId();
  const endId = useId();

  const [book, setBook] = useState(() => findBook(defaultBook)?.name ?? "");
  const chapters = findBook(book)?.chapters ?? 0;
  const chapterDefault = resolveChapter(findBook(book) ?? { name: "", chapters: 1, testament: "old" }, String(defaultChapter ?? ""));

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor={bookId} className="mb-1 block text-sm font-medium">
          Book
        </label>
        <select
          id={bookId}
          name="scripture_book"
          value={book}
          onChange={(event) => setBook(event.target.value)}
          className={FIELD}
        >
          <option value="">No reference</option>
          {BOOKS.map((entry) => (
            <option key={entry.name} value={entry.name}>
              {entry.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={chapterId} className="mb-1 block text-sm font-medium">
          Chapter
        </label>
        <select
          id={chapterId}
          name="scripture_chapter"
          defaultValue={book ? chapterDefault : ""}
          disabled={!book}
          className={FIELD}
        >
          {Array.from({ length: chapters }, (_, index) => index + 1).map((chapter) => (
            <option key={chapter} value={chapter}>
              {chapter}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={startId} className="mb-1 block text-sm font-medium">
          Verse
          <span className="ml-2 font-normal text-[var(--kc-ink-soft)]">(optional)</span>
        </label>
        <input
          id={startId}
          name="scripture_verse_start"
          type="number"
          min={1}
          disabled={!book}
          defaultValue={defaultVerseStart ?? ""}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor={endId} className="mb-1 block text-sm font-medium">
          Through
          <span className="ml-2 font-normal text-[var(--kc-ink-soft)]">(optional)</span>
        </label>
        <input
          id={endId}
          name="scripture_verse_end"
          type="number"
          min={1}
          disabled={!book}
          defaultValue={defaultVerseEnd ?? ""}
          className={FIELD}
        />
      </div>
    </div>
  );
}

/** "John 3:16" / "Romans 8:28-30" / "Psalms 23", for a note card's header. */
export function formatScripture(
  book: string | null,
  chapter: number | null,
  verseStart: number | null,
  verseEnd: number | null,
): string | null {
  if (!book || !chapter) return null;
  if (!verseStart) return `${book} ${chapter}`;
  if (!verseEnd || verseEnd === verseStart) return `${book} ${chapter}:${verseStart}`;
  return `${book} ${chapter}:${verseStart}-${verseEnd}`;
}
