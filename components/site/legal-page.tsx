import type { LegalDoc } from "@/lib/legal";

/**
 * The shell every legal page renders into.
 *
 * Deliberately plain. These are documents, not marketing: one column, generous
 * measure, no brand furniture competing with the text. The `.wrap` and prose
 * tokens come from the ported site CSS so it still reads as the same website.
 */
export function LegalPage({ doc, updated }: { doc: LegalDoc; updated: string }) {
  return (
    <div className="wrap" style={{ paddingTop: "56px", paddingBottom: "84px", maxWidth: "760px" }}>
      <h1 style={{ marginBottom: "10px" }}>{doc.title}</h1>

      <p
        className="lede"
        style={{ fontSize: "13px", letterSpacing: ".04em", textTransform: "uppercase" }}
      >
        Last updated {updated}
      </p>

      {doc.intro.map((paragraph, index) => (
        <p key={index} style={{ marginTop: "16px", color: "var(--kc-ink-soft)" }}>
          {paragraph}
        </p>
      ))}

      {doc.sections.map((section) => (
        <section key={section.heading} style={{ marginTop: "40px" }}>
          <h2 style={{ fontSize: "21px", marginBottom: "12px" }}>{section.heading}</h2>
          {section.body.map((paragraph, index) => (
            <p key={index} style={{ marginTop: "12px", color: "var(--kc-ink-soft)" }}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
