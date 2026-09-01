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

**STATUS: CLOSED 2026-08-27 - NOT A DEFECT. The premise below is wrong.**

Postgres applies the `using` expression to the after-image when a policy covering
ALL or UPDATE has no `with check`. From the CREATE POLICY documentation:

> For policies that can have both USING and WITH CHECK expressions (ALL and
> UPDATE), if no WITH CHECK expression is defined, then the USING expression will
> be used both to determine which rows are visible (normal USING case) and which
> new rows will be allowed to be added (WITH CHECK case).

The cross-tenant update described below was never possible - the database would
have rejected it. Draft 13 ran on 2026-08-27 and was semantically a no-op: it
made an implicit check explicit on seven policies. Harmless, not a fix, and
nothing needs rolling back.

Kept as a record of the misreading, and because explicit `with check` clauses are
still worth having - they are self-documenting, and they stop a later edit to
`using` from silently changing write behaviour. That is hygiene, not a blocker.

The nine `pastor+ can edit` policies on the pre-migration-01 tables have the same
shape and are equally fine. No draft was written for them.

The original entry follows, unedited.

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

**Corrected 2026-08-27** while drafting the fix. The original entry said eight
tables and got the membership wrong in both directions. It is seven policies:

| Policy | Command | Why |
|---|---|---|
| `announcements: member write` | `for all` | tenant boundary |
| `prayer_requests: member full access` | `for all` | tenant boundary |
| `groups: member write` | `for all` | tenant boundary |
| `ministries: member write` | `for all` | tenant boundary |
| `email_lists: member full access` | `for all` | tenant boundary |
| `contact_list_memberships: member full access` | `for all` | reaches through `email_lists` |
| `pastor_notes: owner update` | `for update` | **user** boundary, not tenant |

- **`gifts` was listed wrongly.** `gifts: member read` is `for select`. A SELECT
  policy has no after image, so `with check` is not a legal clause on it.
- **`pastor_notes` was missed.** Its update policy has `using` and no
  `with check`, so a pastor can reassign a note to another `user_id` and file a
  private note in someone else's notes. Same root cause, different boundary.

`church_links` (draft 09) already has both clauses and is not affected.

SQL: `supabase/drafts/13_rls_with_check.sql`.

### The larger question this opened - FF-24

Migration 01 enables RLS on eight tables. `types/database.ts` lists twenty-one.
The other thirteen predate migration 01 and nothing in the repo records whether
RLS was ever enabled on them. See FF-24 - it is potentially a worse hole than
this one and is unresolved until the audit comes back.

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

---

## FF-24 - RLS enablement on the thirteen pre-migration-01 tables

**File:** live schema
**Raised:** Phase C shell, 2026-08-27, while drafting the FF-23 fix
**STATUS: CLOSED 2026-08-27 - audited, no action needed.**

Section 1 of draft 13 was run against the live schema on 2026-08-27. Result: RLS
is enabled on all twenty-one public tables, and every table carries at least one
policy. Nothing came back OFF, and nothing came back "RLS on but no policy".

The two severe cases this entry called out are both clear. `church_members` has
RLS on, so the anon key cannot insert a membership row and the total-portal-
compromise scenario does not exist. `documents` has RLS on with a role-gated
`staff+ can view documents` policy.

The audit did surface two real findings on those same tables, filed separately as
FF-25 and FF-26. Neither is the problem this entry predicted.

---

## FF-25 - `videos.published` is not enforced by the public select policy

**File:** `supabase/migrations/14_videos_published_rls.sql`
**Raised:** 2026-08-27, from the draft 13 section 1 audit
**STATUS: CLOSED 2026-08-28 - fixed.**

Draft 14 applied. Section 1 confirmed the policy was unfiltered before the
change; section 2 recreated it as `published = true AND church_id in (active)`.

Timing worth noting: this closed the same day Phase B step 3 shipped `/worship`,
the first public page to read `videos`. The exposure was theoretical for as long
as nothing public read the table and would have become real on that deploy.
`lib/collections.ts` also filters `published` in the query, but that is defence
in depth - the policy is the boundary.

The original entry follows.

`videos` has a `published boolean not null` column. Its public policy ignores it:

```sql
create policy "public can view videos of active churches"
  on public.videos for select
  using ( church_id in (select id from churches where status = 'active') );
```

Every other public-facing table gates on its visibility column - `church_sections`
on `visible = true`, `staff` on `visible = true`. `videos` does not, so an
unpublished video is readable by anyone holding the anon key, which ships in every
browser bundle. `gallery` is correct by accident: it has no visibility column to
filter on, so there is nothing for its policy to omit.

Unlike FF-23 this needs no authentication and no second tenant - just the anon key
out of the page source. It is not exploitable today because nothing public reads
`videos` yet and CFT has no video rows, but it goes live the moment Phase B
renders a video page.

Fix: re-issue the policy with `and published = true`. The authenticated
`staff+ can view videos` policy is permissive and untouched, so the portal still
sees unpublished rows.

---

## FF-26 - two authorization models in one schema

**File:** `supabase/migrations/01_kc_migration_01.sql` vs the pre-migration-01 tables
**Raised:** 2026-08-27, from the draft 13 section 1 audit
**Must fix by:** before the portal exposes role management

The audit showed the schema gates writes two different ways:

- **Pre-migration-01 tables** - `church_sections`, `contacts`, `documents`,
  `events`, `gallery`, `sermons`, `staff`, `support_tickets`, `videos` - gate on
  ROLE: `role = any(array['pastor','admin'])`, with a separate `staff+ can view`
  read policy that also admits `staff`.
- **Migration 01 tables** - `announcements`, `prayer_requests`, `groups`,
  `ministries`, `email_lists`, `contact_list_memberships` - gate on MEMBERSHIP
  ALONE: any row in `church_members`, whatever the role.

So a user with role `member` can write announcements and prayer requests but
cannot touch sermons or events. Nobody chose that split; it is an artifact of two
authoring sessions, and it is invisible until a church has a non-pastor user.

The comment in `12_grant_portal_access.sql` section 2 - "nothing enforces roles
yet - every migration 01 policy checks membership, not role" - is true of
migration 01 and false of the schema as a whole. Correct it when this is settled.

Not urgent: CFT has only pastors. Decide the model before Phase C ships role
management. See `docs/PORTAL_SPEC.md` open question 3.

---

## FF-27 - churches and church_theme had no write policy at all

**File:** `supabase/migrations/17_churches_write_policy.sql`
**Raised:** 2026-08-27, from a failed save on the Church Details tab
**STATUS: CLOSED 2026-08-27 - fixed and verified live.**

Draft 17 applied 2026-08-27. Church Details now saves and persists, confirmed by
retest on both the identity and service-times forms. The column grants landed as
designed - `churches` UPDATE carries exactly `name, tagline, address, phone,
email, service_times, updated_at`, with no `slug`, `custom_domain`, `status`,
`id` or `template_id`.

The form fields no longer blank out after save, which confirms that symptom was
React 19 resetting an uncontrolled form to server values that had never changed,
not a separate read-back bug.

One loose end came out of the section 4 output and is handled by draft 18:
`churches` still carried a blanket INSERT grant, and neither table had DELETE
revoked. Not exploitable - RLS denies both commands with no matching policy -
but a grant that outlives its purpose becomes live the moment someone adds the
policy it was waiting for. Draft 18 applied 2026-08-28.

### Column grants and upserts - the part that bit

Draft 17's column grants broke the branding form, and the reason generalises to
every future upsert against a table with column-level privileges.

`saveBranding` upserts `church_theme`. A church that already has a theme row
takes the `ON CONFLICT DO UPDATE` path, and **PostgREST builds the SET clause
from every column in the payload, including the conflict target**. So the
statement needs UPDATE privilege on `church_id` - which draft 17 withheld on
purpose, since nothing should be able to move a theme row between churches.

The rule to remember: **grant UPDATE on the conflict-target column whenever a
table is upserted through PostgREST and its write privileges are column-scoped.**
It is safe when the update policy carries a `with check` on that column, as
draft 17's does - the grant opens the column, the policy still decides the
value.

Two things made this expensive to diagnose, both worth recognising on sight:

- The error read `permission denied for table church_theme`, not "column".
  Postgres has a column-granular message form, but the executor's DML
  permission check does not use it, so a missing COLUMN privilege on
  INSERT/UPDATE reports at TABLE granularity. "table" does not rule out a
  column problem.
- It surfaced as the transport message ("Try again in a moment") rather than
  the refusal message, because PostgREST genuinely raised. That was correct
  behaviour from the FF-27 code fix and correctly ruled out a 0-row write.

Traced in `supabase/migrations/19_church_theme_privilege_trace.sql`, which
isolated it with three probes: the granted columns alone passed, the same
statement plus `church_id` raised 42501, and a hand-written upsert omitting
`church_id` from its SET list reached RLS instead of the ACL.

The original entry follows.

Draft 16 audited both tables. Each has RLS on and exactly one policy, both
`for select`. No insert, update or delete policy on either. Every write from
Church Details has been refused since the tab was built.

It presented as a successful save because **an UPDATE refused by RLS is not an
error**. The row is filtered out of the statement's scope, Postgres reports 0
rows changed, PostgREST answers 204 No Content, and supabase-js returns
`{ error: null }`. The action checked only `error`, so it could not tell "wrote
one row" from "wrote nothing".

Edit My Website was unaffected because it writes `church_sections`, which does
have `pastor+ can edit sections`.

Two fixes, both needed:

1. **Code, done** - `saveIdentity`, `saveServiceTimes` and `saveBranding` now
   chain `.select()` and treat an empty result as a definite refusal, with a
   different message from a transport failure. A permission problem never
   succeeds on retry, so "Try again in a moment" was the wrong thing to say.
2. **Schema, draft 17** - `for update` on churches (not `for all`: DELETE would
   let a pastor cascade away their own tenant), insert + update on church_theme
   for the branding upsert, plus column-level GRANTs. RLS cannot express
   "may edit name but not slug" - a policy sees the row, never which columns
   changed - so `slug`, `custom_domain` and `status` are held back with column
   privileges instead.

**The general lesson.** Any portal write that checks only `error` is capable of
this. Before adding a Server Action that writes, chain `.select()` and assert a
row came back.

---

## FF-28 - the .select() read-back depends on status = 'active'

**File:** `app/(portal)/portal/details/actions.ts`
**Raised:** 2026-08-27, while writing draft 17
**Must fix by:** before any church exists whose status is not `active`

The read-back added for FF-27 is filtered by the same RLS that governs reads,
and both select policies on `churches` and `church_theme` require
`status = 'active'`. So on a non-active church a *successful* write would read
back zero rows and be reported as a refusal - the inverse of the FF-27 bug.

Not reachable today: `getChurchSite()` uses the anon public client, so a
non-active church cannot load the portal at all. Both problems have the same
fix - a `pastor+ can view own church` select policy that does not test status -
and it should be done once, deliberately, rather than bolted onto draft 17.

---

## FF-29 - publish() calls updateTag against an unstable_cache entry

**File:** `app/(portal)/portal/details/actions.ts`, `app/(portal)/portal/website/actions.ts`, `lib/church.ts`
**Raised:** 2026-08-27
**Must fix by:** before Phase B goes live, or before `lib/church.ts` moves to `use cache`

`publish()` calls `updateTag(churchTag(slug))`, but `getChurchSite()` caches
with `unstable_cache({ tags: [churchTag(slug)] })`. Per the installed docs
(`node_modules/next/dist/docs/.../updateTag.md`), `updateTag` recognises tags
from two sources only: `fetch` with `next.tags`, and `cacheTag()` inside a
`use cache` function. `unstable_cache`'s `tags` option is invalidated by
`revalidateTag` / `revalidatePath`, and its own reference page marks the whole
API as replaced by `use cache` in Next 16.

So the `updateTag` call is a no-op, and the `revalidatePath("/", "layout")` on
the next line is doing all the invalidation. Nothing is broken today - that
second call is a bigger hammer than needed and covers it.

It matters because CLAUDE.md section 2 states the `updateTag` rule as
architecture ("Portal writes use `updateTag`, not `revalidateTag`"), and that
rule does not hold while the cache layer is `unstable_cache`. Someone will
eventually delete the `revalidatePath` line as redundant and quietly break
read-your-own-writes.

Two coherent end states - pick one, do not leave it as it is:

- Migrate `getChurchSite()` to `use cache` + `cacheTag()`, which makes
  `updateTag` correct and matches what CLAUDE.md already claims.
- Or drop `updateTag`, keep `revalidatePath`, and correct CLAUDE.md.

The first is the intended direction; `unstable_cache` is legacy in Next 16.

---

## FF-30 - RESOLVED - decision B2 (devotionals source) deliberately deferred

**RESOLVED 2026-09-01. Devotionals are live, syndicated from YourLife CC.**

The deferral was waiting on a decision nobody had made: who writes them. The
answer is that Church for Truckers does not - the 365 devotionals are ported
from the YourLife CC project (`app/js/faith.js`), the same source as the worship
playlist. Not pastor-authored, and the page no longer pretends otherwise.

`/devotionals` now shows today's reading with the archive behind it:
`lib/devotionals.ts` (the entries, server-only), `lib/devotional-day.ts` (the
rotation), `components/site/devotionals.tsx` (the render).

**Two things this surfaced that are NOT resolved:**

1. **Only 60 of the 365 ever appear as "today's".** The rotation is a
   line-for-line port of YourLife's `getDailyDevotionalIdx`, which shuffles
   positions 1..59 and indexes with `dayOfYear % 60` - so it can only ever
   return 0..59. Verified by running both implementations over four years of
   dates: 0 mismatches, and exactly 60 distinct indices reachable. Entries
   60-364 are reachable in the archive but never surface daily. That looks like
   an oversight in the SOURCE; it was copied deliberately so the two sites stay
   in step. Worth raising with whoever owns the YourLife content.

2. **The seeded hero copy is now wrong.** It reads "New ones most weekdays,
   straight from the team" - they are syndicated, not from the team, and all 365
   already exist. That text is pastor-editable in the portal, so it is a content
   fix rather than a code one, but it should not be left saying something untrue.

**Also note:** the day boundary is the SERVER's. `new Date()` runs in UTC on
Vercel while the YourLife app evaluates it in the reader's local zone, so a
visitor west of UTC can see tomorrow's devotional on the website before the app
agrees. Same class of thing as FF-38.

## FF-31 - events and sermons have no public read policy

**File:** `supabase/migrations/20_public_read_events_sermons.sql`
**Raised:** 2026-08-28, while building Phase B step 3
**STATUS: CLOSED 2026-08-28 - fixed and verified.**

Draft 20 applied. Both policies verified in place: `events` on
`published = true`, `sermons` on `status = 'published'`, each scoped to an
active church. Archived sermons stay excluded, confirmed as the deliberate
restrictive choice.

The public site reads with the anon key. The 2026-08-27 audit listed every
policy on the nine pre-migration-01 tables, and only four carry a policy the
anon role can use:

```
church_sections   public can view visible sections of active churches
gallery           public can view gallery of active churches
staff             public can view visible staff of active churches
videos            public can view videos of active churches
```

`events` and `sermons` have exactly two policies each - `pastor+ can edit` and
`staff+ can view` - and neither admits `anon`. An anonymous visitor reading
either table gets **zero rows**.

Not an error and not a 403: RLS filters the rows out and PostgREST returns an
empty array. So `/events` and `/sermons` render their seeded empty states and
look like a church that has not posted anything yet. Identical failure shape to
FF-27 - the operation is refused and the result reads as success.

Migration 01's own tables are fine; it wrote `groups: anon read visible`,
`ministries: anon read visible`, `announcements: anon read visible` and
`prayer_requests: anon read approved` at the time. `events` and `sermons`
predate it and never got the equivalent.

**Why this was invisible until now.** Nothing public read those tables before
step 3. The gap has existed since the schema was created.

**CONFIRMED BY EXECUTION 2026-08-28.** Draft 20 section 1b inserted a probe row
into each table - `events` with `published = true`, `sermons` with
`status = 'published'`, CFT active - then read both as the `anon` role inside
the same transaction and rolled back. Anon saw **0 rows in both**. The rows
existed in that transaction, so 0 can only be RLS filtering them.

One flaw in that probe worth not repeating: `staff` and `groups` were included
as controls but got no probe rows of their own, so their 0s are just empty
tables. A control that returns the same value under both hypotheses is not a
control. The result stands on the two tables that were actually seeded.

**The diagnostic problem it leaves.** From the browser, "empty because the
table has no rows" and "empty because RLS refused" look identical - both render
the same empty state. That is why draft 20 leads with an audit rather than going
straight to the fix, and why the code cannot tell you which one you are looking
at.

**And the audit itself got it wrong first.** Draft 20's original section 1 had a
column `anon_can_select` derived from `pg_policy.polroles`. It reported `true`
for every table, events and sermons included, which would have read as "no
problem here".

polroles records which ROLES a policy applies to, not whether its predicate can
ever be true. None of these policies was created with a `TO` clause, so they all
default to PUBLIC and polroles is `{0}` - the all-roles placeholder. The check
matched that for everything; it would have said `true` for `documents`.

The policies genuinely do apply to anon. Their predicates just resolve false for
it: `staff+ can view events` resolves through `church_members` on `auth.uid()`,
which is null for anon, so the subquery is empty and no row passes.

**The lesson: reachability cannot be read off the catalog.** A policy's
applicability and its satisfiability are different questions, and only the
second one decides what a visitor sees. Section 1b executes it instead - insert
a probe row, read as `anon`, roll back. A probe row is required because an empty
table returns 0 either way.

**Open question inside the fix.** `sermons.status` is
`draft | published | archived` per its column comment. Draft 20 admits
`published` only. If an archived sermon is meant to stay readable in an
archive rather than be withdrawn, widen it to
`status in ('published', 'archived')` - but that republishes anything
deliberately retired, so it is written the restrictive way until someone says
otherwise.

**Related and still unrun: draft 14 (FF-25).** `videos` has a public policy but
it does not filter `published`. Step 3 ships `/worship`, which is the first
public page to read that table - so the exposure stops being theoretical the
moment this deploys. `lib/collections.ts` filters `published` in the query as
defence in depth, but a query filter is not the boundary and must not be
mistaken for one.

---

## FF-32 - giving is Tithe.ly only; the seeded picker fields stay unrendered

**File:** `components/site/section-renderer.tsx` (GivingBand), `supabase/migrations/04_cft_sections_seed.sql`
**Decided:** 2026-08-28 by Jason. **Not open, not deferred.**

The Give button points at the `kind = 'giving'` row in `church_links` - for CFT
the Tithe.ly form seeded by draft 10. No Stripe, no amount picker, no
custom-amount field.

**Why this entry exists.** The seed for `home.giving_band` and `give.give_band`
carries a complete donation widget that nothing renders:

```
frequencies         ["One-time", "Monthly"]
amounts             [20, 50, 100, 250]
default_amount      50
custom_placeholder  "Or enter another amount"
submit_label        "Continue to giving"
```

Anyone reading those rows later will reasonably assume a renderer is missing.
It is not. Amount and frequency are chosen on the Tithe.ly form itself, so
collecting them beforehand would either be decorative or would require Tithe.ly
to accept them as URL parameters - a real integration nobody has asked for.

The section's `body` text also says "Handled by Stripe", which is now wrong for
CFT. Stripe remains a Phase E possibility; if it ever arrives, this entry is
where to start, and the seeded fields are already the right shape for it.

**Do not delete the seeded fields.** They cost nothing, they are the spec if
Stripe ever lands, and removing them would mean re-deriving the amount ladder
from the prototype.

**What to change if this reverses:** render the picker in `GivingBand`, and
decide where it submits before writing a line of it. That was the question that
made this a decision rather than an omission.

---

## FF-33 - contacts has no anon insert policy

**File:** `supabase/migrations/21_public_form_policies.sql`
**Raised:** 2026-08-28, while building Phase B step 4
**STATUS: CLOSED 2026-08-28 - fixed and verified.**

`contacts` has exactly two policies, `pastor+ can edit contacts` (ALL) and
`staff+ can view contacts` (select). Neither is satisfiable for `anon`, so a
visitor submitting the visit form is refused.

Unlike FF-27 this one fails **loudly**: an INSERT with no matching policy raises
42501, where an UPDATE is silently filtered to zero rows. It would have surfaced
on the first submission rather than pretending to work - which is the only
reason it is a blocker rather than an incident.

Draft 21 section 2 adds a constrained insert policy: `type` must be one of the
four the application uses, and the church must be active. Deliberately no SELECT
for anon - a visitor may write to this table and must never read it, since it
holds other people's names, emails and phone numbers.

---

## FF-34 - anyone with the anon key can publish to the prayer wall

**File:** `supabase/migrations/21_public_form_policies.sql`
**Raised:** 2026-08-28, while building Phase B step 4
**STATUS: CLOSED 2026-08-28 - fixed and verified by probe.** The pre-approved
insert is now refused with 42501, which is the check that mattered.

Migration 01 wrote:

```sql
create policy "prayer_requests: anon submit"
  on public.prayer_requests for insert
  with check (true);

create policy "prayer_requests: anon read approved"
  on public.prayer_requests for select
  using (status = 'approved');
```

`with check (true)` constrains **nothing**. The anon key ships in every browser,
so anyone can POST straight to `/rest/v1/prayer_requests` and choose every
column - including `status`. Setting `status = 'approved'` satisfies the read
policy, so arbitrary text publishes itself to a church's prayer wall with no
moderation. `church_id`, `prayed_count`, `approved_at` and `approved_by` are
equally unconstrained.

**Going through a Server Action does not help.** The action can set
`status = 'pending'` correctly and the direct POST still works. The REST
endpoint is public; the policy is the only thing in front of it. This is the
same lesson as `requirePortalUser()` being asserted per action rather than per
page - a public endpoint is a public endpoint.

**Second, separate problem in the same pair.** The read policy has no church
filter. `using (status = 'approved')` returns approved rows for **every**
church, so one church's prayer wall is readable from any other church's site or
with a bare anon key. That is the cross-tenant class this project treats as a
blocker before a second church has real data.

Neither is exploitable today: nothing public reads or writes `prayer_requests`.
Both go live the moment the bulletin ships, which is why the "Add a request" CTA
is deliberately not rendered yet - the prayer list displays, the form does not.

Draft 21 section 3 constrains the insert to `status = 'pending'`,
`prayed_count = 0`, null approval marks and an active church, and adds the
missing church scoping to the read.

---

## FF-35 - a probe that cannot fail is not a probe

**Raised:** 2026-08-28, after making the same mistake twice
**Status:** Reference. No action - this is a rule for writing future audits.

Two RLS probes in two days returned a number that looked like a verdict and was
not one:

- **Draft 20 section 1b** included `staff` and `groups` as controls but never
  inserted probe rows into them. Both returned 0 because the tables are empty,
  which is what they would have returned if RLS had blocked them too.
- **Draft 21 section 4b** inserted into `contacts` as `anon` and then counted
  the row *still as anon*. `contacts` has no anon SELECT policy by design, so
  the count returned 0 while the insert had actually succeeded. A 0 there reads
  as "the policy failed" and would send the next person chasing a policy that is
  fine.

Both have the same shape: **the check returns the same value whether or not the
thing under test worked.**

Rules for the next one:

1. **Seed what you measure.** A count over an empty table proves nothing. Insert
   a probe row inside the transaction, then roll back.
2. **Read with a role that can read.** `reset role` before counting, or do not
   count at all. Testing a write with a read is only valid where the same role
   can do both - which is exactly what these tables are designed to prevent.
3. **Prefer the raise over the count.** For INSERT, a refusal raises 42501. The
   statement completing without error IS the result; a count only confirms the
   row landed.
4. **Say what a failing run looks like** before running it. If you cannot state
   which output means "broken", the probe is not testing anything.

---

## FF-36 - decision B1 answered: bible-api.com, with ESV left as a stub

**File:** `lib/bible.ts`
**Decided:** 2026-08-28 by Jason. `/bible` is complete and shipping.

`/bible` reads through a swappable provider adapter. v1 is **bible-api.com** -
no key, no signup, public-domain WEB text. Selected with `KC_BIBLE_PROVIDER`;
absent or unrecognised falls back to bible-api, because a typo in an env var
should degrade to a working Bible page rather than an empty one.

**Attribution travels with the passage.** Every provider credits differently and
several make correct attribution a licence condition rather than a courtesy, so
`attribution` is a field on the returned passage and the renderer prints
whatever came back. Hardcoding a WEB credit would become quietly false the
moment the provider changed - the exact failure a swappable adapter exists to
prevent.

**UPDATE 2026-09-01: the ESV adapter is now IMPLEMENTED, and still off.**
Jason asked for the Bible page to use ESV. `fetchPassage` is written against
`GET https://api.esv.org/v3/passage/text/` with `Authorization: Token <key>`,
asks for prose (no headings, footnotes or rules), folds ESV's ~70-column
wrapping back into paragraphs, and returns Crossway's required credit line as
`attribution` - a constant in `lib/bible.ts`, because the API returns no credit
field and printing it is a licence condition.

**It activates only when BOTH `KC_BIBLE_PROVIDER=esv` and `ESV_API_KEY` are
set.** A key alone changes nothing. That is deliberate: writing the adapter did
not answer the licensing question below, and "we have a key" must not quietly
become "we are redistributing ESV to every tenant".

**Two things are still outstanding and neither is code:**

1. **The licensing question is unanswered.** Whether Crossway's terms cover
   redistributing ESV text across many churches' sites on a paid platform is
   the same open question it was on 2026-08-28. Someone has to read the terms
   or ask Crossway before `KC_BIBLE_PROVIDER=esv` is set in production.
2. **The key was never given to the agent and must not be.** It belongs in
   Vercel env vars and a local `.env.local`, set by Jason. As of this entry no
   `ESV_API_KEY` exists in either, so `/bible` is still serving WEB text
   through bible-api - which is why the adapter is untested against the live
   API. First real request is the first proof it works.

**Original note, still accurate:**

**ESV was a documented stub, not working code.** A key exists, left over from the
WordPress build. It is deliberately not wired up: ESV's terms are oriented to
non-commercial use with attribution and caching conditions, and whether they
cover redistributing ESV text across many churches' sites on a paid platform is
an open legal question. Shipping a working implementation would make it trivial
to enable before that is answered. `isConfigured()` returns true when the key is
present and `fetchPassage()` throws with a pointer to this entry.

To finish it once licensing is settled: implement against
`GET https://api.esv.org/v3/passage/text/` with an `Authorization: Token <key>`
header, and return their required credit line as `attribution`.

**Security note, 2026-08-28.** The leftover ESV token was pasted into a chat
transcript during this work. It should be rotated at api.esv.org regardless of
the licensing outcome. It was never written to a file in this repo; the adapter
reads `process.env.ESV_API_KEY` only.

**Input from the URL is normalised before it reaches a provider.** `?book=` is
checked against the church's own seeded book list and `?chapter=` clamped to
1-150 (Psalms is the longest book), both falling back to the section's defaults
rather than erroring. A hand-edited URL shows a real passage.

---

## FF-37 - subdomain to apex redirect, at cutover

**Raised:** 2026-08-28
**Do this:** at Phase D cutover. **Not before** - the subdomain is currently the
only working public address.

Once DNS moves, `churchfortruckers.org` and
`church-for-truckers.kingdom-creatives.com` serve byte-identical pages. Two URLs
for one site fragments links, bookmarks and search results.

**Decision: 308 redirect, subdomain -> apex.** Not a canonical tag.

- A canonical is a hint search engines may ignore, and it leaves both URLs
  returning 200, so the split persists for anyone sharing a link.
- Direction is the church's own domain, because that is what goes on business
  cards and truck stop flyers. The subdomain is platform plumbing.
- The subdomain must keep working as a redirect permanently, so links shared
  during the trial period survive.

**Exempt `/portal`.** It is already `noindex`, and the pastor may be signed in
on the subdomain - redirecting it would bounce him out of a live session.

Shape: a rewrite/redirect rule in `vercel.ts` matching the subdomain host for
everything except `/portal`. Verify after cutover that a signed-in portal
session on the subdomain survives.

**Sequenced in `docs/CUTOVER_PLAN.md` step 5** - after the apex is verified
working, not before. A redirect added early would send traffic to a hostname
that is not serving yet.

---

## FF-38 - event times are stored as UTC wall-clock, not real instants

**File:** `lib/portal/collection-write.ts` (`nullableTimestamp`), `components/portal/events-editor.tsx`
**Raised:** 2026-08-28, while building the Events tab
**Must fix by:** before anything exports an event with real timezone meaning -
a calendar file, a reminder email, or a second church in another zone.

`<input type="datetime-local">` posts `2026-09-13T10:30` with no timezone, and
there is nowhere to look one up: `churches` has no timezone column, and only
`service_times` carries a `tz`, per slot. Events are not service times.

So the typed wall-clock is **pinned to UTC** rather than left to
`new Date(raw)`, which would interpret it in whatever zone the server runs in.
Vercel runs UTC so the two agree today - but "happens to agree" is not a rule,
and a region change would silently shift every event by hours. Pinning makes the
behaviour explicit instead of incidental.

The events list formats with `timeZone: "UTC"` to match, so the pastor types
10:30 and every reader sees 10:30 regardless of their own zone.

**What this is and is not.** The site is self-consistent and predictable. The
stored instant is NOT the real instant unless the church is on UTC - so an
event at 10:30 CT is stored as 10:30Z, six hours off. That is invisible while
the only consumer is our own page, and wrong the moment something leaves the
site carrying timezone meaning.

**The fix** is a timezone column on `churches`, defaulting to the church's own
zone, with the input converted on write and rendered in that zone on read. That
is a schema change, so it is a draft rather than a decision to make inside a
helper. It should land before a second church exists in a different zone, since
at that point the bug stops being uniform and starts being per-tenant.

Groups avoid this entirely: `meeting_day`, `meeting_time` and `meeting_tz` are
separate text columns, so "Tuesdays 7:00 PM CT" is stored as the church wrote
it and never parsed into an instant at all. That is the cheaper model for a
recurring meeting, and worth remembering if the events model is revisited.

---

## FF-39 - `gallery` is superseded by `church_media`

**File:** live schema; `supabase/drafts/23_media_library.sql`
**Raised:** 2026-08-28, while scoping the media library
**Do this:** after `church_media` is proven in use. Not urgent.

`gallery` is a display collection - `image_url`, `caption`, `sort_order`. The
media library needs an asset store, which is a different question: an event
photo must be storable without appearing in the public photo gallery.

`church_media` answers both, with `in_gallery` marking the subset that also
appears publicly. That is one row per file and one place to look.

`gallery` today has zero rows, no section in the seed, no renderer, and no fetch
in `lib/collections.ts`. Nothing migrates. Draft 23 deliberately does NOT drop
it: dropping a table with a live RLS policy is reversible only from a backup,
and there is no cost to leaving it.

Retire it once the Photos tab has real uploads. Until then it is dead weight
that will confuse the next person reading the schema for "where do images live".

---

## FF-40 - `media_id` and the legacy `*_url` columns are two sources for one fact

**File:** `supabase/drafts/23_media_library.sql` section 6
**Raised:** 2026-08-28
**Resolve by:** when the Photos tab has replaced every hand-pasted URL.

Every table that takes an image already had a text column - `events.image_url`,
`staff.photo_url`, `groups.image_path`, `church_theme.logo_url`. Draft 23 adds
`media_id` alongside rather than replacing them, because the Our Team form
already accepts a pasted URL and a pastor may have used it.

**Precedence is defined: `media_id` wins; the URL is read only when `media_id`
is null.** Renderers must follow that and nothing else.

This is deliberately the same shape as `churches.giving_url` after the
`church_links` decision - a column kept working while its replacement proves
itself, then retired. It is acceptable only while it is temporary. Two live
sources for one fact is how they drift, and the drift is silent.

Retire by: nulling the `*_url` columns once every image is a library item, then
dropping them in their own draft.

---

## FF-41 - orphaned storage objects have no sweeper

**File:** `app/(portal)/portal/photos/actions.ts`
**Raised:** 2026-08-28, while building the Photos tab
**Must fix by:** not urgent. Revisit when storage cost becomes visible, or
before a second church is paying for it.

A file can end up in the `church-media` bucket with no `church_media` row
pointing at it, in two ways:

1. The browser upload succeeds and `recordUpload()` then fails. The file is
   there; nothing describes it.
2. `removeMedia()` deletes the row and the subsequent storage removal fails.
   Logged as `orphaned storage object`, not surfaced.

Both orderings are deliberate and both pick the same direction: **an invisible
file that costs a little storage beats a visible row pointing at a file that is
not there**, which renders as a broken image on the public site.

Nothing cleans them up. Today that is fine - one church, a handful of photos,
and a bucket bill measured in cents. It stops being fine when churches pay for
storage and are being charged for files they cannot see.

The sweep is a scheduled job listing bucket objects per church prefix and
deleting any with no matching `storage_path`. It must run with the service role
(listing across churches) and must be careful about the race in case 1: a file
uploaded seconds ago may have a row that has not been written yet, so anything
younger than a few minutes has to be left alone.

---

## FF-42 - church_media public read was gated on in_gallery

**File:** live schema; fix drafted in `supabase/drafts/24_media_public_read.sql`
**Raised:** 2026-08-28, by Jason, after the media picker shipped
**Must fix by:** BLOCKER - picked photos do not appear on the public site

Draft 23 gave `church_media` a public policy of
`in_gallery = true AND church_id in (active)`. That predicate was written for
the photo gallery and then reused, unexamined, as the policy for every public
read of the table.

The media picker made the difference matter. A photo chosen for a team member
or an event, and not ticked into the gallery, is invisible to `anon`. The
PostgREST embed returns null, no image renders, and nothing reports an error.

**Write succeeds, portal says saved, public page shows nothing.** The same shape
as FF-27 and FF-31, for the third time.

### How it got through

The FK was verified. The generated types carried all four relationships, so the
embeds typechecked. `tsc`, `eslint` and `next build` all passed, and every page
returned 200.

None of that touches whether `anon` can READ the embedded row. FF-35 already
states the rule - reachability has to be executed, not inferred - and it was
applied to drafts 20, 21 and 22 and then not applied to the feature work that
depended on them. **A typecheck proves the query is well-formed; only an anon
read proves it returns anything.**

**Promoted to a standing rule 2026-08-28: CLAUDE.md ground rule 4a.** Three
occurrences is a pattern, not a note - it belongs in the file that is read at
the start of every session, not in an entry someone has to go looking for.

### The decision, and what it costs

Two options. Expose every media row of an active church and let `in_gallery`
control only gallery membership; or admit only rows referenced by something
already public.

**Chose the first.** The second is tighter but needs four `EXISTS` subqueries
against `events`, `staff`, `groups` and `church_theme`, each wanting an index -
and it **fails silently the next time** a fifth referencing table is added and
the policy is not widened. That is this exact bug, re-armed. A design that
cannot fail quietly beats a tighter one that can, when the thing being
protected is low-sensitivity.

It protects little in any case: **the bucket is public.** The file is served
without auth to anyone with the URL, whatever the table policy says. The policy
governs the metadata row, not the image.

**What is genuinely given up:** the library becomes enumerable. Anyone with the
anon key can list every photo a church has uploaded, including one uploaded and
never used - previously guessable-ish rather than discoverable. `uploaded_by` is
revoked from `anon` because a user id has no business being public, but titles,
dimensions and paths are readable.

If that ever matters, the fix is a private bucket with signed URLs for
unreferenced media - a bigger change than a policy, and not worth making before
someone actually wants it.

---

## FF-43 - no password reset in the app

**File:** `app/(portal)/portal/login/page.tsx`, `components/portal/login-form.tsx`
**Raised:** 2026-08-28
**Must fix by:** before Phase E provisions churches self-serve.

There is no "forgot password" anywhere in the portal. A pastor who forgets his
password is stuck until someone resets it in the Supabase dashboard.

Fine at one church with Jason a phone call away. Not fine the moment churches
are provisioned without a person attached to each one - a locked-out pastor with
nobody to ask is a support failure that reads as the product being broken.

Supabase provides `resetPasswordForEmail()` and a recovery flow; it needs a
route to land on, an email template, and a page that consumes the recovery
token. Not large, but it is real work and needs the Brevo sender decided first,
since the default Supabase sender will land in spam from a domain nobody
recognises.

**Related, same category:** there is no sign-up, deliberately - a church portal
is not something strangers register for, and `12_grant_portal_access.sql` says
so. Password reset is the one self-service flow that has to exist without
opening that door.

---

## FF-45 - the "Three ways in" cards are not editable in the portal

**File:** `lib/portal/sections.ts`, `supabase/migrations/04_cft_sections_seed.sql`
**Raised:** 2026-08-31
**Must fix by:** not urgent - but it is why FF-46 needed SQL rather than a portal edit.

`get_connected` stores `eyebrow`, `heading` and `cards`. The registry declared
`headline` and `body` - **neither of which the seed has**. So Edit My Website
showed two empty boxes writing keys nothing renders: editing them appeared to
save and changed nothing on the page.

Corrected 2026-08-31 to `eyebrow` and `heading`, which are real.

`cards` is still not editable, and that is the remaining gap. It is a list of
objects (kicker, title, body, href) and the section editor only edits scalars -
`FieldKind` is `text | textarea | image | url`. Changing a card's destination
therefore needs SQL, which is how FF-46 had to be fixed.

The same limit applies to every list-shaped section: `faq.items`,
`timeline.stops`, `beliefs.items`, `expect.items`, `mile_stats.items`,
`other_ways.items`. All render; none can be edited. That is a bigger gap than
this entry and worth its own decision - a repeating-group editor, or accepting
that structured content is seeded and only prose is pastor-editable.

---

## FF-46 - CLOSED - two of the three "Three ways in" links went to the wrong place

**File:** live data; fixed by `supabase/migrations/26_fix_get_connected_links.sql`
**Closed:** 2026-08-31. Draft 26 run by Jason; section 3 returned the three
expected rows in order. Verified per ground rule 4a against the SERVED
production HTML, not the query output: churchfortruckers.org renders
`/groups`, `/about#ministries`, `#prayer` in that order, and both anchor
targets resolve (`id="prayer"` on home, `id="ministries"` on /about).
**Raised:** 2026-08-31 by Jason
**Must fix by:** before cutover - these are on the home page.

The hrefs live in `church_sections.content`, not in code.

| Card | Was | Should be | Verdict |
|---|---|---|---|
| Find your convoy | `/groups` | `/groups` | correct, untouched |
| Where gifts go | `/about` | `/about#ministries` | right page, wrong landing |
| Add a request | `/visit` | `#prayer` | **wrong page** |

**The prayer card is the real bug.** `/visit` holds `page_hero`, `expect`, `faq`
and `visit_form` - verified by fetching it, where "prayer" appears only in prose
and a form placeholder. The prayer wall is the `bulletin` section on the HOME
page, the same page the card sits on. A visitor clicking "Add a request" landed
on the Plan-a-Visit form, which asks different questions entirely.

It came from the prototype faithfully - that pointed at `#/visit` too, in a
mockup where every page was one scrolling document and the distinction did not
exist.

`/about` was never wrong as a page: ministries do render there. It landed at the
top, so someone asking "where do gifts go" read the founding story and a
statement of faith first. Anchor targets `#ministries` and `#prayer` were added
in the same change.

**Not the Prayer Wall placeholder.** Two different things share that name: the
PUBLIC prayer wall (home bulletin) is built and works; the PORTAL Prayer Wall
tab is a placeholder. The link was pointing at the wrong page, which is a
separate fault from anything unfinished. See FF-47 for what is unfinished.

---

## FF-47 - MODERATION CLOSED - a prayer request can be submitted but never approved

**File:** `lib/portal/nav.ts` (`/portal/prayer`, `built: false`)
**Raised:** 2026-08-31, while tracing FF-46
**Must fix by:** before the prayer wall is advertised to anyone.
**CLOSED 2026-09-01. A request was moderated end to end on production.**

Jason approved a real prayer request through the deployed Prayer Wall tab. The
row went to `status = 'approved'` with `approved_at` and `approved_by` stamped,
the anon count moved from `Content-Range: */0` to `0-0/1`, and
churchfortruckers.org rendered it on the wall.

The check could genuinely fail, which is why it counts: a second request was
still `pending` at the time and stayed **invisible** on the same page. One
approved row appearing while one pending row does not is proof of the filter,
not of a page that happens to render something.

`approvePrayer` therefore works end to end - portal write, RLS, public read and
render. The moderation half of this entry is done.

**Still open, and not fixable from this tab:** the acknowledgement half below.
`supabase/migrations/27_prayer_moderation_probe.sql` has since been run and
confirmed that `private` and `archived` requests stay invisible to anon, so the
"Keep private" action is safe as well.

The original entry, and the still-open acknowledgement problem, follow.

**Superseded status note, kept for the record:** the tab was built before it was
deployed.

Jason submitted a real request on 2026-09-01 to test it and saw nothing, which
was not a bug: the tab was still uncommitted local work and production was
serving the placeholder. Worth recording because "built" and "deployed" read the
same in a status report and are not the same thing. The submission did prove the
public write path on production - draft 21's insert policy accepted it and
stamped `status = 'pending'` with null `approved_at` / `approved_by`.

Remaining to close: moderate that row in the deployed portal, then confirm it
appears on the public wall (an anon read of `prayer_requests` returns
`Content-Range: */0` today, so a non-zero count afterwards is a check that can
genuinely fail). `supabase/drafts/27_prayer_moderation_probe.sql` covers the
`private` and `archived` statuses, which no real row has ever held.

The acknowledgement half of this entry is NOT addressed and cannot be from this
tab - `prayer_requests` stores no contact detail by design, so there is nobody
to notify. That needs an optional email column and is its own decision.

The public prayer form works. A submission lands in `prayer_requests` as
`status = 'pending'`, exactly as designed, and the seed promises the visitor
"Requests are read by a person before they appear here."

**Nobody can read them.** The public site shows `status = 'approved'` only, and
the sole route from pending to approved is the portal's Prayer Wall tab, which
is a placeholder. So:

- the wall is permanently empty, whatever anyone submits
- a visitor sees their request vanish and no acknowledgement it was received
- the promise in the seed's own copy is not currently true

Not a data problem - `prayer_requests: member full access` means a pastor could
approve one in SQL. There is simply no screen.

**This does not block FF-46.** The form works and submissions are stored, so
pointing the card at it is right. But the loop does not close until the Prayer
Wall tab ships, and that tab is now more urgent than its "coming soon" label
suggests: it is the only thing standing between a submitted request and the wall
it was submitted to.

---

## FF-48 - CLOSED - the About text box wiped the paragraphs it was supposed to edit

**File:** `lib/portal/sections.ts`, `app/(portal)/portal/website/actions.ts`,
`app/(portal)/portal/website/page.tsx`, `components/portal/section-editor.tsx`
**Raised:** 2026-08-31 by Jason, as an active data-loss bug
**Closed:** 2026-08-31, same session. Fix and verification below.

### What it was

`home.about_strip.body` is stored as a LIST of paragraphs. The section registry
declared it `kind: "textarea"` - a scalar. Nothing reconciled the two, so:

1. the read side coerced the list to `""` (it was not a string), and the box
   rendered EMPTY even though it held two paragraphs;
2. the pastor typed into what looked like a blank field and saved;
3. the write side stored that string over the array;
4. `AboutStrip` reads the key with `strings()`, which returns `[]` for anything
   that is not an array - so the section rendered nothing at all;
5. the portal reported **"Saved."**

Silent, total, and reported as success. The one failure mode that gives a user
no signal anything went wrong.

### Why nothing caught it

Both halves were independently well-typed. `tsc` was happy: the read side
correctly produced a `string`, the write side correctly consumed one. They were
just describing different shapes for the same key, and no type connected them.
The registry was the only thing that could have connected them, and the registry
was wrong.

Same shape as FF-45: a registry entry that does not match the data it claims to
edit. This one was worse because the mismatch was destructive rather than inert.

### What was wrong, per section

A three-way audit (registry field names vs seeded content vs live content) over
every section on all eleven pages found six faults in four sections:

| Section | Field | Fault |
|---|---|---|
| `home.about_strip` | `body` | **DESTRUCTIVE** - `textarea` over a `list[str]` |
| `home.about_strip` | `headline` | phantom - the data has `heading` |
| `home.giving_band` | `headline` | phantom - the data has `heading` |
| `give.give_band` | `headline` | phantom - the data has `heading` |
| `visit.expect` | `headline` | phantom - the data has `heading` |
| `visit.expect` | `body` | phantom - the data has `items` |

Phantom fields are not destructive but they are their own bug: the box appears,
accepts text, reports success, and changes nothing on the page. Four of the five
were a `headline`/`heading` slip - the same word, the wrong one, never checked
against the data.

### The fix

1. **Registry corrected** - real key names, and `about_strip.body` declared with
   a new `kind: "paragraphs"`. `visit.expect` keeps only `heading`; its `items`
   are a list of objects the editor cannot represent (FF-45).
2. **`lib/portal/field-values.ts` (new)** - `fieldToText` and `textToField`, the
   read and write conversions, as a stated inverse pair in ONE file. They were
   two independent copies in two files, and the bug was the copies disagreeing.
   Both call sites now import from here, so they cannot drift apart again.
3. **`wouldFlatten` guard** - `saveSectionContent` refuses any write that would
   replace a stored list or object with a plain string, independent of the field
   kinds. A future mis-declared field can now only ever cause a save that
   visibly did not happen, never a page that quietly emptied.
4. **The editor renders `paragraphs`** as a tall textarea, blank line between
   paragraphs.

### Verification (ground rule 4a)

- Anon read of the four live sections: **http 200, 4 rows**.
- Live `home.about_strip.body` was checked against the seed and is **intact** -
  two paragraphs, byte-identical. The bug was reachable but had not yet fired on
  production data, so no restoration SQL is needed.
- The real exported functions round-tripped over the real live content:
  **24/24 pass** - unchanged saves preserve all paragraphs, edits add/replace
  correctly, stray blank lines do not produce empty entries, scalars are
  untouched, and the guard refuses to flatten all nine structured keys that
  exist live while permitting normal scalar and null writes.
- All three pages fetched and their stored values found in the rendered HTML:
  **9/9**.
- Audit re-run after the fix: **0 phantom, 0 destructive, 16 clean sections.**

### What this does not cover

An end-to-end save driven through the authenticated portal UI was not performed
- that needs the pastor login. What was verified is the exact conversion code
the save calls, over the exact live data, plus the guard that sits in front of
the write. The chain from stored value to rendered page is confirmed; the click
that triggers it is not.

### Known limit left standing

Twelve sections render structured content with no portal fields at all:
`about.about_ctas`, `about.beliefs`, `about.timeline`, `bible.reader`,
`events.event_filters`, `give.other_ways`, `groups.group_filters`,
`home.events_preview`, `home.mile_stats`, `visit.faq`, `visit.visit_form`,
`worship.worship_filters`. Not a bug - no box is shown, so nothing can be lost.
Sized here so the gap is known. That is FF-45's remaining scope.

### Rule this earns

**Any registry field must be checked against the data it claims to edit before
it ships** - both that the key exists, and that its stored shape matches the
declared kind. A field name that looks obviously right (`headline` for a
heading) is exactly the one that does not get checked.

---

## FF-49 - the updateTag no-op is platform-wide, not two files

**File:** `lib/portal/collection-write.ts` (`publishChange`), `lib/collections.ts`,
`lib/links.ts`, `lib/sections.ts`, `lib/church.ts`, and the eleven portal
actions files that call `publish()` or `publishChange()`
**Raised:** 2026-09-01, while diagnosing "I edited an event and the site did not
change" (which turned out to be unrelated - the events were simply not
published)
**Must fix by:** with FF-29. They are one fix, not two.

### What this adds to FF-29

FF-29 is correct and its analysis holds exactly. It just scoped the problem to
`publish()`, two actions files and `getChurchSite()`. The same no-op is
everywhere:

**Four cache modules, all `unstable_cache` with `tags: [churchTag(slug)]`:**

| Module | Cached reads |
|---|---|
| `lib/collections.ts` | staff, groups, events, sermons, videos, announcements, prayer, ministries |
| `lib/church.ts` | the church + theme |
| `lib/links.ts` | church_links |
| `lib/sections.ts` | page sections |

**Eleven actions files invalidate them,** through one of two helpers that both
call `updateTag`:

- `publishChange()` in `lib/portal/collection-write.ts` - announcements, events,
  groups, ministries, photos, prayer, details/links
- `publish()` - details, sermons, team, website

So every public read on the site is behind a tag that nothing invalidates, and
every portal write pairs a dead `updateTag` with the `revalidatePath("/",
"layout")` that is actually doing the work.

### Still not a live bug, and here is the evidence

Checked on production 2026-09-01: the home page returned `X-Vercel-Cache: MISS`,
`Age: 0` - freshly rendered. `revalidatePath("/", "layout")` covers every route
these caches feed, so read-your-own-writes works today.

The exposure is bounded and worth stating precisely: `revalidate: 60` means the
worst case if `revalidatePath` ever fails to reach an entry is 60 seconds of
stale content, not indefinite staleness. That is why this has never been
noticed.

### Why it is worth fixing anyway

1. **CLAUDE.md section 2 states the wrong rule as architecture** - "Portal
   writes use `updateTag`, not `revalidateTag`". That is false while the cache
   layer is `unstable_cache`, and it is written where a future session will read
   it as settled.
2. **The dead call looks load-bearing.** Someone tidying `publishChange()` will
   delete the `revalidatePath` as the redundant one - it is the line that looks
   like a blunt instrument next to a precise tag call. That silently breaks
   read-your-own-writes across every tab at once.
3. **It cost real diagnostic time.** The event-not-updating report above was
   investigated partly down this path before the actual cause (`published =
   false`) turned up. A known-dead call in the write path is a standing false
   suspect for every staleness report.

### The fix is still FF-29's, applied wider

Same two coherent end states, and the choice has not changed - migrate to
`use cache` + `cacheTag()`, which makes `updateTag` correct and matches what
CLAUDE.md already claims, or drop `updateTag`, keep `revalidatePath`, and
correct CLAUDE.md. `unstable_cache` is legacy in Next 16, so the first is the
intended direction.

What this entry changes is the size of the job: it is four cache modules and
two helpers, not one function. Doing it piecemeal would leave the codebase in a
state where `updateTag` is correct in some paths and dead in others, which is
worse than either end state.

---

## FF-50 - the legal pages are a TEMPLATE and have not had legal review

**File:** `lib/legal.ts`, `app/(public)/{privacy,terms,cookies}/page.tsx`
**Raised:** 2026-09-01
**Must fix by:** before the platform takes a second paying tenant, and before
anyone relies on these documents in a dispute.

**Nobody with a licence has read this text.** It was written by an agent against
an audit of the codebase and is published on a live church website. That is
better than the boilerplate alternative in one specific way - the factual claims
were checked rather than assumed - and it is still not legal advice, not
reviewed, and not sufficient for a platform that intends to sign up churches.

### What IS trustworthy about it

The factual statements were verified against the running system on 2026-09-01,
not copied from a generator:

| Claim | How it was checked |
|---|---|
| the public site sets no cookies | live `curl -D -` on `/` and `/portal/login` - no `Set-Cookie` |
| fonts are not fetched from Google | `next/font/google` self-hosts at build; served from `/_next/static/media/*.woff2` |
| YouTube is contacted only after clicking play | browser check on the facade - only `i.ytimg.com` before the click |
| no payment data reaches the platform | giving is an outbound link to Tithe.ly; no card fields exist anywhere in this repo |

**If any of those change, `lib/legal.ts` becomes false and must change with the
code.** The header comment in that file says so; this entry is the second place
it is written down, because the first will be missed.

### What is NOT trustworthy

- No lawyer has reviewed the wording, the structure, or whether it satisfies any
  particular regime.
- It does not name a jurisdiction beyond "the state in which the church is
  established", and does not address CCPA, GDPR or state-level privacy statutes
  by name.
- The children's section asserts a policy that nothing technically enforces.
- Whether "prayer requests are kept until the church deletes them" is a
  defensible retention position has not been tested.

### The structural decision, which IS deliberate

Platform templates, not `church_sections` rows. Recorded because it will look
like an omission later:

1. `church_sections` is pastor-editable by design. Legal text there means a
   pastor can edit "we never see your card number" into something untrue.
2. A template renders for a new tenant on day one. Seeded rows would need a
   data migration per church before `/privacy` resolved, and the failure mode is
   a 404 where a policy should be.
3. The wording is the platform's; only the facts are the tenant's. Name, domain,
   contact and address come from the `churches` row and are never typed in.

---

## FF-51 - "Powered by Kingdom Creatives" is hardcoded, not per-tenant

**File:** `components/site/site-footer.tsx`
**Raised:** 2026-09-01, while building the footer
**Must fix by:** whenever a tenant first asks to remove it, or before pricing
tiers are defined - whichever comes first.

The footer's attribution line and its link to kingdom-creatives.com are
constants in the component. Every tenant gets them, and no tenant can turn them
off.

On a white-label platform that is backwards. Removing the builder's mark is a
normal paid tier, which makes this a per-tenant setting - most likely a column
on `churches` (`show_attribution boolean default true`) or a field on whatever
plan model Phase E introduces.

**Deliberately not built yet.** Inventing a schema column for a pricing model
that does not exist would be guessing at the shape of Phase E, and a wrong guess
is harder to remove than a constant. Flagged with Jason at build time and left
hardcoded on purpose.

When it is built, note that the footer is shared by every page including the
legal ones, so the setting needs to reach `SiteFooter` on all of them - the
church record is already passed to each, so there is no plumbing problem.

---

## FF-52 - experimental.viewTransition is ENABLED and is load-bearing

**File:** `next.config.ts`, `components/site/scripture.tsx`,
`types/react-view-transition.d.ts`, `app/(public)/site-overrides.css` section 11
**Raised:** 2026-09-01, at the moment of enabling it
**Must fix by:** not a defect. This entry exists so a future session knows the
flag is deliberate, what depends on it, and how to remove it safely.

### What is on

`experimental.viewTransition: true` in `next.config.ts`, plus React's
`<ViewTransition>` around the Bible passage. It gives chapter navigation a
directional page-turn: forward slides the old passage left and the new one in
from the right, back reverses it.

It is **experimental in Next and rides on React canary features**. That is the
entire reason it lives in its own commit (`git log` - the commit after
"landing page motion, and chapters that no longer lurch"). Dropping that one
commit removes the flag, the wrapper, the type declaration and the CSS layer
together, and the reader falls back to a plain CSS slide with nothing broken.

### The type declaration is not a hack, and it is not optional

`types/react-view-transition.d.ts` declares `ViewTransition` on the `react`
module. It is needed because of a real split:

  next/dist/compiled/react   exports ViewTransition   <- what Next actually uses
  react@19.2.4               does not
  @types/react@19.2.17       does not

With the flag on, Next aliases `react` to its vendored copy, so the import
resolves and runs correctly; only TypeScript cannot see it. The declaration
describes the props rather than silencing the line with `@ts-expect-error`,
which would also suppress any genuine future error there.

**Delete that file when the flag goes, or when @types/react ships the real
declaration.** It is dead weight in either case and misleading in the first.

### What was verified at the time, on the real build

- `next build` succeeds with the flag on. No warnings, no errors.
- `/`, `/bible` and `/give` all return 200 with full content.
- No hydration warnings or console errors, on first load or after navigating
  between chapters.
- Chapter navigation still works and still does not jump to the top:
  Psalms 23 -> 24 left scrollY at 797 with the passage in view.
- The two motion layers do not double up. The baseline slide is wrapped in
  `@supports not (view-transition-name: none)`, and in a browser that supports
  view transitions the passage's computed `animation-name` is `none` - measured,
  not assumed. A browser without support gets the baseline and none of the
  view-transition rules match.

### Reduced motion

Handled differently here on purpose. Everything else on the site puts motion
*inside* `prefers-reduced-motion: no-preference`, so static is the default.
Browser-generated `::view-transition-*` pseudo-elements cannot be guarded that
way, so section 11 uses the kill-switch form instead - zeroing
`animation-duration` and `animation-delay` under `reduce`, which makes the
browser swap content instantly, exactly as it would without the API.

Directional slides are the highest-risk motion on the site for vestibular
sensitivity. If this flag is ever removed, that kill switch can go with it.

### If it misbehaves

Symptoms worth watching for that would not have shown up in one session:
flashes between chapters on Safari, transitions firing on first load (the
`default: "none"` mapping is what prevents that), or hydration warnings
appearing after a Next upgrade. Any of those - revert the commit rather than
patching around it. The baseline underneath is known good.

---

## FF-53 - the YouTube quota ceiling: hourly refresh stops scaling near 100 tenants

**File:** `lib/youtube.ts`
**Raised:** 2026-09-01, while building the sermon auto-pull
**Must fix by:** before the platform passes roughly 50 paying tenants. Not a
defect today; a wall with a known distance to it.

### The arithmetic

YouTube Data API v3 gives a Google Cloud project **10,000 quota units a day**,
and this is **one shared platform key** - every tenant draws on the same budget.

The endpoints were chosen to make that budget go as far as possible:

| Call | Cost | Why |
|---|---|---|
| `search.list` with a channelId filter | **100 units** | the obvious approach, and never used here |
| `channels.list` -> uploads playlist id | 1 unit | cached a day; the id never changes |
| `playlistItems.list` on that playlist | 1 unit | up to 50 videos |

That is **2 units per channel per refresh** instead of 100. Using `search.list`
would have made everything below 50x worse, and it is what most examples show.

```
CFT today, hourly:    2 channels x 2 units x 24  =    96 units/day    1%
50 tenants, hourly:  50 x 2 x 2 x 24             = 4,800 units/day   48%
100 tenants, hourly: 100 x 2 x 2 x 24            = 9,600 units/day   96%   <-- wall
100 tenants, daily:  100 x 2 x 2                 =   400 units/day    4%
```

### The nuance that buys time

`unstable_cache` refreshes LAZILY - the fetch happens only when someone
requests the page after the window expires. A tenant with no traffic that hour
costs nothing, so the table above is a worst case assuming continuous traffic
on every tenant simultaneously. Real consumption will be well under it.

That is a reason not to panic, not a reason to ignore it. Traffic is exactly
what a successful platform gets more of.

### What to do when it gets close

In rough order of preference:

1. **Lengthen the window per tenant.** A church posting weekly does not need an
   hourly check. Six-hourly cuts consumption 6x and nobody notices.
2. **Request a quota increase.** Google grants these for legitimate use; it is
   a form, not a purchase.
3. **Per-tenant keys.** Correct long-term for a platform - each church's usage
   billed to its own project - but it is a settings surface, a validation
   story, and a support burden. Not worth it before the ceiling is real.
4. **Persist and sync on a schedule.** Deliberately rejected for now: it needs
   job infrastructure and reintroduces the drift that the merge-not-sync design
   avoids. See `lib/sermon-feed.ts`.

### How the failure presents, which is the dangerous part

Quota exhaustion returns **403**, and every failure path in `lib/youtube.ts`
returns `[]`. An empty list renders the page's ordinary empty state, so a
platform over quota looks exactly like a church that has not posted anything.

That is why both failure paths log with the cause named -
`quota exhausted or key restricted` - rather than failing silently. If sermon
lists ever go quiet across several churches at once, read the logs before
believing the data.

---

## FF-54 - the worship playlist is tenant data living in code

**File:** `lib/worship-playlist.ts`, `components/site/worship-grid.tsx`
**Raised:** 2026-09-01, after the fact - the playlist shipped in `b8b7531` with
no entry recording what was owed.
**Must fix by:** before a second church needs a worship page. Not urgent while
the platform has one tenant; blocking the day it has two.

### What is there

Thirty songs on `/worship`, ported verbatim from the YourLife CC project
(`app/js/worship.js`), each `{ id, title, artist, duration }`. They are Church
for Truckers' set - hand-curated by someone, for that church - and they live in
a TypeScript module.

`WORSHIP_CATEGORY = "music"` maps them onto the page's own seeded filter
("Worship sets"), so no new filter was invented and Driver Stories correctly
excludes them.

### Why this is an entry and not just a file comment

`lib/worship-playlist.ts` explains itself perfectly well. What it cannot record
is the DEBT: **a per-church table is still owed.** Right now a second tenant
would get Church for Truckers' worship songs, because there is nowhere else for
songs to come from. That is a gap, and gaps belong here.

Same shape as FF-30's devotionals, which landed with an entry; this one landed
without.

### What was done to make the eventual move cheap

The file holds the songs, a type, and the category constant - nothing else. No
rendering code inlines a song and no component imports a specific one:
`WorshipGrid` takes a `WorshipSong[]` and does not know where it came from.
Point the page at a query and the data file is deleted with nothing else to
change.

### Why not church_links

`church_links` stores DESTINATIONS - one row, one URL. A track list is not a
destination, and forcing thirty rows of `{title, artist, duration}` into a table
built for "here is our Facebook page" would be the wrong shape twice over.

A YouTube playlist id WOULD have fit `church_links` and would auto-update. There
isn't one: the YourLife project never had a playlist, only the array. That was
checked before porting, not assumed.

### The metadata is not recoverable if dropped

`artist` and `duration` are hand-written. YouTube's Data API returns neither in
that form, so a future migration must carry them across rather than plan to
re-derive them from the video ids.

### Related

FF-30 - the devotionals, the same situation with 365 entries and the same debt.
Whatever table shape solves one should be considered for both, though they are
different enough (a track list versus dated prose) that one table for both is
probably the wrong instinct.
