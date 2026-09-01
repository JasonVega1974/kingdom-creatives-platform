import Link from "next/link";

import type { Devotional } from "@/lib/devotionals";

/**
 * ============================================================
 * TODAY'S DEVOTIONAL - the home page teaser
 * ============================================================
 *
 * A SERVER COMPONENT taking ONE devotional, never the collection. That is the
 * size control: lib/devotionals.ts is ~253 KB and marked "server-only", the
 * page picks today's entry on the server, and the browser receives the markup
 * for one teaser. The array is never serialised anywhere near the client.
 *
 * It takes a Devotional rather than reaching for the data itself, so it has no
 * opinion about where devotionals live - the same rule as the archive
 * components, and what makes a future per-church table a caller-only change.
 *
 * WHY THE SCRIPTURE AND NOT THE BODY. A teaser gets one line. The scripture
 * text is a complete thought and runs to about 89 characters typically; the
 * body runs to 242 and would have to be cut mid-sentence into a fragment. The
 * verse is also the thing that makes someone stop, which is what a teaser is
 * for.
 */
export function DevotionalTeaser({
  devotional,
  label = "Today's devotional",
  readLabel = "Read today's devotional",
}: {
  devotional: Devotional;
  label?: string;
  readLabel?: string;
}) {
  return (
    <div className="wrap" style={{ paddingBottom: "76px" }}>
      <aside className="devotional-teaser">
        <div className="devotional-teaser-copy">
          <span className="eyebrow">{label}</span>
          <h2>{devotional.title}</h2>
          <p className="devotional-teaser-ref">{devotional.verse}</p>
          <p className="devotional-teaser-line">{devotional.scripture}</p>
        </div>

        <div className="devotional-teaser-go">
          <Link className="btn btn-ghost" href="/devotionals">
            {readLabel}
          </Link>
        </div>
      </aside>
    </div>
  );
}
