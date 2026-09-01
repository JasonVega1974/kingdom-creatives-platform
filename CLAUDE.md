# CLAUDE.md - Kingdom Creatives Platform

@AGENTS.md

Standing rules for every session in this repo. These override anything else.

## 0. Ground rules (BUILD_BRIEF section 0 + KC_MASTER_TODO section D)

1. **Never run `git push --force`.** Ever.
2. **Show full diffs before committing.** Per-file commits. **No pushes without
   explicit approval from Jason.**

   **2a. Before any commit that includes a rename, run `git status --porcelain`
   unfiltered.** No `grep`, no `head`, no pipe of any kind. Read every line, and
   read BOTH status columns on every touched file - not just the renamed one.

   This has now nearly shipped wrong twice, and both times the cause was the
   same: **`git mv` stages the rename the instant it runs.** Any edit made to
   the file afterwards is a separate, unstaged change sitting on top of an
   already-staged rename.

   That file then shows as `RM` - `R` staged in column 1, `M` unstaged in
   column 2. It looks committed-ready and is not. The first occurrence swept six
   renames into a commit labelled for something else; the second moved draft 26
   into `migrations/` and would have taken its stale `Status: NOT RUN` header
   with it, because the header edit came after the `git mv`.

   Why filtering specifically defeats this: a check like
   `git status --short | grep -v "^[MARD]"` keys on column 1, sees the `R`, and
   drops the line - hiding the very case it exists to catch. A filter written to
   surface leftovers will hide a half-staged rename every time.

   The tell in the diff: `git diff --cached -M` reporting **`similarity index
   100%`** on a file you know you also edited means the edit is NOT in the
   commit. A rename plus a content change should read `R0xx`, never `R100`.

   Fix is always the same - `git add` the renamed path at its NEW location, then
   re-read the unfiltered status before committing.

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

   **4a. Any feature whose public side reads through a new or changed RLS
   policy gets an anon probe before it is called done** - the same probe a
   draft gets, not a lighter one.

   This has failed three times, always identically: FF-27 (churches had no
   write policy), FF-31 (events and sermons had no public read), FF-42
   (church_media's read was gated on `in_gallery`). Each time the write
   succeeded, the portal reported saved, and the public page rendered nothing
   with no error anywhere.

   What does NOT catch it: `tsc`, `eslint`, `next build`, generated types
   carrying the relationship, or every page returning 200. All of those passed
   every time. **They prove the query is well-formed. Only an anon read proves
   it returns anything.**

   The probe: insert a row inside a transaction, `set local role anon`, read it
   back the way the public page reads it - through the embed, not a bare select
   - then `rollback`. State what a failing run looks like before running it.
   See FF-35 for how to write one that can actually fail.
5. **Do not redesign the backend.** Build against the schema that exists; ask
   before assuming a column exists. `types/database.ts` is generated from the
   live schema and is never hand-edited.
6. **All API keys server-side only.** The only keys allowed in the browser are
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. YouTube,
   Stripe secret, Brevo, ESV and Anthropic keys live only in Vercel env vars and
   are used only in Route Handlers / Server Actions / Edge Functions. History
   note: the old WP system leaked a YouTube API key client-side.
7. **ASCII straight quotes only** in source files.
8. **Know what is actually live.** Updated 2026-08-31 - the Phase D cutover has
   happened. Two previous versions of this rule were wrong about what serves the
   domain, so verify before trusting the table rather than after:

   ```
   curl -sI https://churchfortruckers.org/ | grep -i "^server:"
   ```

   | Thing | State |
   |---|---|
   | `churchfortruckers.org` | Served by **this repo** - Next.js on Vercel. Verified 2026-08-31: `Server: Vercel`, page carries `kc-site` and `_next/static`. |
   | Supabase `cyyxhhwuyeyvewqrhewt` | **Backs the live public site.** Rows in `church_sections`, `churches`, `events`, `sermons`, `groups` and the rest are rendered to visitors. |
   | Vercel project `kingdom-creatives` (the old static launch site) | No longer serves the domain. Separate project - nothing here deploys to it, and nothing here should try to edit it. |
   | WordPress multisite / Cloudways | **Gone.** Local backup on Jason's desktop only. |

   Consequence, and this **replaces** the old wording that called a draft "not a
   production change":

   **Running a draft in `supabase/drafts/` against `cyyxhhwuyeyvewqrhewt` is a
   production change.** Full stop, including data-only ones. There is no staging
   database and there never was one - the same project has always held this
   data; what changed at cutover is that visitors now read it. A bad write shows
   on churchfortruckers.org immediately, with no environment to catch it first
   and no second copy to diff against.

   That is a reason to size the risk before running, not a reason to freeze:

   | What the draft does | Risk | Care |
   |---|---|---|
   | Data-only and idempotent - `jsonb_set`, `update ... set` to a fixed literal. Draft 26 is the model. | Low | Run it. Keep the before/after selects. Re-running changes nothing. |
   | Data-only but non-idempotent - inserts without a guard, updates computed from the current value | Medium | `begin` / inspect / `rollback` first, then run for real. Row counts must match what the draft predicted. |
   | Schema (`create` / `alter` / `drop`), deletes, or anything touching RLS or grants | High | One section at a time, results pasted back between sections. RLS changes additionally need the rule 4a anon probe before the feature is called done. |

   Two things hold at every risk level:

   - **Rule 0.3 is unchanged and this rule does not loosen it.** Never execute
     SQL against the live project. Drafts go to Jason for the SQL editor and the
     results come back. Nothing here is authorisation to run one.
   - **A draft states its expected before and after** so a failing run is
     recognisable as failing. "SQL executed successfully" is not a result.
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
