import type { Church } from "@/lib/church";

/**
 * Phase A footer: contact details from the churches row.
 * Map, social links and nav columns are Phase B.
 */
export function SiteFooter({ church }: { church: Church }) {
  const name = church.name ?? church.slug;

  return (
    <footer className="mt-auto bg-brand-night text-brand-soft">
      <div className="mx-auto max-w-[1120px] px-6 py-14">
        <p className="font-display text-2xl text-[color:var(--kc-brand-contrast)]">{name}</p>

        <address className="mt-4 space-y-1 text-[15px] not-italic opacity-90">
          {church.address ? <p>{church.address}</p> : null}
          {church.email ? (
            <p>
              <a className="underline-offset-4 hover:underline" href={`mailto:${church.email}`}>
                {church.email}
              </a>
            </p>
          ) : null}
          {church.phone ? (
            <p>
              <a className="underline-offset-4 hover:underline" href={`tel:${church.phone}`}>
                {church.phone}
              </a>
            </p>
          ) : null}
        </address>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[1120px] px-6 py-5 font-utility text-xs opacity-70">
          Powered by Kingdom Creatives
        </div>
      </div>
    </footer>
  );
}
