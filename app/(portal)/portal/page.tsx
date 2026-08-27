import Link from "next/link";

import { requirePortalUser } from "@/lib/portal/auth";
import { parseServiceTimes } from "@/lib/church";
import { createClient } from "@/lib/supabase/server";

/**
 * Portal home. A short answer to "what is my church's website doing right now".
 *
 * Counts only - no editing. The prototype's dashboard is a landing pad, and
 * anything actionable belongs in the tab that owns it.
 */
export default async function PortalHomePage() {
  const { site, email } = await requirePortalUser();
  const supabase = await createClient();

  // head:true returns the count without the rows. One round trip each, in
  // parallel; a failure degrades to a dash rather than taking down the page.
  const [sermons, events, announcements, prayer] = await Promise.all([
    supabase
      .from("sermons")
      .select("id", { count: "exact", head: true })
      .eq("church_id", site.church.id),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("church_id", site.church.id),
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("church_id", site.church.id)
      .eq("visible", true),
    supabase
      .from("prayer_requests")
      .select("id", { count: "exact", head: true })
      .eq("church_id", site.church.id)
      .eq("status", "pending"),
  ]);

  const services = parseServiceTimes(site.church.service_times);

  return (
    <div className="max-w-3xl">
      <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-semibold">
        Welcome back
      </h1>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        {email ? `${email} - ` : ""}
        {site.church.name ?? "Your church"}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sermons" value={sermons.count} />
        <Stat label="Events" value={events.count} />
        <Stat label="Announcements showing" value={announcements.count} />
        <Stat label="Prayer requests waiting" value={prayer.count} />
      </div>

      <section className="mt-7 rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
        <h2 className="font-[family-name:var(--kc-font-display)] text-xl font-semibold">
          When you meet
        </h2>

        {services.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--kc-ink-soft)]">
            No service times set yet.{" "}
            <Link href="/portal/details" className="font-semibold underline underline-offset-4">
              Add them
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {services.map((service, i) => (
              <li key={i}>
                <span className="font-semibold">
                  {[service.day, service.time].filter(Boolean).join(" ")}
                </span>
                {service.label ? ` - ${service.label}` : ""}
                {service.streaming ? " (streamed)" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href="/portal/website"
          className="rounded-[var(--kc-radius)] bg-[var(--kc-brand)] px-4 py-2.5 font-semibold text-[var(--kc-brand-contrast)]"
        >
          Edit my website
        </Link>
        <Link
          href="/portal/details"
          className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-4 py-2.5 font-semibold hover:bg-[var(--kc-paper-dim)]"
        >
          Church details
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-4">
      <p className="font-[family-name:var(--kc-font-display)] text-3xl font-semibold">
        {value ?? "-"}
      </p>
      <p className="mt-0.5 text-sm text-[var(--kc-ink-soft)]">{label}</p>
    </div>
  );
}
