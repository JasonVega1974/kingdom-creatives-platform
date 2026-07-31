# Kingdom Creatives Platform

Multi-tenant church website platform - the WordPress multisite replacement.
Next.js (App Router, TypeScript) + Supabase + Vercel + shadcn/ui.

Pilot tenant: `church-for-truckers` -> churchfortruckers.org (still served by
the old WordPress install until cutover; nothing here touches it).

Spec lives in `docs/`. Standing rules live in `CLAUDE.md` - read it first.

---

## Status: Phase A complete

| Phase A deliverable | State |
|---|---|
| Next.js App Router + TS + Tailwind + shadcn/ui scaffold | done |
| Tenant resolution, hostname -> church_id | done (`proxy.ts` + `lib/tenant.ts`) |
| Supabase clients (browser / server / admin) | done (`lib/supabase/`) |
| Types generated from the live schema | done (`types/database.ts`, `npm run types`) |
| Theme system, `church_theme` row -> CSS variables | done (`lib/theme.ts`) |
| **Accept: renders a CFT-branded page from live Supabase data** | **met locally** |

Verified against the live database on localhost, not on a Vercel preview URL -
the project is not linked to Vercel and has no remote yet (KC_MASTER_TODO A1).
The acceptance criterion as written names a preview URL; treat that half as
outstanding until the first deploy.

Known gaps accepted during Phase A are logged in `docs/FAST_FOLLOW.md`, with the
phase each one blocks.

Phase B (public site, spec `prototypes/cft-site-orange.html`) is next and has
not been started. The home page is a Phase A placeholder, not the real design.

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in - see below
npm run dev                    # http://localhost:3000
```

`.env.local` needs, at minimum, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `KC_DEFAULT_CHURCH_SLUG=church-for-truckers`.
Every other key belongs to a later phase.

## How a request finds its church

`proxy.ts` runs before every render, resolves the hostname to a church, and
stamps `x-church-id` / `x-church-slug` on the request. Server Components read
those headers - never a client-supplied value, and inbound `x-church-*` headers
are stripped before ours are set.

Resolution order (`lib/tenant.ts`):

1. `?church=<slug>` - only when `KC_ALLOW_CHURCH_QUERY_OVERRIDE=1`. Preview and
   dev only; leave it unset in production.
2. `{slug}.KC_ROOT_DOMAIN` subdomain.
3. `churches.custom_domain` exact match (with and without `www.`).
4. `KC_DEFAULT_CHURCH_SLUG`, and only for platform hosts (localhost,
   `*.vercel.app`). A real unmatched domain resolves to nothing and 404s rather
   than silently serving another church's content. **Leave this unset in
   production.**

Lookups are cached in memory for 60s (15s for misses), so this costs one
Supabase round trip per instance per minute, not one per request.

Verified locally against the live database:

| Request | Result |
|---|---|
| `Host: churchfortruckers.org` | 200, CFT |
| `Host: www.churchfortruckers.org` | 200, CFT |
| `Host: church-for-truckers.kingdom-creatives.com` | 200, CFT |
| `Host: nosuchchurch.kingdom-creatives.com` | 404 |
| `Host: example.com` | 404 |
| `Host: <preview>.vercel.app` | 200 via fallback slug |
| forged `x-church-id` header | ignored |
| `?church=` with the override off | 404 |

## Theming

`app/(public)/layout.tsx` reads the tenant's `church_theme` row and emits the
token set as `--kc-*` custom properties. Components read variables only - there
are no hardcoded brand colours anywhere in `components/`.

`church_theme` stores three colours, two font names and a logo URL. The brand
ramp is derived from `color_primary` with CSS `color-mix`; the neutral ramp is
platform-wide in v1. See `lib/theme.ts` for the mapping, and
`supabase/drafts/02_theme_tokens.sql` if per-church neutrals are ever needed.

Fonts are loaded build-time by `next/font` (self-hosted), so a church picks
from the supported set - Fraunces, Lora, Inter, Source Sans 3, IBM Plex Mono.
An unrecognised name falls back to the platform default rather than breaking
the page.

## Database

The schema is live and owned by Jason. Claude never executes SQL: drafts land
in `supabase/drafts/` and stop there. `supabase/migrations/` records what has
actually been applied.

After any migration runs, regenerate types:

```bash
npm run types
```

## Deviations from BUILD_BRIEF worth knowing

- **`proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention. Same API
  and position; `middleware.ts` still works but logs a deprecation warning.
- **`churches.custom_domain`, not `churches.domain`** - the brief section 1 has
  the column name wrong.
- **Theme tokens are `--kc-*` prefixed** so they cannot collide with shadcn's
  `--accent` / `--primary` / `--border` / `--radius`.
