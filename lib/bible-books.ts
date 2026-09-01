/**
 * ============================================================
 * THE CANON - 66 books and their chapter counts
 * ============================================================
 *
 * WHY THIS IS CODE AND NOT church_sections DATA
 *
 * The allow-list used to be the church's seeded `books` array, which held six
 * entries. So `?book=Genesis` silently fell back to Psalms, and the chapter
 * dropdown offered 1-150 for every book - 149 dead options for Philemon.
 *
 * The canon is not tenant data. It is the same for every church, a pastor
 * should not be able to delete Genesis, and a new tenant should not need a data
 * migration before Genesis exists. Same reasoning as lib/legal.ts.
 *
 * The seeded `books` array is not discarded - it becomes the quick-links row,
 * which is what it actually was: the church's own curation, like Psalms 121 as
 * "the driver's psalm".
 *
 * A WRONG COUNT IS SILENT. It is either a chapter nobody can reach or a link to
 * a chapter that does not exist, and nothing in tsc, eslint or next build can
 * see it. So the totals are asserted below against the canon's own checksums
 * rather than trusted: 66 books, 1189 chapters, 929 Old Testament, 260 New.
 * Those catch a typo in a book nobody thinks to spot-check, which a handful of
 * eyeballed examples would not.
 *
 * Names are spelled as bible-api.com and api.esv.org both accept them.
 */

export type Testament = "old" | "new";

export type BibleBook = {
  name: string;
  chapters: number;
  testament: Testament;
};

const OLD_TESTAMENT: [string, number][] = [
  ["Genesis", 50],
  ["Exodus", 40],
  ["Leviticus", 27],
  ["Numbers", 36],
  ["Deuteronomy", 34],
  ["Joshua", 24],
  ["Judges", 21],
  ["Ruth", 4],
  ["1 Samuel", 31],
  ["2 Samuel", 24],
  ["1 Kings", 22],
  ["2 Kings", 25],
  ["1 Chronicles", 29],
  ["2 Chronicles", 36],
  ["Ezra", 10],
  ["Nehemiah", 13],
  ["Esther", 10],
  ["Job", 42],
  ["Psalms", 150],
  ["Proverbs", 31],
  ["Ecclesiastes", 12],
  ["Song of Solomon", 8],
  ["Isaiah", 66],
  ["Jeremiah", 52],
  ["Lamentations", 5],
  ["Ezekiel", 48],
  ["Daniel", 12],
  ["Hosea", 14],
  ["Joel", 3],
  ["Amos", 9],
  ["Obadiah", 1],
  ["Jonah", 4],
  ["Micah", 7],
  ["Nahum", 3],
  ["Habakkuk", 3],
  ["Zephaniah", 3],
  ["Haggai", 2],
  ["Zechariah", 14],
  ["Malachi", 4],
];

const NEW_TESTAMENT: [string, number][] = [
  ["Matthew", 28],
  ["Mark", 16],
  ["Luke", 24],
  ["John", 21],
  ["Acts", 28],
  ["Romans", 16],
  ["1 Corinthians", 16],
  ["2 Corinthians", 13],
  ["Galatians", 6],
  ["Ephesians", 6],
  ["Philippians", 4],
  ["Colossians", 4],
  ["1 Thessalonians", 5],
  ["2 Thessalonians", 3],
  ["1 Timothy", 6],
  ["2 Timothy", 4],
  ["Titus", 3],
  ["Philemon", 1],
  ["Hebrews", 13],
  ["James", 5],
  ["1 Peter", 5],
  ["2 Peter", 3],
  ["1 John", 5],
  ["2 John", 1],
  ["3 John", 1],
  ["Jude", 1],
  ["Revelation", 22],
];

export const BOOKS: BibleBook[] = [
  ...OLD_TESTAMENT.map(([name, chapters]) => ({ name, chapters, testament: "old" as const })),
  ...NEW_TESTAMENT.map(([name, chapters]) => ({ name, chapters, testament: "new" as const })),
];

/**
 * Checksums, verified at module load.
 *
 * These are properties of the canon, not of this file, which is exactly what
 * makes them useful: a mistyped count changes a total and is caught here even
 * if nobody ever opens that book. Throwing at import is deliberate - a Bible
 * page with a wrong chapter count should fail loudly in development rather than
 * ship a dead link.
 */
const TOTALS = { books: 66, chapters: 1189, old: 929, new: 260 } as const;

function sum(books: BibleBook[]): number {
  return books.reduce((total, book) => total + book.chapters, 0);
}

if (BOOKS.length !== TOTALS.books) {
  throw new Error(`[bible] canon has ${BOOKS.length} books, expected ${TOTALS.books}`);
}
if (sum(BOOKS) !== TOTALS.chapters) {
  throw new Error(`[bible] canon has ${sum(BOOKS)} chapters, expected ${TOTALS.chapters}`);
}
if (sum(BOOKS.filter((b) => b.testament === "old")) !== TOTALS.old) {
  throw new Error("[bible] Old Testament chapter total is wrong");
}
if (sum(BOOKS.filter((b) => b.testament === "new")) !== TOTALS.new) {
  throw new Error("[bible] New Testament chapter total is wrong");
}

const BY_NAME = new Map(BOOKS.map((book) => [book.name.toLowerCase(), book]));

/** The canonical book, or null. Case-insensitive. */
export function findBook(name: string | null | undefined): BibleBook | null {
  if (!name) return null;
  return BY_NAME.get(name.trim().toLowerCase()) ?? null;
}

/** Books of one testament, in canonical order. */
export function booksIn(testament: Testament): BibleBook[] {
  return BOOKS.filter((book) => book.testament === testament);
}

/**
 * A book name from the URL, resolved against the canon.
 *
 * Replaces the old allow-list of six seeded books. Anything unrecognised falls
 * back rather than erroring, so a hand-edited URL shows a real passage.
 */
export function resolveBook(value: string | null | undefined, fallback: string): BibleBook {
  return findBook(value) ?? findBook(fallback) ?? BOOKS[0];
}

/**
 * A chapter number clamped to what the BOOK actually has.
 *
 * The old version clamped to 1-150 globally, which is only correct for Psalms.
 * Asking bible-api or ESV for Philemon 7 returns nothing useful, and offering
 * it in a picker is a link that cannot work.
 */
export function resolveChapter(book: BibleBook, value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > book.chapters) return 1;
  return parsed;
}
