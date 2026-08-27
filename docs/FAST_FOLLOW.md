# FAST_FOLLOW

Known gaps accepted during a phase and deliberately deferred. Each entry says
what is wrong, why it was safe to defer, and the latest point it must be fixed.

Not a bug tracker for things nobody has looked at - only for things reviewed,
understood, and consciously left.

---

## FF-01 - `churches.status` is never enforced

**File:** `lib/tenant.ts`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** before Phase D cutover

`resolveTenant` selects `status` and carries it on `ResolvedTenant`, but no rule
reads it. A church row that is pending, suspended or half-provisioned resolves
and renders exactly like a live one.

This is harmless while `church-for-truckers` is the only tenant, but Phase D's
cutover step is "set `churches.status = 'active'`" and Phase E provisions new
tenants from the waitlist - both assume the flag means something.

Decision needed from Jason: which statuses are publicly viewable, and what a
non-viewable church should serve (404, or a "coming soon" placeholder). Then
enforce it in `resolveTenant` so the answer is the same everywhere.

---

## FF-02 - tenant cache is unbounded and only evicts on read

**File:** `lib/tenant.ts`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** opportunistic - no deadline

`readCache` deletes an entry when it is read after expiry, so entries for hosts
that are never requested again are never swept. A stream of junk `Host` headers
would accumulate map entries until the instance recycles.

Bounded in practice by short serverless instance lifetimes and the 15s miss TTL,
and each entry is a few hundred bytes. Fix when convenient: cap the map size
(evict oldest on insert past N) or sweep expired keys on write.

---

## FF-03 - `?church=` override is not restricted to platform hosts

**File:** `lib/tenant.ts`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** before the first non-pilot tenant goes live

Rule 1 applies on any hostname when `KC_ALLOW_CHURCH_QUERY_OVERRIDE=1`,
including a real church's custom domain. The only control is that the variable
is unset in production.

Adding `&& isPlatformHost(host)` would mean the variable being set in the wrong
Vercel environment still could not cross-serve one church's content on another
church's domain. Defence in depth against an env-var mistake, not a live hole.

---

## FF-04 - override slug is interpolated into a PostgREST filter

**File:** `lib/tenant.ts`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** same time as FF-03

The Phase A review hardened the *host* path with `isQueryableHost`, but rule 1's
`overrideSlug` is still client-supplied text passed through
`encodeURIComponent` into `slug=eq.<value>`.

Lower risk than the host path was: the value sits in a top-level filter rather
than inside an `or=(...)` group, and `,` and `&` are both percent-encoded, so
there is no obvious way to append a second filter. It is also reachable only
when the override flag is on. Worth a `[a-z0-9-]+` guard for symmetry with
`isQueryableHost` when FF-03 is done.

---

## FF-05 - an unresolvable tenant always renders 404

**File:** `proxy.ts`, `app/not-found.tsx`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** before Phase D cutover

Phase A stopped caching lookup failures, so a Supabase blip no longer persists
for 15 seconds - but the request that hit the blip still 404s, because "no
tenant" has exactly one outcome.

For a live church domain, a transient backend failure should serve 503 (retry,
no SEO damage) rather than 404 (gone, deindex me). Needs `proxy.ts` to
distinguish "resolved to nothing" from "could not resolve" and an error route to
match.

---

## FF-06 - proxy.ts does not refresh the Supabase session - RESOLVED

**File:** `proxy.ts`, `lib/supabase/server.ts`, `lib/supabase/proxy.ts`
**Raised:** Phase A review, 2026-07-30
**Resolved:** Phase C shell, 2026-08-27
**Was:** BLOCKER for Phase C - before any login ships

**Fixed exactly as the original entry prescribed.** `lib/supabase/proxy.ts`
exports `refreshSession`, which `proxy.ts` calls on every matched request with a
cookie handler writing to both the request and the outgoing response. It uses
`getUser()`, not `getSession()`, so the token is verified against the auth
server rather than trusted from the cookie. The tenant headers are untouched,
and the refresh runs for public routes too - a token that expires while a pastor
reads their own site should not strand them at `/portal`.

The `setAll` catch in `lib/supabase/server.ts` stays as-is. It is now the
standard pattern it was always meant to be, because something else really does
refresh the session.

Not yet verified against live Supabase - no `.env.local` existed when this was
written. Confirm a real login survives a token expiry before closing the loop.

Original entry follows.

`createClient()` in `lib/supabase/server.ts` swallows cookie-write failures in
its `setAll` catch, which is the standard `@supabase/ssr` pattern - but only
because that pattern assumes middleware refreshes the session instead. Ours does
not: `proxy.ts` resolves the tenant and nothing else.

Harmless in Phase A, which has no auth. Once pastors can log in, a Server
Component that triggers a token refresh will have the refreshed cookie silently
discarded, and nothing else will write it. The symptom is intermittent logouts
mid-session with no error anywhere - expensive to diagnose, trivial to prevent.

Fix when Phase C auth lands: call `supabase.auth.getUser()` inside `proxy.ts`
with a cookie handler that writes to the outgoing response, per the Supabase
SSR docs, and keep the tenant headers it already sets.

---

## FF-07 - env validation is inconsistent across the Supabase clients

**File:** `lib/supabase/server.ts`, `client.ts`, `admin.ts`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** opportunistic - no deadline

`admin.ts` checks `SUPABASE_SERVICE_ROLE_KEY` and throws a named error when it
is missing. The other three construction sites use `!` non-null assertions on
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, so a missing value
surfaces as an opaque supabase-js failure instead of a sentence naming the
variable.

`lib/tenant.ts` is a fourth style again - it returns a miss when the vars are
absent rather than throwing (deliberate: it runs in the proxy on every request).

Fix: one small accessor - `requireEnv("NAME")` - used by every client, with
`tenant.ts` keeping its non-throwing behaviour explicitly rather than by
accident. Cosmetic until someone misconfigures a Vercel environment, at which
point it is the difference between a five-second fix and a confusing one.

---

## FF-08 - two different exports are both named `createClient`

**File:** `lib/supabase/client.ts`, `lib/supabase/server.ts`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** opportunistic - no deadline

`client.ts` exports `createClient` (browser, `createBrowserClient`) and
`server.ts` exports `createClient` (server, cookie-bound). This mirrors the
Supabase docs, so it is idiomatic - but editor auto-import picks by name, and
the wrong choice produces a subtle failure rather than a loud one: a browser
client constructed in a Server Component has no session and silently reads as
anon, which under RLS looks like "the data disappeared" rather than an error.

Fix: rename to `createBrowserClient` / `createServerClient` at the export site,
or require named imports through a single `lib/supabase/index.ts`. Cheap now,
much less cheap once Phase C has dozens of call sites.

---

## FF-09 - `unstable_cache` is the legacy caching API in Next 16

**File:** `lib/church.ts`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** opportunistic - revisit at Phase B

`getChurchSite` uses `unstable_cache` with `tags` and `revalidate`. Next 16's
current API is Cache Components - the `"use cache"` directive with `cacheTag()`
and `cacheLife()` - which is what `CLAUDE.md` gestures at and what the on-demand
revalidation story in BUILD_BRIEF section 1 assumes long term.

`unstable_cache` still works and the tag names would carry over unchanged, so
this is a migration, not a bug. Phase B adds the section-level queries that would
be migrated alongside it, so doing both at once is cheaper than doing this one
now.

---

## FF-10 - cache wrapper is constructed per call

**File:** `lib/church.ts`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** opportunistic - no deadline

`getChurchSite` calls `unstable_cache(...)` inside the function body and
immediately invokes the result, so a new wrapper is built on every call. The
cache key is stable (`["church-site", slug]`), so behaviour is correct - it is
allocation waste, not a cache miss.

Fix: hoist to a module-scope memo keyed by slug, or fold into the FF-09 `"use
cache"` migration where the question disappears entirely.

---

## FF-11 - theme values are validated on read but never on write - HALF DONE

**File:** `lib/theme.ts`, `app/(portal)/portal/details/actions.ts`
**Raised:** Phase A review, 2026-07-30
**Updated:** Phase C shell, 2026-08-27
**Must fix by:** Phase C - the contrast half is still open

**First half fixed.** `saveBranding` in the Church Details tab validates each
colour with its own `normalizeHex` before writing, rejects the whole save with
"Colours need to look like #A1B2C3", and normalises `#abc` to `#AABBCC` so the
stored value is always the form the renderer expects. The silent-rejection
failure described below can no longer happen through the portal.

Note the duplication that creates: `normalizeHex` now exists in both
`lib/theme.ts` (read side) and the details action (write side). They agree
today. Fold them into one exported helper before a third copy appears.

**Second half still open:** nothing checks contrast. All three ratios in the
table below are still unenforced, and the branding form happily saves a pale
brand with near-white text on it. That is the part that must ship before a
pastor other than Jason touches the colour pickers.

Original entry follows.

Two halves of the same gap, both invisible to the person they affect:

**Silent rejection.** `normalizeHex` accepts strict 3- or 6-digit hex and
returns null for anything else, falling back to the platform default. That is
the correct defence at render time - these values are interpolated into a
`<style>` block - but nothing validates at write time. A pastor who saves
`rgb(236, 93, 27)`, `orange`, or a stray space sees their change simply not
happen, with no error anywhere in the UI.

**No contrast enforcement, in two places.** `color_primary` and `color_accent`
(the fill and the text that sits on it) are independent columns, so nothing
stops a pale brand with near-white contrast text - unreadable buttons.

Separately, `app/globals.css` uses `var(--kc-accent)` as the keyboard focus
outline colour, and `--kc-accent` comes from `color_secondary`. A church whose
secondary lands near `--kc-paper` gets an invisible focus ring - a WCAG failure
introduced through the theme editor by a pastor who only thought they were
picking a highlight colour.

BUILD_BRIEF section 4 sets an accessibility floor; nothing currently enforces it.

Fix in the Phase C theme tab, not in `lib/theme.ts`: validate the hex on input,
show the rejection inline, and check ALL THREE ratios:

| Foreground | Background | Where it shows | Minimum |
|---|---|---|---|
| `color_accent` | `color_primary` | button text on brand fill | 4.5:1 |
| `color_accent` | `--kc-brand-night` | church name in the footer | 4.5:1 |
| `color_secondary` | `--kc-paper` | keyboard focus ring | 3:1 |

The middle row is the one that is easy to miss: `--kc-brand-contrast` is used
both as text on a light brand fill AND as the footer heading on the always-dark
`--kc-brand-night` band, so a single column has to stay readable against two
opposite backgrounds. A dark `color_accent` passes the first check and vanishes
in the footer.

Warn or offer to pick a readable value. The render-time fallback stays exactly
as it is; it is the last line, not the first.

---

## FF-12 - `color-mix()` has no fallback declaration

**File:** `lib/theme.ts`, `app/globals.css`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** opportunistic - no deadline

Four derived tokens (`--kc-brand-deep`, `-night`, `-wash`, `-soft`) are built
with CSS `color-mix(in srgb, ...)`. On a browser without support the whole
declaration is invalid, so those surfaces lose their colour rather than
degrading to something reasonable.

This affects both layers, which matters: `lib/theme.ts` builds them per tenant,
and the `:root` platform defaults in `app/globals.css` build them the same way -
so the fallback layer has exactly the same gap as the layer it backstops. Fixing
only one leaves the hole open.

Baseline support since Safari 16.2 / Chrome 111, so this is a long-tail concern
- but the pilot's congregation is truckers, who skew toward older phones kept
for years. Cheap fix: emit a plain hex approximation immediately before each
`color-mix` line so the cascade falls back on its own.

---

## FF-13 - no test setup exists

**File:** repo-wide; first targets `lib/tenant.ts`, `lib/theme.ts`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** before Phase D cutover

There is no test runner, no test script and no tests. The tenant-resolution
matrix in `README.md` (8 host cases, forged-header rejection, override-off 404)
was verified by hand and will silently rot the first time resolution order is
edited.

`lib/tenant.ts` and `lib/theme.ts` are the cheapest possible starting point:
both are pure, dependency-free and full of exactly the edge cases that break
quietly - `normalizeHost`, `subdomainSlug`, `isQueryableHost`, `normalizeHex`,
`fontStack`. No database, no network, no React.

Cutover is the hard deadline: once churchfortruckers.org points at this app, a
tenant-resolution regression is an outage for a real congregation, not a preview
URL rendering wrong.

---

## FF-14 - the default palette is defined twice

**File:** `lib/theme.ts` (`DEFAULT_THEME`), `app/globals.css` (`:root`)
**Raised:** Phase A review, 2026-07-30
**Must fix by:** opportunistic - no deadline

`#1f4d3a`, `#c9a227`, `#faf7f0`, `#22271f` and the rest of the platform defaults
are written out in both files, with no mechanism keeping them in sync.

The drift would be quiet, which is the real problem. `app/(public)/layout.tsx`
always emits a full token set - `buildThemeTokens(null)` returns the TS defaults
- so inside `.kc-site` the CSS copy never applies. It only surfaces outside that
subtree, e.g. `app/not-found.tsx`. Change the TS defaults and the platform 404
keeps the old palette, with nothing failing to indicate it.

Fix: pick one source. Either generate the `:root` block from `DEFAULT_THEME` at
build time, or delete the CSS colour defaults and accept unstyled-until-token
outside `.kc-site`. Cheapest interim step is a comment in each file pointing at
the other.

---

## FF-15 - font preloading is backwards for non-default themes

**File:** `app/layout.tsx`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** Phase B - with the public site build

`next/font` preloading is decided at build time and applies to every tenant, but
font *choice* is per-church and known only at request time. `fraunces` and
`sourceSans` preload; `lora`, `inter` and `plexMono` do not.

So a church themed with Lora + Inter preloads two fonts it never renders, then
fetches the two it does render late and unhinted. The churches that customised
their theme get the slowest first paint, and everyone pays for bytes they may
not use.

Not fixable by flipping the flags - `next/font` cannot preload conditionally.
The two real options: drop preload entirely and lean on `display: swap`, or emit
a per-tenant `<link rel="preload">` from `app/(public)/layout.tsx`, where the
theme row is already loaded. Belongs with Phase B, when the real spread of
tenant font choices is known instead of guessed.

---

## FF-16 - `lang="en"` is hardcoded on `<html>`

**File:** `app/layout.tsx`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** Phase B - with the language picker

BUILD_BRIEF section 5 calls for a language picker (Google Translate widget
parity in v1, isolated so it can be swapped for real i18n later). The root
layout hardcodes `lang="en"` for every tenant.

Wrong `lang` costs real things: screen readers use the wrong pronunciation
rules, and translation tooling mis-detects the source language. The legacy WP
site carried a translate widget, so a Spanish-language congregation on this
platform is a realistic near-term case, not a hypothetical.

Fix with the picker: drive `lang` from a per-church language column (schema
change - draft SQL, stop) or from the section content, and keep the picker
component isolated per the brief.

---

## FF-17 - overscroll shows white instead of paper on iOS

**File:** `app/layout.tsx`, `app/globals.css`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** opportunistic - no deadline

`body` keeps shadcn's `--background` (white) while `.kc-site` paints
`--kc-paper` on a child div. Rubber-band scrolling past the top or bottom on iOS
exposes the body background, so a warm-paper site flashes white at the edges.

Cosmetic, but it reads as a rendering glitch on exactly the devices most of the
pilot congregation uses. Fix by painting `--kc-paper` on `html`/`body` for
public routes, or setting `background-color` on the root element from the same
token.

---

## FF-18 - `logo_url` bypasses the next/image allowlist

**File:** `components/site/site-header.tsx`, `next.config.ts`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** BLOCKER for Phase C - ships before pastors can edit the value

`next.config.ts` defines a correct, tight allowlist: Supabase public storage
(`/storage/v1/object/public/**`) plus YouTube thumbnail hosts. The header then
renders the logo with `unoptimized`, which **skips that allowlist entirely** -
`remotePatterns` never applies to an unoptimized image.

`church_theme.logo_url` is free text. Any URL in that column causes every
visitor's browser to fetch directly from that host, leaking visitor IP and
referrer to a third party and putting the church's header on someone else's
uptime. Not code execution - an `img src` will not run `javascript:` - but it is
a pastor-editable outbound request from the congregation's browsers.

Today the value is set only by Jason, via SQL. Phase C hands it to pastors
through the theme tab, which is when "we will constrain uploads later" stops
being a plan and needs to be a control.

Fix: validate the URL against the Supabase public-storage prefix at render time
and drop `unoptimized`, so `remotePatterns` does the job it is already
configured for and a rogue URL falls back to the initials mark. Pairs naturally
with the Phase C upload flow that writes the column.

---

## FF-19 - logo has no maximum width

**File:** `components/site/site-header.tsx`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** Phase B - with the public site build

The logo renders `h-12 w-auto` with no `max-w-*`. A wide wordmark - 1000x80 is
an ordinary church logo - renders roughly 600px wide at that height, consuming a
360px viewport entirely and pushing the church name off screen. `min-w-0` on the
adjacent text block protects the text, not the image.

Not visible on the pilot, which has no `logo_url` set. It appears the first time
a church uploads a horizontal logo, which is most of them.

Fix: `max-w-[180px] object-contain`, tuned against a real wordmark once Phase B
has one to test with.

---

## FF-20 - buttons render two competing focus indicators

**File:** `app/globals.css`, `components/ui/button.tsx`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** Phase B - public site polish

Two focus treatments stack on every button, because they use different CSS
properties and neither suppresses the other:

- shadcn base classes: `focus-visible:border-ring focus-visible:ring-3
  focus-visible:ring-ring/50` - a box-shadow ring in `--ring` (mapped to the
  church brand inside `.kc-site`)
- `app/globals.css`: `outline: 3px solid var(--kc-accent)` on any focusable
  element inside `.kc-site`

A keyboard user sees a brand-coloured ring and an accent-coloured outline at
once, in two different colours. Nothing is broken; it reads as unintentional and
doubles the number of colour pairs FF-11 has to contrast-check.

Recommendation: keep the `globals.css` outline and suppress the shadcn ring from
`globals.css` (not by editing `button.tsx`, which is regenerated by the shadcn
CLI and would lose the change). The outline is the better survivor - it is
tenant-coloured, applies uniformly to links and inputs as well as buttons, and
lives in the file we own.

---

## FF-21 - button touch targets are small for the audience

**File:** `components/ui/button.tsx` (stock shadcn sizes), public site usage
**Raised:** Phase A review, 2026-07-30
**Must fix by:** Phase B - with the public site build

shadcn v4 defaults are compact: `default` is `h-8` (32px) and `lg` is `h-9`
(36px). That clears WCAG 2.2 AA (24x24 minimum) but sits well under Apple's 44pt
and Material's 48dp guidance.

The pilot congregation is truckers on phones, frequently one-handed and often in
a cab. The hero CTA currently uses the default size. This is a fit-for-audience
call, not a standards violation.

Fix in Phase B: a public-site size override (or a wrapper that maps church-site
buttons to a taller scale) rather than editing the generated component. Portal
buttons can stay compact - a pastor at a desk is a different context.

---

## FF-22 - `Button` has no default `type`

**File:** `components/ui/button.tsx`
**Raised:** Phase A review, 2026-07-30
**Must fix by:** Phase C - before portal forms ship

`Button` renders `<button>` with no `type`, so inside a `<form>` it defaults to
`type="submit"`. Stock shadcn behaviour and harmless on the public site, which
has no forms yet.

Phase C's portal is almost entirely forms, many with secondary actions -
"Add another", "Remove", "Preview". Each one will submit the form unless it
passes `type="button"` explicitly, and the failure looks like a mysterious save
rather than an error.

Fix: pass `type="button"` at the call sites, or wrap `Button` for portal use with
that default. Do not edit the generated file - see FF-20.

---

## FF-23 - migration 01 RLS policies have `using` without `with check`

**File:** `supabase/migrations/01_kc_migration_01.sql`
**Raised:** Phase C shell, 2026-08-27
**Must fix by:** BLOCKER - before a second church has real data in the system

Every "member write" policy in migration 01 is written as:

```sql
create policy "announcements: member write"
  on public.announcements for all
  using ( exists (select 1 from church_members cm
                  where cm.church_id = announcements.church_id
                    and cm.user_id = auth.uid()) );
```

`using` is checked against the row as it exists BEFORE the statement. On a
`for all` policy that covers UPDATE and INSERT, `with check` - which tests the
row as it will exist AFTER - defaults to the `using` expression only for
UPDATE, and to permissive for INSERT under some configurations. The practical
consequence is that a member of church A can `update ... set church_id = <B>`
and move the row out of their own tenant into another church's data, or insert
a row already stamped with another church's id.

Affects eight tables: `pastor_notes`, `announcements`, `prayer_requests`,
`groups`, `ministries`, `gifts`, `email_lists`, `contact_list_memberships`.
`church_links` (draft 09) already has both clauses and is not affected.

**Why it is safe right now:** `church-for-truckers` is the only church with a
member, so there is no second tenant to move a row into, and nothing is public
yet. The exposure starts the moment a second church has a real user.

**Why it is a blocker rather than a nice-to-have:** this is the one class of bug
where the damage is silent and cross-tenant. A church seeing another church's
prayer requests is not a bug report, it is an incident.

Fix: re-issue each policy with a `with check` clause identical to its `using`
clause. Mechanical, eight tables, one draft file. Do it as its own migration so
the diff is reviewable - do not fold it into a feature migration.

Application code does not rely on the gap: every portal write already filters
`.eq("church_id", session.site.church.id)` from the server-resolved session and
never accepts a church id from the client. That is defence in depth, not a
substitute - RLS is the boundary that holds when a query forgets.
