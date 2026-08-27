# supabase/drafts

SQL drafted for Jason to run manually in the Supabase SQL editor
(project `cyyxhhwuyeyvewqrhewt`). **Nothing left in this folder has been run.**

Ground rule 0.3: Claude never executes SQL. Draft here, stop, Jason runs it and
pastes the result back. Once a file has been run, move it to
`supabase/migrations/` with the date it was applied noted at the top, and
regenerate types with `npm run types`.

Use **block comments** (`/* ... */`) in new drafts, not line comments. Copying a
long file into the SQL editor has dropped a `--` prefix before, and Postgres
then parses the prose as SQL - the symptom is a baffling
`relation "the" does not exist`.

## Still to run

| File | What | Required for | Urgency |
|---|---|---|---|
| `17_churches_write_policy.sql` | Write policies + column grants on `churches` / `church_theme` (FF-27) | **Church Details saving at all** | **Blocker.** Run next |
| `16_churches_write_policy_audit.sql` | Read-only. The audit behind 17 | Nothing - diagnostics | Already run 2026-08-27 |
| `14_videos_published_rls.sql` | Add `published = true` to the public `videos` select policy (FF-25) | Phase B video pages | Before anything public reads `videos`. Not today - no video rows exist |
| `11_sermons_church_link.sql` | `sermons.church_link_id` - nullable, tenant-safe composite FK to `church_links` | Sermon Library tab, nightly YouTube sync | When that work starts. Requires 09 (done) |
| `15_post_batch_verify.sql` | Read-only. Re-checks that 08/04/09/10/12 took | Nothing - diagnostics | Run any time. Already passed 2026-08-27 |
| `07_cft_giving_url.sql` | Data only - `churches.giving_url` for CFT | Give buttons in Phase B | Superseded by 09/10 once the public site reads `church_links`. See PORTAL_SPEC 2.3 |
| `05_devotionals.sql` | Blocked on ADDENDUM_01 decision B2 | Phase B `/devotionals` | Blocked |
| `06_sections_inspect.sql` | Read-only diagnostics behind draft 08 | Nothing | Only if 08 ever reports something odd. 08 is applied and verified |
| `02_theme_tokens.sql` | Optional per-church neutral ramp | Nothing yet | Only if a church needs neutrals off the platform default |

## Applied

All in `supabase/migrations/`, applied date in the file header.

| File | Applied | What |
|---|---|---|
| `01_kc_migration_01.sql` | 2026-07-30 | New tables, column adds, RLS policies, `increment_prayer_count` |
| `03_cft_theme_seed.sql` | 2026-07-30 | CFT theme row set to the orange prototype palette. Verified live |
| `08_widen_church_sections_unique.sql` | 2026-08-27 | `UNIQUE (church_id, page_slug, section_key)`. Verified |
| `04_cft_sections_seed.sql` | 2026-08-27 | CFT page content. Verified: 34 rows, 11 pages, no bare-string jsonb |
| `09_church_links.sql` | 2026-08-27 | `church_links` table + RLS. Verified: RLS on, 2 policies |
| `10_cft_links_seed.sql` | 2026-08-27 | CFT links. Verified: giving=1, social=1, video=2 |
| `12_grant_portal_access.sql` | 2026-08-27 | Portal membership. Verified: 2 pastors on CFT |
| `13_rls_with_check.sql` | 2026-08-27 | Explicit `with check` on 7 policies. **Semantic no-op** - see FF-23 STATUS |

Numbering skips nothing and reuses nothing. `02` is optional and still unrun, so
`03` was applied ahead of it; `14` was reserved for FF-24 and reassigned to FF-25
when the audit closed FF-24. Do not renumber - the header dates are the record,
not the filenames.

## What the 2026-08-27 audit settled

Section 1 of draft 13 audited RLS across all twenty-one public tables:

- RLS is **on** everywhere, every table has at least one policy. FF-24 closed.
- The missing `with check` clauses were **not a defect**. Postgres uses `using`
  as the `with check` when the latter is absent. FF-23 closed.
- `videos.published` is ignored by its public select policy. **Real.** FF-25,
  fixed by draft 14.
- Two authorization models coexist - pre-migration-01 tables gate on role,
  migration-01 tables gate on membership alone. FF-26.
