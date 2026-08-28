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

## Production environment

Vercel scopes environment variables per environment. The two tenant-resolution
knobs are deliberately set differently in Preview and Production, and getting
that backwards is quiet rather than loud.

| Variable | Production | Preview | Development |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | set | set | set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | set | set | set |
| `SUPABASE_SERVICE_ROLE_KEY` | set (server only) | set (server only) | only if a job needs it |
| `KC_ROOT_DOMAIN` | `kingdom-creatives.com` | `kingdom-creatives.com` | `kingdom-creatives.com` |
| `KC_DEFAULT_CHURCH_SLUG` | **unset** | `church-for-truckers` | `church-for-truckers` |
| `KC_ALLOW_CHURCH_QUERY_OVERRIDE` | **unset** | `1` | `1` |

### Why the default slug is unset in production

Rule 4 is gated on `isPlatformHost()`, so the fallback never fires for a real
custom domain - `example.com` pointed at the deployment resolves to nothing and
404s. That much is safe either way. The problem is narrower and easy to miss:

**Vercel assigns a `*.vercel.app` domain to the production deployment too**, and
`isPlatformHost()` returns true for anything ending `.vercel.app`. Set the
default slug in Production and `kingdom-creatives-platform.vercel.app` serves
Church for Truckers' entire site under a hostname that is not theirs -
publicly reachable, indexable, and duplicating the real domain.

`isPlatformHost()` also returns true for an **empty** host (`if (!host) return
true`). Vercel always sets `Host`, so this is theoretical, but if it ever
happened the fallback would serve CFT where the correct answer is 404 - masking
exactly the resolution failure you would want to see.

Preview is the opposite case: preview URLs *are* `*.vercel.app`, which is what
rule 4 exists for. Set it there.

### Why the query override is unset in production

`lib/tenant.ts` reads it as a strict equality:

```ts
const allowOverride = process.env.KC_ALLOW_CHURCH_QUERY_OVERRIDE === "1";
```

Absent means off - `undefined === "1"` is `false` - so omitting the variable
fails closed. Only the exact string `"1"` enables it; `true`, `yes` and `on` all
read as off.

With the flag off, `?church=<slug>` is never interpolated into a query, and the
lookup cache key excludes the parameter entirely:

```ts
const cacheKey = `${host}|${allowOverride ? (overrideSlug ?? "") : ""}`;
```

So the parameter can neither resolve a tenant nor poison the cache entry for a
hostname. `proxy.ts` still reads it unconditionally and hands it to
`resolveTenant()`; the gate is in the resolver, not the caller.

### What production depends on instead

With both unset, only rules 2 and 3 resolve, and each has a prerequisite:

- **Rule 2** needs `KC_ROOT_DOMAIN` set, or `subdomainSlug()` returns null and
  `{slug}.kingdom-creatives.com` never matches.
- **Rule 3** needs `churches.custom_domain` populated for each church. A church
  whose column is null 404s on its own domain the moment DNS points at us.
  Check this before a cutover, not during one.
- The bare apex `kingdom-creatives.com` matches no rule and 404s. That is
  intended until the Phase E platform layer exists.

Two consequences of failing closed, both the behaviour we want:

- A Supabase outage makes the lookup return "could not ask" rather than "no such
  church", and that answer is deliberately not cached. An outage produces 404s,
  never a wrong church pinned for the cache TTL.
- On an unmatched host the public site 404s, but the portal does not: with no
  tenant, `requirePortalUser()` redirects to `/portal/login`, which renders
  without chrome. Access is still gated per church id, so this is a different
  shape of failure rather than a leak.

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
