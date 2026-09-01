import Link from "next/link";

import type { Devotional } from "@/lib/devotionals";

/**
 * ============================================================
 * DEVOTIONALS - today's reading, and the archive behind it
 * ============================================================
 *
 * SERVER COMPONENTS, and that is the size strategy rather than an incidental
 * choice. The source array is ~237 KB of prose. These render on the server and
 * the browser receives HTML for the handful of devotionals actually shown -
 * never the array. lib/devotionals.ts is marked "server-only" so importing it
 * from a Client Component fails the build instead of quietly shipping all 365.
 *
 * The archive is PAGINATED for the same reason: 365 cards is a megabyte of DOM
 * and an unusable page. It renders one page at a time through the URL, so it
 * costs no JavaScript and every page is linkable.
 *
 * Neither component knows where the devotionals came from. They take data as a
 * parameter, so moving the entries to a per-church table changes the caller and
 * nothing here.
 */

const PER_PAGE = 24;

/** The full reading view - today's, or whichever the reader picked. */
export function DevotionalReading({
  devotional,
  label,
  dayNumber,
}: {
  devotional: Devotional;
  /** "Today's devotional", from the page hero. */
  label?: string;
  /** 1-based position, shown so a reader can tell where they are. */
  dayNumber?: number;
}) {
  return (
    <article className="scripture devotional">
      <header className="scripture-head">
        <div>
          {label ? <span className="eyebrow">{label}</span> : null}
          <span className="scripture-book">{devotional.title}</span>
          <span className="scripture-sub">{devotional.verse}</span>
        </div>
        {dayNumber ? <span className="scripture-trans">No. {dayNumber}</span> : null}
      </header>

      <div className="scripture-body">
        {/* The verse itself, set apart from the reflection on it. */}
        <blockquote className="devotional-scripture">
          {devotional.scripture}
          <cite>{devotional.verse}</cite>
        </blockquote>

        <p className="scripture-verse is-first">{devotional.body}</p>

        <div className="devotional-block">
          <span className="devotional-label">Reflect</span>
          <p>{devotional.reflect}</p>
        </div>

        {/*
          OMITTED, not invented, when absent. One entry - #29, "Finishing Well" -
          has no prayer in the source. Generating one would put words in an
          author's mouth and would be indistinguishable from the real ones.
        */}
        {devotional.prayer ? (
          <div className="devotional-block">
            <span className="devotional-label">Prayer</span>
            <p>{devotional.prayer}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The archive: every devotional, a page at a time.
 *
 * Titles and references only. The body is deliberately not rendered here - it
 * would be most of the 237 KB, and a list exists to help someone choose, not to
 * make them read everything at once.
 */
export function DevotionalArchive({
  entries,
  page,
  activeIndex,
  readLabel,
}: {
  entries: Devotional[];
  /** 1-based page number from ?page=. */
  page: number;
  /** The devotional currently being read, so it can be marked. */
  activeIndex: number;
  readLabel?: string;
}) {
  const pages = Math.ceil(entries.length / PER_PAGE);
  const current = Math.min(Math.max(page, 1), pages);
  const start = (current - 1) * PER_PAGE;
  const slice = entries.slice(start, start + PER_PAGE);

  return (
    <section style={{ marginTop: "46px" }}>
      <div style={{ marginBottom: "16px" }}>
        <span className="eyebrow">All devotionals</span>
        <p className="where" style={{ marginTop: "8px" }}>
          {entries.length} readings - showing {start + 1}-{start + slice.length}
        </p>
      </div>

      <ul className="devotional-list">
        {slice.map((entry, offset) => {
          const index = start + offset;
          const isActive = index === activeIndex;

          return (
            <li key={index}>
              <Link
                href={`/devotionals?day=${index + 1}`}
                className={isActive ? "devotional-item is-current" : "devotional-item"}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="devotional-num">{index + 1}</span>
                <span className="devotional-title">{entry.title}</span>
                <span className="devotional-ref">{entry.verse}</span>
                <span className="devotional-go">{readLabel ?? "Read"}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Pager current={current} pages={pages} />
    </section>
  );
}

/** Plain links. Shareable, reload-proof, and no JavaScript. */
function Pager({ current, pages }: { current: number; pages: number }) {
  if (pages <= 1) return null;

  return (
    <nav className="devotional-pager" aria-label="Devotional archive pages">
      {current > 1 ? (
        <Link className="chip" href={`/devotionals?page=${current - 1}`} rel="prev">
          Previous
        </Link>
      ) : (
        <span />
      )}

      <span className="devotional-pagecount">
        Page {current} of {pages}
      </span>

      {current < pages ? (
        <Link className="chip" href={`/devotionals?page=${current + 1}`} rel="next">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/**
 * The home-page card: the whole devotional, compactly.
 *
 * Distinct from DevotionalReading (the /devotionals page) in framing, not in
 * content - a card in a grid column next to the church's introduction, using
 * the shared .devo-* styles from the approved mockup. Same rule as everything
 * in this file: it takes ONE devotional, never the collection, so the 365-entry
 * array stays server-side.
 */
export function DevotionalCard({
  devotional,
  dayNumber,
  label,
  readLabel,
}: {
  devotional: Devotional;
  dayNumber: number;
  label: string;
  readLabel: string;
}) {
  return (
    <aside className="devo">
      <div className="devo-head">
        <div>
          <span className="eyebrow">{label}</span>
          <h3>{devotional.title}</h3>
        </div>
        <span className="devo-no">No. {dayNumber}</span>
      </div>

      <blockquote className="devo-scrip">
        {devotional.scripture}
        <cite>{devotional.verse}</cite>
      </blockquote>

      <p className="devo-body">{devotional.body}</p>

      <div className="devo-block">
        <b>Reflect</b>
        <p>{devotional.reflect}</p>
      </div>

      {/* Omitted, never invented, when absent - entry #29 has no prayer. */}
      {devotional.prayer ? (
        <div className="devo-block">
          <b>Prayer</b>
          <p>{devotional.prayer}</p>
        </div>
      ) : null}

      <Link className="devo-more" href="/devotionals">
        {readLabel}
      </Link>
    </aside>
  );
}
