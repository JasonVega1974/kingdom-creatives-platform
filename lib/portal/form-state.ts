/**
 * ============================================================
 * PORTAL FORM STATE - shared shapes for useActionState
 * ============================================================
 *
 * This file exists because of a hard Next constraint, not for tidiness.
 *
 * A "use server" module may export ONLY async functions. Every export is
 * compiled into the server-actions manifest and handed a callable id, so a
 * plain object export makes the whole module fail to evaluate:
 *
 *   A "use server" file can only export async functions, found object.
 *
 * The failure is total, not partial - one bad export kills every action in
 * the file, and the symptom is a 500 on submit rather than a build error.
 *
 * TYPES are erased before the loader runs, so `export type` inside a
 * "use server" file is safe. VALUES are not. The IDLE constants below used to
 * live beside their actions and took both the Church Details and Edit My
 * Website tabs down with them.
 *
 * Nothing here is server-only, so both Server Actions and Client Components
 * can import it.
 * ============================================================
 */

/** Church Details: identity, service times, branding. */
export type DetailsState = { ok: boolean; error: string | null };

/** Edit My Website: section visibility, content, ordering. */
export type SaveState = { ok: boolean; error: string | null; savedAt: number | null };

/**
 * Initial value for useActionState. Named per-form rather than a shared
 * `IDLE`, because the two shapes differ and a single name would only be
 * ambiguous at the import site.
 *
 * Safe to share one frozen object across every form: useActionState treats it
 * as an initial value and never writes to it.
 */
export const DETAILS_IDLE: DetailsState = Object.freeze({ ok: false, error: null });

export const SAVE_IDLE: SaveState = Object.freeze({
  ok: false,
  error: null,
  savedAt: null,
});
