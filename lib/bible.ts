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
 * ESV (api.esv.org) - a key exists but is NOT wired up.
 *
 * Left as a documented stub rather than working code on purpose. ESV's terms
 * are oriented to non-commercial use with attribution and caching conditions,
 * and whether they cover redistributing ESV text across many churches' sites on
 * a paid platform is an open legal question, not a technical one. Shipping a
 * working implementation would make it trivially easy to enable before that is
 * answered.
 *
 * To finish it when the answer comes back: set ESV_API_KEY, implement
 * fetchPassage against GET https://api.esv.org/v3/passage/text/ with an
 * `Authorization: Token <key>` header, and return their required credit line as
 * `attribution` - which is a licence condition, not a courtesy.
 */
const esvProvider: BibleProvider = {
  id: "esv",
  label: "ESV (api.esv.org)",

  isConfigured() {
    return Boolean(process.env.ESV_API_KEY);
  },

  async fetchPassage() {
    throw new Error(
      "ESV provider is not implemented. Licensing for multi-tenant use is unresolved - see lib/bible.ts and FF-36.",
    );
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
