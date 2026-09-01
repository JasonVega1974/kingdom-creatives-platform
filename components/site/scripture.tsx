import Link from "next/link";

import type { BibleBook } from "@/lib/bible-books";

/**
 * ============================================================
 * SCRIPTURE - the passage itself, presented as a page
 * ============================================================
 *
 * The reader used to render the whole chapter as one undifferentiated <p>.
 * That is a wall of text: no way to find a verse someone reads out, nowhere for
 * the eye to rest, and no sense of where you are in the book.
 *
 * Three things fix most of that, none of which need JavaScript:
 *
 *   1. VERSE NUMBERS become real marks rather than "[16]" sitting in the
 *      sentence. ESV returns them as bracketed numerals in the text, so they
 *      are parsed out and set as superscripts - which is how every printed
 *      Bible has done it for centuries, and it makes a verse findable.
 *   2. A DROP CAP and a proper measure. Prose wants roughly 66 characters a
 *      line; the reader had no limit, so on a laptop it ran the full column.
 *   3. WHERE YOU ARE and WHERE NEXT. The chapter numeral is set large, and
 *      previous/next chapter links mean reading straight through does not mean
 *      returning to a grid of 150 numbers between every chapter.
 *
 * bible-api's WEB text carries no verse markers at all, so the parser must
 * degrade to a single block. It does.
 */

type Verse = { number: string | null; text: string };

/**
 * Split "[1] In the beginning [2] and the earth" into numbered verses.
 *
 * Text before the first marker keeps `number: null` - some passages open with
 * a fragment, and dropping it to make the parse tidy would drop scripture.
 */
export function parseVerses(text: string): Verse[] {
  const parts = text.split(/\[(\d+)\]/);
  const verses: Verse[] = [];

  const lead = parts[0]?.trim();
  if (lead) verses.push({ number: null, text: lead });

  for (let i = 1; i < parts.length; i += 2) {
    const body = parts[i + 1]?.trim();
    if (body) verses.push({ number: parts[i], text: body });
  }

  return verses.length > 0 ? verses : [{ number: null, text: text.trim() }];
}

export function Scripture({
  book,
  chapter,
  reference,
  translation,
  subtitle,
  text,
  attribution,
}: {
  book: BibleBook;
  chapter: number;
  reference: string;
  translation: string;
  subtitle?: string | null;
  text: string;
  attribution: string;
}) {
  const verses = parseVerses(text);

  return (
    <article className="scripture">
      <header className="scripture-head">
        <div>
          <span className="scripture-book">{reference || book.name}</span>
          {subtitle ? <span className="scripture-sub">{subtitle}</span> : null}
        </div>
        {/* The translation is a licence-relevant fact, not decoration - a
            reader must be able to tell which text they are looking at. */}
        <span className="scripture-trans">{translation}</span>
      </header>

      <div className="scripture-body">
        {verses.map((verse, index) => (
          <p key={index} className={index === 0 ? "scripture-verse is-first" : "scripture-verse"}>
            {verse.number ? <sup className="scripture-num">{verse.number}</sup> : null}
            {verse.text}
          </p>
        ))}
      </div>

      {/* A licence condition for several providers, not decoration - printed
          verbatim as the adapter returned it. */}
      <p className="scripture-credit">{attribution}</p>

      <ChapterSteps book={book} chapter={chapter} />
    </article>
  );
}

/**
 * Previous / next chapter.
 *
 * Bounded by the book's real chapter count, so Philemon shows neither and
 * Psalms 150 shows no "next" - the same map that sizes the chapter grid. A
 * next link into a chapter that does not exist is the bug this whole area
 * already had once.
 */
function ChapterSteps({ book, chapter }: { book: BibleBook; chapter: number }) {
  const href = (n: number) => `/bible?book=${encodeURIComponent(book.name)}&chapter=${n}`;
  const hasPrev = chapter > 1;
  const hasNext = chapter < book.chapters;

  if (!hasPrev && !hasNext) return null;

  return (
    <nav className="scripture-steps" aria-label="Chapter navigation">
      {hasPrev ? (
        <Link className="scripture-step" href={href(chapter - 1)} rel="prev">
          <span aria-hidden="true">&larr;</span> {book.name} {chapter - 1}
        </Link>
      ) : (
        <span />
      )}
      {hasNext ? (
        <Link className="scripture-step is-next" href={href(chapter + 1)} rel="next">
          {book.name} {chapter + 1} <span aria-hidden="true">&rarr;</span>
        </Link>
      ) : null}
    </nav>
  );
}
