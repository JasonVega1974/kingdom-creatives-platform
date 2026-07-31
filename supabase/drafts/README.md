# supabase/drafts

SQL drafted for Jason to run manually in the Supabase SQL editor
(project `cyyxhhwuyeyvewqrhewt`). **Nothing in this folder has been run.**

Ground rule 0.3: Claude never executes SQL. Draft here, stop, Jason runs it and
pastes the result back. Once a file has been run, move it to
`supabase/migrations/` with the date it was applied noted at the top, and
regenerate types with `npm run types`.

| File | What | Required for |
|---|---|---|
| `02_theme_tokens.sql` | Optional: per-church control of the neutral ramp + exact brand ramp | Nothing yet - only if a church needs neutrals that differ from the platform defaults |

## Already applied

Both live in `supabase/migrations/`, with the applied date in the file header:

| File | Applied | What |
|---|---|---|
| `01_kc_migration_01.sql` | 2026-07-30 | New tables, column adds, RLS policies, `increment_prayer_count`. Verified present via `supabase gen types`. |
| `03_cft_theme_seed.sql` | 2026-07-30 | Data only - set the CFT theme row to the orange prototype palette. Verified live: the rendered page reports `#EC5D1B` / `#161311` / `#FDFBF5`, Fraunces / Source Sans 3. |

Numbering skips 02 deliberately: `02_theme_tokens.sql` is optional and still
unrun, so 03 was applied ahead of it. Do not renumber - the header dates are the
record, not the filenames.
