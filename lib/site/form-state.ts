/**
 * ============================================================
 * PUBLIC FORM STATE - shared shapes for useActionState
 * ============================================================
 *
 * Same reason `lib/portal/form-state.ts` exists: a "use server" module may
 * export only async functions, so the initial-value constant cannot live
 * beside the actions that use it. See that file for the full explanation -
 * one object export makes the whole module fail to evaluate, and it surfaces
 * as a 500 on submit rather than a build error.
 *
 * Separate from the portal's shapes on purpose. A public form reports success
 * to a stranger and has a success MESSAGE to show; a portal form reports to
 * someone who will look at the row they just saved.
 */

export type PublicFormState = {
  ok: boolean;
  /** Shown to the visitor when something went wrong. Never a raw DB message. */
  error: string | null;
  /** The seeded confirmation line, passed through on success. */
  message: string | null;
};

export const PUBLIC_FORM_IDLE: PublicFormState = Object.freeze({
  ok: false,
  error: null,
  message: null,
});
