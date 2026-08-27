"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NAV } from "@/lib/portal/nav";
import { cn } from "@/lib/utils";

/**
 * Portal sidebar.
 *
 * Client-side only for the active-link highlight and the mobile drawer. The
 * nav content itself is a static import, so no church data crosses the
 * boundary beyond the name in the header.
 */
export function PortalNav({ churchName }: { churchName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile: a bar with the toggle. Hidden once the sidebar is permanent. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="portal-sidebar"
        className="fixed bottom-4 left-4 z-50 rounded-full bg-[var(--kc-brand)] px-5 py-3 text-sm font-semibold text-[var(--kc-brand-contrast)] shadow-lg md:hidden"
      >
        {open ? "Close menu" : "Menu"}
      </button>

      <nav
        id="portal-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[264px] shrink-0 overflow-y-auto border-r border-[var(--kc-line)] bg-[var(--kc-surface)] px-3 py-5 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 px-3">
          <p className="font-[family-name:var(--kc-font-display)] text-lg leading-tight font-semibold">
            {churchName}
          </p>
          <p className="text-xs tracking-wide text-[var(--kc-ink-soft)] uppercase">
            Pastor Portal
          </p>
        </div>

        {NAV.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1 px-3 text-[11px] font-semibold tracking-[0.08em] text-[var(--kc-ink-soft)] uppercase">
              {group.label}
            </p>

            <ul>
              {group.items.map((item) => {
                // Exact match only. A prefix match would light up "Home" on
                // every page, since its href is the portal root.
                const active = pathname === item.href;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[var(--kc-radius)] px-3 py-2 text-[15px] transition-colors",
                        active
                          ? "bg-[var(--kc-brand-wash)] font-semibold text-[var(--kc-brand-deep)]"
                          : "hover:bg-[var(--kc-paper-dim)]",
                      )}
                    >
                      <span aria-hidden className="w-5 text-center">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {!item.built && (
                        <span className="rounded-full bg-[var(--kc-paper-dim)] px-1.5 py-0.5 text-[10px] tracking-wide text-[var(--kc-ink-soft)] uppercase">
                          Soon
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}
    </>
  );
}
