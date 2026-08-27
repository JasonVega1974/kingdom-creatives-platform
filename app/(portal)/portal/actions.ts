"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Portal auth actions.
 *
 * Kept separate from the feature actions in each tab folder because these two
 * are the only ones that legitimately run without an existing session.
 */

export type SignInState = { error: string | null };

/**
 * Email + password sign-in.
 *
 * Deliberately does not distinguish "no such account" from "wrong password":
 * a portal login page is a public URL on a church's own domain, and telling a
 * stranger which pastor emails exist is not worth the small UX gain.
 *
 * Membership is NOT checked here. A valid Supabase user who is not a member of
 * this church signs in successfully and lands on /portal/no-access, which can
 * explain the situation. Failing at the password box would be indistinguishable
 * from a typo and would strand anyone whose invite has not been approved yet.
 */
export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email address and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "That email address and password do not match." };
  }

  redirect("/portal");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}
