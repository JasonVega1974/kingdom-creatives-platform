# supabase/drafts

SQL drafted for Jason to run manually in the Supabase SQL editor
(project `cyyxhhwuyeyvewqrhewt`). **Nothing in this folder has been run.**

Ground rule 0.3: Claude never executes SQL. Draft here, stop, Jason runs it and
pastes the result back. Once a file has been run, move it to
`supabase/migrations/` with the date it was applied noted at the top, and
regenerate types with `npm run types`.

**Run 08 first.** It is the blocker: draft 04 cannot be applied until the
`church_sections` unique constraint is widened, and Phase B has no content
without 04.

**Run 13 last, and run its three sections separately.** The Supabase SQL
editor returns only the last statement's result, so pasting 13 in one go
hides the audit in section 1 - which is the part that needs reading.

| Order | File | What | Required for |
|---|---|---|---|
| 1 | `08_widen_church_sections_unique.sql` | Widen `UNIQUE (church_id, section_key)` to include `page_slug` | **Blocker.** Draft 04, all of Phase B, section editing in Phase C |
| 2 | `04_cft_sections_seed.sql` | The CFT page/section content | Phase B "renders 100% from DB"; the portal section editor has nothing to list without it |
| 3 | `09_church_links.sql` | New table: multi-valued social / video / giving links | Portal Church Details links panel; CFT has two YouTube channels and the single `churches.youtube_channel_id` column cannot hold both |
| 4 | `10_cft_links_seed.sql` | Data only - CFT's two YouTube channels, Facebook group, Tithe.ly link | Requires 09 |
| 5 | `12_grant_portal_access.sql` | Puts your auth user in `church_members` for CFT | **Logging into the portal at all.** Create the auth user in the dashboard first - the file says how |
| 6 | `13_rls_with_check.sql` | Adds the missing `with check` to 7 policies (FF-23), plus a read-only RLS audit | Nothing today - CFT is the only church with a member. **Blocker before a second church has real data.** Run it last: section 1 audits `church_links`, so it wants 09 already applied |
| 7 | `11_sermons_church_link.sql` | `sermons.church_link_id` - nullable, tenant-safe FK to `church_links` | Sermon Library tab, nightly YouTube sync. Requires 09. Not urgent - safe to run later alongside that work |
| - | `07_cft_giving_url.sql` | Data only - set `churches.giving_url` to the CFT Tithe.ly form link | Every Give button on the public site (Phase B). Superseded by 09/10 once the public site reads `church_links` - see docs/PORTAL_SPEC.md section 2.3 |
| - | `05_devotionals.sql` | Blocked on ADDENDUM_01 decision B2 | Phase B `/devotionals` |
| - | `06_sections_inspect.sql` | Read-only diagnostics behind draft 08 | Nothing. 08 is self-diagnosing, so this is only worth running if 08 reports something unexpected |
| - | `02_theme_tokens.sql` | Optional: per-church control of the neutral ramp + exact brand ramp | Nothing yet - only if a church needs neutrals that differ from the platform defaults |

After running 09, regenerate types so `church_links` is typed:

```
npm run types
```

## Already applied

Both live in `supabase/migrations/`, with the applied date in the file header:

| File | Applied | What |
|---|---|---|
| `01_kc_migration_01.sql` | 2026-07-30 | New tables, column adds, RLS policies, `increment_prayer_count`. Verified present via `supabase gen types`. |
| `03_cft_theme_seed.sql` | 2026-07-30 | Data only - set the CFT theme row to the orange prototype palette. Verified live: the rendered page reports `#EC5D1B` / `#161311` / `#FDFBF5`, Fraunces / Source Sans 3. |

Numbering skips 02 deliberately: `02_theme_tokens.sql` is optional and still
unrun, so 03 was applied ahead of it. Do not renumber - the header dates are the
record, not the filenames.
