import "server-only";

/**
 * ============================================================
 * BIBLE PASSAGE PROVIDERS
 * ============================================================
 *
 * One interface, swappable implementations. Decision B1 picked bible-api.com
 * for v1 because it needs no key and no signup, so /bible ships today. ESV is
 * the likely upgrade once its licensing is settled for a paid multi-tenant
 * platform - that question is open and is not an engineering one.
 *
 * ATTRIBUTION TRAVELS WITH THE PASSAGE, deliberately. Every provider has
 * different credit requirements, and several make correct attribution a
 * licence condition rather than a courtesy. Hardcoding "World English Bible"
 * into the page would become quietly false the moment the provider changed -
 * which is the exact failure a swappable adapter is supposed to prevent. So
 * `attribution` is part of the returned passage, and the renderer prints
 * whatever came back with the text.
 *
 * KEYS ARE SERVER-SIDE ONLY. This module is "server-only" and every provider
 * reads its credential from process.env at call time. Ground rule 6 exists
 * because the old WordPress system shipped a YouTube key to the browser.
 */

export type BibleReading = {
  /** Canonical reference as the provider resolved it, e.g. "John 3". */
  reference: string;
  /** Plain text. Paragraphs separated by blank lines. */
  text: string;
  /** Short translation name, e.g. "WEB". Shown next to the reference. */
  translation: string;
  /**
   * The credit line this provider requires. Printed verbatim beneath the
   * passage. Never assembled by the caller.
   */
  attribution: string;
};

export type BibleProvider = {
  /** Stable id, so a page can say which source answered. */
  id: string;
  /** Human name for logs and the dev banner. */
  label: string;
  /** True when the provider has what it needs to run (a key, usually). */
  isConfigured(): boolean;
  fetchPassage(book: string, chapter: number): Promise<BibleReading | null>;
};

/**
 * Passages are immutable, so cache hard. A day is arbitrary but generous; the
 * text will not change and the only cost of a stale entry is nothing at all.
 */
const PASSAGE_TTL_SECONDS = 86_400;

/**
 * bible-api.com - no key, no signup, public-domain translations.
 *
 * Default translation is WEB (World English Bible), which is public domain and
 * modern enough to read aloud. KJV is available but was not chosen: an audience
 * of working drivers does not need Jacobean English between them and the text.
 */
const bibleApiProvider: BibleProvider = {
  id: "bible-api",
  label: "bible-api.com (WEB)",

  isConfigured() {
    // No credential required. That is the whole reason it was chosen for v1.
    return true;
  },

  async fetchPassage(book, chapter) {
    // The API takes "john+3". encodeURIComponent leaves "+" alone, so build the
    // reference with a space and let encodeURIComponent produce %20 - the API
    // accepts both and %20 cannot be misread as a "+" that was part of a name.
    const reference = encodeURIComponent(`${book} ${chapter}`);
    const url = `https://bible-api.com/${reference}?translation=web`;

    try {
      const res = await fetch(url, {
        next: { revalidate: PASSAGE_TTL_SECONDS },
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        reference?: string;
        text?: string;
        translation_id?: string;
        translation_name?: string;
        translation_note?: string;
      };

      if (!data.text) return null;

      return {
        reference: data.reference ?? `${book} ${chapter}`,
        // The API returns verses run together with newlines mid-sentence.
        // Collapse to paragraphs so it reads as prose rather than a list.
        text: data.text.replace(/\s*\n\s*/g, " ").trim(),
        translation: (data.translation_id ?? "web").toUpperCase(),
        attribution:
          [data.translation_name, data.translation_note].filter(Boolean).join(". ") ||
          "World English Bible. Public Domain.",
      };
    } catch {
      // A network failure is not a missing passage. The caller renders the
      // seeded error line either way, but this keeps it off the error boundary.
      return null;
    }
  },
};

/**
 * ESV (api.esv.org).
 *
 * IMPLEMENTED, BUT STILL OPT-IN. Nothing changes until KC_BIBLE_PROVIDER=esv
 * AND ESV_API_KEY are both set. A key on its own does nothing, which is
 * deliberate - see the licensing note below.
 *
 * THE OPEN QUESTION IS LICENSING, NOT CODE (FF-36). Crossway's API terms are
 * oriented to non-commercial use with attribution and caching conditions, and
 * whether they cover redistributing ESV text across many churches' sites on a
 * paid platform has not been answered. This adapter existing does not answer
 * it. Requiring the explicit env var is what keeps "we have a key" from
 * quietly becoming "we are redistributing ESV to every tenant".
 *
 * ATTRIBUTION IS A LICENCE CONDITION. The API returns no credit field, so the
 * required line is a constant here and is printed verbatim with every passage.
 * If Crossway changes its required wording, this string is what must change.
 */
const ESV_CREDIT =
  "Scripture quotations are from the ESV(R) Bible (The Holy Bible, English " +
  "Standard Version(R)), copyright (c) 2001 by Crossway, a publishing ministry " +
  "of Good News Publishers. Used by permission. All rights reserved.";

const esvProvider: BibleProvider = {
  id: "esv",
  label: "ESV (api.esv.org)",

  isConfigured() {
    return Boolean(process.env.ESV_API_KEY);
  },

  async fetchPassage(book, chapter) {
    const key = process.env.ESV_API_KEY;
    // isConfigured() gates selection, but a provider must not assume it was
    // asked politely - this is also reachable if PROVIDERS is called directly.
    if (!key) return null;

    /*
     * Ask for prose, not an apparatus. Headings, footnotes and horizontal
     * rules are markup for a study Bible and become noise in a plain-text
     * field. The short copyright is suppressed because we print the full
     * required credit ourselves rather than a truncated "(ESV)".
     */
    const params = new URLSearchParams({
      q: `${book} ${chapter}`,
      "include-passage-references": "false",
      "include-verse-numbers": "true",
      "include-first-verse-numbers": "true",
      "include-footnotes": "false",
      "include-footnote-body": "false",
      "include-headings": "false",
      "include-short-copyright": "false",
      "include-passage-horizontal-lines": "false",
      "include-heading-horizontal-lines": "false",
      "indent-paragraphs": "0",
      "indent-poetry-lines": "0",
    });

    try {
      const res = await fetch(`https://api.esv.org/v3/passage/text/?${params}`, {
        headers: { Authorization: `Token ${key}` },
        next: { revalidate: PASSAGE_TTL_SECONDS },
      });

      if (!res.ok) {
        // 401 means the key is wrong or revoked, and that is worth saying out
        // loud - it is otherwise indistinguishable from "chapter not found",
        // and the page would silently fall back to WEB text forever.
        console.error(
          `[bible] ESV request failed with ${res.status} for "${book} ${chapter}"` +
            (res.status === 401 ? " - check ESV_API_KEY" : ""),
        );
        return null;
      }

      const data = (await res.json()) as {
        canonical?: string;
        passages?: string[];
      };

      const raw = data.passages?.join("\n\n") ?? "";
      if (!raw.trim()) return null;

      return {
        reference: data.canonical?.trim() || `${book} ${chapter}`,
        /*
         * ESV wraps prose at ~70 columns, so a paragraph arrives as several
         * lines. Collapsing every newline (as the bible-api adapter does)
         * would run poetry and paragraph breaks together into one block, so
         * blank lines are preserved as paragraph boundaries and only the
         * wrapping newlines inside a paragraph are folded away.
         */
        text: raw
          .replace(/\r/g, "")
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
          .filter(Boolean)
          .join("\n\n"),
        translation: "ESV",
        attribution: ESV_CREDIT,
      };
    } catch {
      // A network failure is not a missing passage - same reasoning as
      // bible-api above. The caller renders the seeded error line either way.
      return null;
    }
  },
};

const PROVIDERS: Record<string, BibleProvider> = {
  [bibleApiProvider.id]: bibleApiProvider,
  [esvProvider.id]: esvProvider,
};

/**
 * The active provider.
 *
 * `KC_BIBLE_PROVIDER` selects one; absent or unrecognised falls back to
 * bible-api. The fallback is deliberate: a typo in an env var should degrade to
 * a working Bible page, not an empty one.
 *
 * A provider that is selected but not configured also falls back, so setting
 * the name before the key exists does not take /bible down.
 */
export function getBibleProvider(): BibleProvider {
  const requested = process.env.KC_BIBLE_PROVIDER;
  const chosen = requested ? PROVIDERS[requested] : undefined;

  if (chosen && chosen.isConfigured()) return chosen;

  if (requested && !chosen) {
    console.warn(`[bible] unknown KC_BIBLE_PROVIDER "${requested}" - using bible-api`);
  } else if (chosen) {
    console.warn(`[bible] provider "${requested}" is not configured - using bible-api`);
  }

  return bibleApiProvider;
}

/**
 * Chapter numbers arrive from the URL, so they are attacker-controlled.
 *
 * 150 is the longest book in the canon (Psalms). Anything outside 1-150 is not
 * a chapter, and clamping rather than erroring means a hand-edited URL shows a
 * real passage instead of an error page.
 */
export function normalizeChapter(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 150) return fallback;
  return parsed;
}

/**
 * Only books the church put in its own reader list are accepted.
 *
 * The seeded `books` array is the allow-list, so an arbitrary string from the
 * query never reaches the provider URL. Falls back to the section's default.
 */
export function normalizeBook(
  value: string | null | undefined,
  allowed: string[],
  fallback: string,
): string {
  if (!value) return fallback;
  const match = allowed.find((book) => book.toLowerCase() === value.toLowerCase());
  return match ?? fallback;
}
