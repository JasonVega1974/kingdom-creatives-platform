import type { Database } from "@/types/database";

export type ChurchTheme = Database["public"]["Tables"]["church_theme"]["Row"];

/**
 * ============================================================
 * THEME SYSTEM - church_theme row -> CSS custom properties
 * ============================================================
 *
 * Ground rule: components read variables only. Zero hardcoded brand colors
 * anywhere in components/. A church's brand is a token set, not a design.
 *
 * Every token is prefixed --kc-. shadcn/ui owns the unprefixed names
 * (--accent, --primary, --border, --radius, ...); colliding with them would
 * silently restyle every shadcn component. app/globals.css bridges the two,
 * mapping shadcn's primary/ring onto the church brand on purpose.
 *
 * WHAT THE DATABASE ACTUALLY STORES (verified against the live schema on
 * 2026-07-30 - church_theme has exactly these columns):
 *
 *   color_primary    -> --brand
 *   color_secondary  -> --accent
 *   color_accent     -> --brand-contrast  (text/icons on brand-filled surfaces)
 *   font_heading     -> --font-display
 *   font_body        -> --font-body
 *   logo_url         -> not a token; consumed directly by the header
 *
 * Everything else in the token set is DERIVED (via CSS color-mix, so a single
 * DB colour change ripples through hover states and dark bands) or comes from
 * the platform defaults below.
 *
 * The paper/ink/surface/line neutrals are deliberately NOT per-church in v1 -
 * there are no columns for them. If per-church control of the neutral ramp is
 * wanted, that is a schema change: see supabase/drafts/02_theme_tokens.sql,
 * which Jason runs manually per ground rule 0.3.
 */

export type ThemeTokens = Record<string, string>;

/** Platform defaults - BUILD_BRIEF section 4. Used when a church has no theme row. */
export const DEFAULT_THEME = {
  color_primary: "#1F4D3A", // pine green
  color_secondary: "#C9A227", // muted brass
  color_accent: "#FDFBF5", // near-white, for text on brand fills
  font_heading: "Fraunces",
  font_body: "Source Sans 3",
} satisfies Pick<
  ChurchTheme,
  "color_primary" | "color_secondary" | "color_accent" | "font_heading" | "font_body"
>;

/**
 * Fonts the platform can serve. Each is loaded once in app/layout.tsx via
 * next/font (self-hosted, no external request) and exposed as a CSS variable.
 * A church_theme font name is matched against these keys; anything unknown
 * falls back to the platform default rather than breaking the page.
 *
 * To add a font: load it in app/layout.tsx and add the entry here. Both steps
 * are required - next/font is build-time, so arbitrary DB font names cannot be
 * fetched at request time.
 */
export const FONT_STACKS: Record<string, { var: string; role: "display" | "body" | "both" }> = {
  fraunces: { var: "--font-fraunces", role: "display" },
  lora: { var: "--font-lora", role: "display" },
  "source sans 3": { var: "--font-source-sans", role: "body" },
  "source sans pro": { var: "--font-source-sans", role: "body" },
  inter: { var: "--font-inter", role: "both" },
  "ibm plex mono": { var: "--font-plex-mono", role: "body" },
};

const DISPLAY_FALLBACK = "Georgia, 'Times New Roman', serif";
const BODY_FALLBACK = "system-ui, -apple-system, 'Segoe UI', sans-serif";

function normalizeFontKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

function fontStack(name: string | null | undefined, fallbackName: string, fallbackStack: string): string {
  const entry = FONT_STACKS[normalizeFontKey(name)] ?? FONT_STACKS[normalizeFontKey(fallbackName)];
  return entry ? `var(${entry.var}), ${fallbackStack}` : fallbackStack;
}

/** #abc / #aabbcc / aabbcc -> #aabbcc. Returns null for anything unparseable. */
function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim().replace(/^#/, "");

  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) {
    return `#${raw}`.toUpperCase();
  }
  return null;
}

/**
 * Build the full CSS variable set for a church.
 *
 * Pass null (no theme row, or the fetch failed) and you get the platform
 * defaults - a themed page always renders, it is never unstyled.
 */
export function buildThemeTokens(theme: ChurchTheme | null): ThemeTokens {
  const brand = normalizeHex(theme?.color_primary) ?? DEFAULT_THEME.color_primary;
  const accent = normalizeHex(theme?.color_secondary) ?? DEFAULT_THEME.color_secondary;
  const brandContrast = normalizeHex(theme?.color_accent) ?? DEFAULT_THEME.color_accent;

  return {
    // ---- brand ramp (derived from the single stored primary) ----
    "--kc-brand": brand,
    "--kc-brand-deep": `color-mix(in srgb, ${brand} 80%, #000000)`,
    "--kc-brand-night": `color-mix(in srgb, ${brand} 26%, #100A06)`,
    "--kc-brand-contrast": brandContrast,
    "--kc-brand-wash": `color-mix(in srgb, ${brand} 8%, #FFFFFF)`,
    // Light brand tint, for text and rules sitting on --kc-brand-night bands.
    // Derived from brand, not accent, because that is how the prototype uses it.
    "--kc-brand-soft": `color-mix(in srgb, ${brand} 45%, #FFFFFF)`,

    // ---- accent ----
    "--kc-accent": accent,

    // ---- neutrals (platform-wide in v1 - no DB columns for these) ----
    "--kc-paper": "#FAF7F0",
    "--kc-paper-dim": "#F3EADF",
    "--kc-surface": "#FFFFFF",
    "--kc-ink": "#22271F",
    "--kc-ink-soft": "#6B5D51",
    "--kc-line": "#E3D5C6",

    // ---- typography ----
    "--kc-font-display": fontStack(theme?.font_heading, DEFAULT_THEME.font_heading, DISPLAY_FALLBACK),
    "--kc-font-body": fontStack(theme?.font_body, DEFAULT_THEME.font_body, BODY_FALLBACK),
    "--kc-font-utility": "var(--font-plex-mono), ui-monospace, monospace",

    // ---- shape ----
    "--kc-radius": "10px",
    "--kc-shadow": "0 2px 6px rgb(0 0 0 / 0.06), 0 12px 32px rgb(0 0 0 / 0.10)",
  };
}
