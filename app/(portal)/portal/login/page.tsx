import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/portal/login-form";
import { getPortalSession } from "@/lib/portal/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function PortalLoginPage() {
  // Already signed in and a member: nothing to do here.
  if (await getPortalSession()) redirect("/portal");

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-[family-name:var(--kc-font-display)] text-2xl font-semibold">
          Pastor Portal
        </h1>
        <p className="mt-1 mb-6 text-sm text-[var(--kc-ink-soft)]">
          Sign in to manage your church website.
        </p>

        <LoginForm />
      </div>
    </div>
  );
}
