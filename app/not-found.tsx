/**
 * Shown when a hostname resolves to no church, and (from Phase B) when a page
 * slug does not exist for the resolved church.
 *
 * Uses the platform default tokens from app/globals.css - by definition there
 * is no tenant theme to apply here.
 */
export default function NotFound() {
  return (
    <div className="kc-site flex min-h-full flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-utility text-xs uppercase tracking-[0.16em] text-brand">404</p>
      <h1 className="mt-3 text-4xl text-ink">We could not find that page.</h1>
      <p className="mt-4 max-w-[46ch] text-ink-soft">
        If you typed the address, check it for a typo. Otherwise this church site may not be
        set up yet.
      </p>
      <p className="mt-10 font-utility text-xs text-ink-soft">Powered by Kingdom Creatives</p>
    </div>
  );
}
