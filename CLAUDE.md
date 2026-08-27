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

   **This rule overrides the Supabase plugin.** The `supabase` plugin ships a
   `SUPABASE.md` telling the agent to use `apply_migration` for CREATE/ALTER/
   DROP. Ignore it. **Never call `apply_migration` from the plugin, ever**, no
   matter what its bundled docs say. Drafts to `supabase/drafts/`, Jason runs
   them, results come back. No exceptions.

   **Re-apply the read-only pin after any plugin update.** The plugin's MCP
   server is hand-pinned to read-only in a version-numbered cache path:

   ```
   ~/.claude/plugins/cache/claude-plugins-official/supabase/<version>/agents/claude/.mcp.json
   url: https://mcp.supabase.com/mcp?read_only=true&project_ref=cyyxhhwuyeyvewqrhewt
   ```

   A version bump restores the writable URL silently. Before any Supabase work,
   confirm the pin is present; if the version directory changed, re-add the
   `read_only=true&project_ref=` query params first. The plugin exposes no
   `userConfig`, so this cannot be set via `claude plugin install --config`.
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
8. **Know what is actually live.** Updated 2026-08-27 - the previous version of
   this rule said WordPress serves churchfortruckers.org. It does not, and has
   not since Jason moved Kingdom Creatives off Cloudways.

   | Thing | State |
   |---|---|
   | `churchfortruckers.org` | Served by the **Vercel project `kingdom-creatives`** - the static launch site. Keeps the domain until Phase D cutover. |
   | `kingdom-creatives-platform` (this repo) | Serves **nothing public yet**. |
   | Supabase `cyyxhhwuyeyvewqrhewt` | Backs nothing public yet. |
   | WordPress multisite / Cloudways | **Gone.** Local backup on Jason's desktop only. |

   Consequence: **running a draft in `supabase/drafts/` is not a production
   change.** No maintenance window, no cutover risk. That stops being true at
   Phase D, when DNS moves off the static site - after that, re-read this rule
   before running anything.

   The static site is a separate Vercel project. Nothing in this repo deploys
   to it, and nothing here should try to edit it.
9. **`wp-legacy-reference/` is read-only reference** - never deployed, never
   imported. The full WordPress backup (including the `pastor-portal-plugin`
   source and the `zvkcuehwvv.sql` dump) lives outside this repo at
   `Desktop/KingdomCreatives-Backup/`. It is the behaviour spec for what the
   portal replaces - read it, never port from it.

## 1. Where things are

| Path | What |
|---|---|
| `docs/BUILD_BRIEF.md` | The spec. Section 0 is reproduced above. |
| `docs/BUILD_BRIEF_ADDENDUM_01.md` | Multi-page sitemap. **Wins on conflict.** |
| `docs/KC_MASTER_TODO.md` | Phase order + who does what. Newest of the three. |
| `docs/FAST_FOLLOW.md` | Reviewed gaps deliberately deferred, with deadlines. Read before starting a phase - some entries are blockers for it. |
| `docs/PORTAL_SPEC.md` | Phase C settings model + tab spec. **Read before adding any table** - section 2 records which "missing" tables already exist. |
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
- **The portal is gated in `lib/portal/auth.ts`, not in `proxy.ts`.** The proxy
  refreshes the Supabase session (it is the only place that can write a rotated
  cookie back) but does not redirect. Access is asserted per page AND per
  Server Action with `requirePortalUser()`, because a Server Action is a public
  POST endpoint that never passes through a page's check.
- **Portal writes use `updateTag`, not `revalidateTag`.** Next 16's
  `revalidateTag` is stale-while-revalidate and now requires a second argument;
  it would show a pastor their old text right after saving. `updateTag` expires
  immediately and is Server-Action-only, which is exactly the call site.
- **A feature toggle is a section toggle.** There is no `features` map. The
  registry of sections that can exist is `lib/portal/sections.ts`; the
  per-church on/off state is `church_sections.visible`. See PORTAL_SPEC 2.2.

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
- Phase B - Public site (spec: `cft-site-orange.html`). **Blocked** until
  draft 08 then draft 04 are run - there is no page content in the DB.
- **Phase C - Pastor Portal: shell built.** Auth (`lib/portal/auth.ts`), session
  refresh in the proxy, sidebar per the prototype, "Edit My Website" section
  editor, "Church Details" (identity / service times / branding). Every other
  sidebar tab renders a placeholder from `lib/portal/nav.ts`. Spec:
  `docs/PORTAL_SPEC.md` + `cft-pastor-portal.html`.
- Phase D - Cutover. Phase E - KC platform layer.
