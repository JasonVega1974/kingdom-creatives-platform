import type { Metadata } from "next";

import { signOut } from "@/app/(portal)/portal/actions";
import { getCurrentChurchSite } from "@/lib/church";

export const metadata: Metadata = { title: "No access" };

/**
 * Signed in, but not a member of the church this hostname belongs to.
 *
 * Distinct from the login screen on purpose: sending a signed-in user back to
 * a password box tells them nothing and invites them to retype a password that
 * was never the problem.
 */
export default async function NoAccessPage() {
  const site = await getCurrentChurchSite();
  const name = site?.church.name ?? "this church";

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <h1 className="font-[family-name:var(--kc-font-display)] text-2xl font-semibold">
          You are signed in, but not for {name}
        </h1>
        <p className="mt-3 text-[var(--kc-ink-soft)]">
          Your account does not have access to this church&apos;s portal yet. If
          you were expecting access, ask whoever set up your account to add you -
          it takes them about a minute.
        </p>

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-4 py-2 font-semibold hover:bg-[var(--kc-paper-dim)]"
          >
            Sign in as someone else
          </button>
        </form>
      </div>
    </div>
  );
}
