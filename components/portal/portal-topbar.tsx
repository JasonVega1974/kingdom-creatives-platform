import { signOut } from "@/app/(portal)/portal/actions";

/**
 * Portal top bar: where you are, where your website is, and how to leave.
 *
 * A Server Component - the sign-out button posts to a Server Action, so there
 * is no client bundle for it and no session handling in the browser.
 */
export function PortalTopbar({
  churchName,
  email,
  siteUrl,
}: {
  churchName: string;
  email: string | null;
  siteUrl: string;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--kc-line)] bg-[var(--kc-surface)] px-5 py-3 md:px-9">
      <p className="min-w-0 flex-1 truncate text-sm text-[var(--kc-ink-soft)]">
        Signed in{email ? ` as ${email}` : ""} - editing{" "}
        <span className="font-semibold text-[var(--kc-ink)]">{churchName}</span>
      </p>

      <a
        href={siteUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-semibold text-[var(--kc-brand-deep)] underline-offset-4 hover:underline"
      >
        View my website
      </a>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm hover:bg-[var(--kc-paper-dim)]"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
