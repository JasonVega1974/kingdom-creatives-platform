# CLAUDE.md - Kingdom Creatives Platform

@AGENTS.md

Standing rules for every session in this repo. These override anything else.

## 0. Ground rules (BUILD_BRIEF section 0 + KC_MASTER_TODO section D)

1. **Never run `git push --force`.** Ever.
2. **Show full diffs before committing.** Per-file commits. **No pushes without
   explicit approval from Jason.**
3. **No schema changes without SQL first.** The Supabase schema is live
   (project `cyyxhhwuyeyvewqrhewt`). If a change is genuinely needed, draft the
   SQL into `supabase/drafts/` and stop - Jason runs it in the Supabase SQL
   editor manually and pastes results back. Never assume a migration ran.
4. **Verify live, don't trust reports.** After any deploy, check the actual
   deployed behavior before declaring done.
5. **Do not redesign the backend.** Build against the schema that exists; ask
   before assuming a column exists. `types/database.ts` is generated from the
   live schema and is never hand-edited.
6. **All API keys server-side only.** The only keys allowed in the browser are
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. YouTube,
   Stripe secret, Brevo, ESV and Anthropic keys live only in Vercel env vars and
   are used only in Route Handlers / Server Actions / Edge Functions. History
   note: the old WP system leaked a YouTube API key client-side.
7. **ASCII straight quotes only** in source files.
8. **WordPress stays untouched.** The old multisite (Cloudways) serves
   churchfortruckers.org until cutover. Nothing here touches it.
9. **`wp-legacy-reference/` is read-only reference** - never deployed, never
   imported.

## 1. Where things are

| Path | What |
|---|---|
| `docs/BUILD_BRIEF.md` | The spec. Section 0 is reproduced above. |
| `docs/BUILD_BRIEF_ADDENDUM_01.md` | Multi-page sitemap. **Wins on conflict.** |
| `docs/KC_MASTER_TODO.md` | Phase order + who does what. Newest of the three. |
| `docs/FAST_FOLLOW.md` | Reviewed gaps deliberately deferred, with deadlines. Read before starting a phase - some entries are blockers for it. |
| `prototypes/cft-site-orange.html` | Public site spec, section by section. |
| `prototypes/cft-pastor-portal.html` | Pastor Portal spec. The product. |
| `supabase/migrations/` | SQL that has been run against the live project. |
| `supabase/drafts/` | SQL drafted for Jason, **not yet run**. |

## 2. Architecture notes that are easy to get wrong

- **`proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention; the brief
  predates that. Same API and position - `middleware.ts` still works but logs a
  deprecation warning on every build.
- **The tenant column is `churches.custom_domain`**, not `domain` as the brief
  section 1 writes it.
- **Theme tokens are `--kc-*` prefixed.** shadcn/ui owns the unprefixed names
  (`--accent`, `--primary`, `--border`, `--radius`); colliding restyles every
  shadcn component. `app/globals.css` bridges the two deliberately.
- **`church_theme` has only three colours and two fonts** (`color_primary`,
  `color_secondary`, `color_accent`, `font_heading`, `font_body`, `logo_url`).
  The rest of the token set is derived in `lib/theme.ts` or is a platform-wide
  neutral. Per-church neutrals would be a schema change - draft SQL, stop.
- **`lib/tenant.ts` must stay edge-safe.** It is imported by `proxy.ts`; no
  `next/headers`, no supabase-js. Server Component data access lives in
  `lib/church.ts`.
- **Never trust a client-supplied church id.** `proxy.ts` strips inbound
  `x-church-*` headers before setting its own.

## 3. Regenerating types after a migration

```
npm run types
```

Runs `supabase gen types typescript --project-id cyyxhhwuyeyvewqrhewt` into
`types/database.ts`. Read-only - it does not touch the schema. Requires the
Supabase CLI to be logged in.

## 4. Phase status

- **Phase A - Foundation: built.** Scaffold, tenant resolution, Supabase
  clients, generated types, theme system.
- Phase B - Public site (spec: `cft-site-orange.html`).
- Phase C - Pastor Portal (spec: `cft-pastor-portal.html`).
- Phase D - Cutover. Phase E - KC platform layer.
