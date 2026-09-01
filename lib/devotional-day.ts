/**
 * ============================================================
 * WHICH DEVOTIONAL IS TODAY'S
 * ============================================================
 *
 * A LINE-FOR-LINE PORT of YourLife CC's getDailyDevotionalIdx (app/js/faith.js
 * ~line 2737). It is reproduced exactly, quirks included, because the point is
 * that the church site and the app show the SAME devotional on the SAME day.
 * "Improving" it would silently break that.
 *
 * Deliberately not sequential. The brief described it as "Jan 1 = entry #1";
 * the real implementation is a seeded shuffle, and matching the app matters
 * more than matching the description.
 *
 * TWO CONSEQUENCES WORTH KNOWING - both are the source's behaviour, not bugs
 * introduced here:
 *
 *   1. ONLY THE FIRST 60 DEVOTIONALS EVER APPEAR AS "TODAY'S". The loop
 *      shuffles positions 1..59 only, so arr[60..364] keeps its identity
 *      ordering, and cyclePos is always < 60. Entries 60-364 are reachable in
 *      the archive but never surface through the daily rotation. The comment in
 *      the original says "no repeats within a 60-day cycle", so the 60-day
 *      window is intended; that it never reaches the other 305 looks like an
 *      oversight in the source, and copying it is what keeps the two sites in
 *      step. Worth raising with whoever owns the YourLife content.
 *
 *   2. THE DAY BOUNDARY IS THE SERVER'S. `new Date()` here runs on Vercel in
 *      UTC, whereas the app evaluates it in the reader's local zone. A visitor
 *      west of UTC can therefore see tomorrow's devotional on the website
 *      before the app agrees. Same class of thing as FF-38.
 */

/** Number of entries the shuffle is built around. Matches the source exactly. */
const CYCLE = 60;
const POOL = 365;

/**
 * Today's index into DEVOTIONALS.
 *
 * `now` is injectable purely so the behaviour can be tested against fixed
 * dates; production never passes it.
 */
export function dailyDevotionalIndex(now: Date = new Date()): number {
  // new Date(year, 0, 0) is 31 December of the previous year, so Jan 1 is 1.
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const cyclePos = dayOfYear % CYCLE;
  const seed = now.getFullYear() * 100 + Math.floor(dayOfYear / CYCLE);

  const arr = Array.from({ length: POOL }, (_, i) => i);

  /*
   * A linear congruential generator, and the `& 0xffffffff` matters: in
   * JavaScript that yields a SIGNED 32-bit integer, so `s` goes negative and
   * Math.abs() is doing real work. Reproducing the sign behaviour is what makes
   * the sequence identical to the app's rather than merely similar.
   */
  let s = seed;
  for (let i = CYCLE - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr[cyclePos];
}
