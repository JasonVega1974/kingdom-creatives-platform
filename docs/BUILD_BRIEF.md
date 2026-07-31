# Kingdom Creatives Church Platform — Claude Code Build Brief

**Project:** Multi-tenant church website platform (WordPress multisite replacement)
**Stack:** Next.js (App Router, TypeScript) + Supabase + Vercel + shadcn/ui + Stripe + Brevo + Anthropic API
**Pilot tenant:** `church-for-truckers` → churchfortruckers.org (currently live on WP; stays live until cutover)
**Status:** Backend schema DONE. This brief covers the frontend/app build only.

---

## 0. Ground rules (read first, apply always)

These override anything else in this document.

1. **Never run `git push --force`.** Ever.
2. **Show full diffs before committing.** Per-file commits. No pushes without explicit approval from Jason.
3. **No schema changes without SQL first.** The Supabase schema already exists (project `cyyxhhwuyeyvewqrhewt`). If a change is genuinely needed, draft the SQL and stop — Jason runs it in the Supabase SQL editor manually and pastes results back. There is no Supabase MCP/auto-execute. Never assume a migration ran.
4. **Verify live, don't trust reports.** After any deploy, check the actual deployed behavior before declaring done.
5. **Do not redesign the backend.** 13 tables exist with RLS enabled: `churches`, `church_theme`, `church_members`, `church_sections`, `sermons`, `events`, `contacts`, `documents`, `support_tickets`, `staff`, `gallery`, `videos`, `templates`. Storage buckets: `gallery` (public), `documents` (private), both RLS-scoped by folder path `{church_id}/filename`. Build against what exists; ask before assuming a column exists.
6. **All API keys server-side only.** History note: the old WP system leaked a YouTube API key client-side. YouTube, Stripe secret, Brevo, and Anthropic keys live only in Vercel env vars and are only used in Route Handlers / Server Actions / Edge Functions. The only keys allowed in the browser are `NEXT_PUBLIC_SUPABASE_URL` and the anon key.
7. **ASCII straight quotes only** in source files.
8. **WordPress stays untouched.** The old multisite (Cloudways) is live and serving churchfortruckers.org until cutover. Nothing in this build touches it.

---

## 1. Architecture overview

```
Browser
  │
  ├── Public church site (SSR/ISR) ── hostname → tenant resolution → RLS-scoped reads
  │
  └── Pastor Portal (/portal, auth'd) ── Supabase Auth session → church_members role → RLS-scoped CRUD
  │
Vercel (Next.js App Router)
  ├── middleware.ts ......... hostname → church_id resolution (mirrors EstateSaleBiz pattern)
  ├── Route Handlers ........ /api/stripe/*, /api/youtube-sync, /api/ai/sermon (streaming), /api/contact
  └── ISR revalidation ...... on-demand revalidate per church on portal saves
  │
Supabase (cyyxhhwuyeyvewqrhewt)
  ├── Postgres + RLS (13 tables, already built)
  ├── Auth (pastors/staff)
  └── Storage: gallery (public) / documents (private)
  │
External: Stripe (giving) · YouTube Data API (sermon sync) · Brevo (transactional email) · Anthropic API (AI builder)
```

### Tenant resolution (mirrors EstateSaleBiz)

- `middleware.ts` reads `request.headers.get('host')`.
- Resolution order: exact match on `churches.domain` (custom domain, e.g. churchfortruckers.org) → subdomain match on `{slug}.kingdom-creatives.com` → 404/marketing fallback.
- Resolved `church_id` + `slug` passed via request headers (`x-church-id`, `x-church-slug`) to server components. Never trust a client-supplied church id.
- Cache the hostname→church lookup (in-memory per lambda + short TTL) — it runs on every request.
- **Known constraint from EstateSaleBiz:** wildcard `*.kingdom-creatives.com` on Vercel requires Vercel nameserver authority. Assume **manual per-church domain adds in Vercel** as the workaround until/unless nameservers move. Build the code hostname-generic so either works.

### Rendering strategy

- Public church pages: **ISR** (revalidate ~60s) + **on-demand revalidation** — every portal save calls `revalidatePath`/`revalidateTag` for that church's public routes so "autosave with live preview" also means fast public propagation.
- Portal: fully dynamic, client components where interactive, server actions for mutations.

---

## 2. Repo structure

```
kingdom-creatives-platform/
├── BUILD_BRIEF.md            ← this file
├── CLAUDE.md                 ← standing rules (extract §0 here)
├── middleware.ts
├── app/
│   ├── (public)/
│   │   ├── layout.tsx        ← injects theme CSS variables from church_theme
│   │   └── page.tsx          ← section renderer driven by church_sections
│   ├── portal/
│   │   ├── layout.tsx        ← sidebar shell, auth guard
│   │   ├── site-editor/  theme/  sermons/  ai-builder/  events/
│   │   ├── staff/  gallery/  contacts/  giving/  documents/
│   ├── api/
│   │   ├── stripe/checkout/route.ts
│   │   ├── stripe/webhook/route.ts
│   │   ├── youtube-sync/route.ts
│   │   ├── ai/sermon/route.ts        ← streaming
│   │   └── contact/route.ts          ← Brevo send + contacts insert
│   └── login/
├── components/
│   ├── sections/             ← Hero, About, LatestSermon, Events, Giving, Footer (public)
│   ├── portal/               ← AutosaveField, SectionCard, LivePreview, UploadZone, …
│   └── ui/                   ← shadcn/ui
├── lib/
│   ├── supabase/             ← server client, browser client, admin (service role, server-only)
│   ├── tenant.ts             ← hostname resolution helpers
│   ├── theme.ts              ← church_theme row → CSS variable map
│   └── stripe.ts / youtube.ts / brevo.ts / anthropic.ts
└── types/database.ts         ← generated from live schema (supabase gen types), never hand-edited
```

---

## 3. Environment variables (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server only; used sparingly (webhooks, sync jobs)
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
YOUTUBE_API_KEY                  # server only — never shipped to client (see §0.6)
BREVO_API_KEY
ANTHROPIC_API_KEY
NEXT_PUBLIC_APP_URL              # https://kingdom-creatives.com (or chosen apex)
```

---

## 4. Design system

### Direction

Fresh direction, deliberately away from the legacy heavy-orange WP look. Default brand: **refined, warm, trustworthy** — pine-green primary, off-white paper background, serif display headings, humanist sans body. But brand is a **token set, not a design** — the original orange is just a different `church_theme` row.

### Default token values (seed for church_theme defaults)

| Token | Default | Notes |
|---|---|---|
| `--brand` | `#1F4D3A` (pine green) | primary actions, links, accents |
| `--brand-deep` | `#143528` | hover/active, footer bg |
| `--accent` | `#C9A227` (muted brass) | sparing highlights: eyebrow labels, giving CTA |
| `--paper` | `#FAF7F0` (off-white) | page background |
| `--ink` | `#22271F` | body text |
| `--surface` | `#FFFFFF` | cards |
| `--font-display` | serif (e.g. Fraunces or Lora) | headings only |
| `--font-body` | humanist sans (e.g. Inter or Source Sans 3) | everything else |

Rendering: `(public)/layout.tsx` fetches the tenant's `church_theme` row server-side and emits a `<style>` block of CSS variables on `:root` (or a wrapper div). **Every component reads only variables — zero hardcoded brand colors.** Tailwind config maps semantic names (`bg-paper`, `text-ink`, `bg-brand`) to the variables.

Signature element (the one memorable thing): the hero's photo/video zone gets a soft arched top edge echoing a chapel window — a single reusable CSS clip-path, themable, and it degrades to a plain rectangle if a church's theme disables it (`church_theme` flag). Everything else stays quiet and disciplined.

Quality floor: responsive to 360px, visible keyboard focus, `prefers-reduced-motion` respected, semantic landmarks, alt text required on gallery uploads.

---

## 5. Public church site spec

One route (`(public)/page.tsx`) renders sections from `church_sections` for the resolved church: filter `visible = true`, order by `sort_order`, switch on section type, pass the section's `jsonb` content as props. Unknown types render nothing (forward compatibility).

Fixed chrome + section order (default seed):

1. **Header** — church logo/name, nav (anchors to visible sections), **language picker** (see below), **Portal** button → `/portal`.
2. **Hero** — photo or video zone (gallery bucket ref in jsonb; video = YouTube embed or mp4 URL), headline, subhead, service times, primary CTA. Arched-window treatment per §4.
3. **About** — rich text + optional image, pulled from jsonb.
4. **Latest sermon** — most recent row in `sermons` (YouTube sync keeps this fresh); embedded player (facade pattern — thumbnail + play click loads iframe, same trick as domvegz.com), title, date, "All sermons" link.
5. **Events** — upcoming rows from `events` (date ≥ today), card list; empty state: "No upcoming events — check back soon."
6. **Giving** — Stripe: section CTA opens amount picker → POST `/api/stripe/checkout` (server creates Checkout Session with the church's connected/configured account details) → redirect. **No Stripe publishable-key gymnastics client-side beyond the redirect; amounts validated server-side.** Webhook records completion.
7. **Footer** — address + embedded map (static map image or Leaflet — decide at build; static image is lighter), contact info, social links, "Powered by Kingdom Creatives."

**Language picker:** ship v1 with Google Translate widget parity (matches current WP behavior and YourLife CC precedent) — but isolate it in one component so it can be swapped for real i18n later. Do not let the widget script block render.

**Contact/prayer form** (if a church's sections include it): POST to `/api/contact` → insert into `contacts` (RLS via service role scoped insert or SECURITY DEFINER-style RPC — draft SQL for Jason if an RPC is needed) → Brevo notification email to the church's staff address. Honeypot + rate limit.

---

## 6. Pastor Portal spec

Auth: Supabase Auth (email/password + magic link). On login, look up `church_members` for the user → resolve their `church_id` + role. No membership row → friendly "no access" screen. All queries RLS-scoped; the portal never passes church_id from the client as a trust boundary.

Shell: shadcn/ui sidebar layout. Nav order: **Site editor, Theme, Sermons, AI builder, Events, Staff, Gallery, Contacts, Giving, Documents.** Top bar: church name, "View site" (opens public URL), user menu.

### The core fix vs. the old WP portal

The old portal was one giant 95-field save-all form with `alert()`s. The new portal is built around four behaviors, implemented once as shared components and reused everywhere:

1. **Per-section autosave** — `AutosaveField`/`AutosaveForm`: debounced (~800ms) save on change per field group, optimistic UI, saving/saved/error indicator per card. Errors keep local state and offer retry — never lose typed content.
2. **Live preview** — Site editor shows a preview pane (iframe of the public page with a `?preview=1` draft flag, or componentized preview) that reflects saves within ~1s. Saves also trigger on-demand ISR revalidation of the live site.
3. **Toasts, never `alert()`** — shadcn/sonner toasts; action name consistency ("Publish" button → "Published" toast).
4. **Drag-drop uploads** — `UploadZone`: drag-drop + click, client-side resize for images, upload to correct bucket at `{church_id}/…`, progress bar, immediate thumbnail. Gallery bucket for images, documents bucket for files.

### Tab-by-tab

- **Site editor** — card per `church_sections` row: visibility toggle, drag-to-reorder (writes `sort_order`), section fields edited inline with autosave, image zones = UploadZone wired to gallery bucket. Live preview pane pinned right (collapsible on mobile).
- **Theme** — color pickers + font selects mapped to `church_theme` columns, template picker (from `templates` — 'Classic Church' seeded), live preview of tokens applied. "Reset to template defaults" with confirm.
- **Sermons** — table of `sermons`; "Sync from YouTube" button → `/api/youtube-sync` (server-side key) pulls latest uploads from the church's channel id, upserts; manual add/edit as fallback.
- **AI builder** — streaming sermon/content assistant: prompt form (topic, scripture, tone, length) → `/api/ai/sermon` streams Anthropic API response into the editor; pastor edits then saves to `sermons` (notes/description) or copies out. Server route only; stream via `ReadableStream`.
- **Events** — CRUD on `events` with date/time pickers, recurring hint text (v1: no recurrence engine, just manual).
- **Staff** — CRUD on `staff` (public-facing bios/photos) and, separately gated to admin role, `church_members` invites (send Brevo invite email → Supabase Auth signup link).
- **Gallery** — grid of gallery bucket contents for this church, UploadZone, delete with confirm, alt-text field per image.
- **Contacts** — read/annotate `contacts` submissions, status field, CSV export.
- **Giving** — Stripe configuration status, recent gifts (from webhook-recorded rows — confirm which table holds these; if none, draft SQL for a `gifts` table and stop for Jason's approval per §0.3), payout notes.
- **Documents** — private bucket file manager (upload/download/delete), scoped `{church_id}/`; signed URLs for downloads.

---

## 7. Integrations detail

- **Stripe** — Checkout Sessions created server-side; webhook (`/api/stripe/webhook`, signature-verified) records completions. One Stripe account for the platform in v1 with per-church metadata (church_id on session) — Connect-per-church is a later phase. FTC/claims discipline from EstateSaleBiz applies to any "your gift" language: no tax-advice claims beyond "consult your tax advisor."
- **YouTube sync** — server route, key from env, channel id stored per church (confirm column; if missing, draft SQL and stop). Manual button in v1; Vercel Cron nightly in v1.1 (same pattern as domvegz.com youtube-sync.yml, but as Vercel Cron instead of GitHub Actions).
- **Brevo** — transactional only in v1: contact-form notifications, staff invites. Sender: church display name via platform domain; reply-to = church contact email. `info@kingdom-creatives.com` is the platform contact address everywhere.
- **Anthropic API** — `/api/ai/sermon` streaming route; model configurable via env, sane max tokens, per-user rate limit (simple: N requests/hour per church in a KV or table — draft SQL if table route chosen).

---

## 8. Build phases & acceptance criteria

Timing: EstateSaleBiz code freeze Aug 4, launch Aug 5. **No scaffolding before Aug 5.** Planning artifacts only until then.

**Phase 1 — Skeleton + tenant plumbing (first build session)**
Scaffold Next.js + Tailwind + shadcn/ui; middleware tenant resolution; Supabase clients; generated types from live schema; `(public)` layout pulling church_theme → CSS variables; hardcoded-content hero rendering for church-for-truckers via a Vercel preview URL mapped by host header trick or temp subdomain.
✅ Done when: visiting the preview host for church-for-truckers renders themed hero from live Supabase data.

**Phase 2 — Public site complete**
All 7 sections driven by church_sections; gallery-bucket image zones; latest sermon; events; footer/map; language picker; contact form → contacts + Brevo.
✅ Done when: the full public page for the pilot renders entirely from DB content and passes mobile/keyboard/reduced-motion floor.

**Phase 3 — Portal core**
Auth + church_members gate; shell + sidebar; Site editor with autosave + live preview + reorder; Theme tab; Gallery tab with UploadZone.
✅ Done when: a pastor login can visually rebuild their homepage without touching code, and changes appear on the public URL within seconds.

**Phase 4 — Content tabs**
Sermons (+ YouTube sync), Events, Staff, Contacts, Documents.

**Phase 5 — Money + AI**
Giving (Stripe checkout + webhook), AI builder streaming route + editor.

**Phase 6 — Cutover (pilot)**
Content parity check vs. live WP site → add churchfortruckers.org to Vercel → flip DNS from Cloudways → set `churches.status = 'active'` → monitor → WP site archived (not deleted) after 2 clean weeks. Post-cutover: execute the pending post-Aug-5 WP security list (key rotations, plaintext password purge, YouTube straggler check) before archiving.

---

## 9. Open questions (answer before Phase 1 kickoff)

1. Apex domain for subdomain tenancy — `kingdom-creatives.com` subdomains, or a dedicated product domain?
2. Does `churches` have a `youtube_channel_id` (or similar) column? If not, SQL to add.
3. Where do completed gifts get recorded — existing table or new `gifts` table (SQL needed)?
4. Draft/publish model: is `?preview=1` draft state needed in v1, or is autosave-straight-to-live acceptable for the pilot? (Simplest v1: straight to live; drafts in v2.)
5. Repo name + private GitHub location.
