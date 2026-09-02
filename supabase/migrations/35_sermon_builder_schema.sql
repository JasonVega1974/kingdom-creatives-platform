/*
 * APPLIED 2026-09-03 against project cyyxhhwuyeyvewqrhewt. Moved from
 * supabase/drafts/ after the run. History, not a to-do. Section 1 gate read
 * all three zeros; section 5 verified body absent, body_json/slide_content/
 * social_posts jsonb, and sermon_generations with rowsecurity = true and
 * exactly the insert + select policies.
 *
 * ============================================================
 * DRAFT 35 - Sermon Builder schema: manuscript column, jsonb
 *            add-ons, and the generation cap log
 * Project: cyyxhhwuyeyvewqrhewt
 * Status:  APPLIED 2026-09-03.
 * Required for: Phase C "Sermon Builder" tab (lib/portal/nav.ts, built: false)
 * ============================================================
 *
 * >>> RUN THE FIVE SECTIONS SEPARATELY, IN ORDER. <<<
 * The SQL editor shows only the last statement's result. Run section 1 and
 * paste its numbers back BEFORE running section 2 - section 2 contains this
 * draft's only irreversible statement, and section 1 is what proves it is
 * safe. Then 3, 4, 5, pasting each result back before the next.
 *
 * WHAT THIS DRAFT DOES
 *   2. Adds sermons.body_json (the TipTap manuscript, same design as
 *      pastor_notes.body_json from draft 33) and DROPS the legacy
 *      sermons.body text column - confirmed referenced nowhere in app code
 *      (its only appearance is inside a comment in the Sermon Library's
 *      actions file). One home for the manuscript, not two.
 *   3. Retypes slide_content and social_posts from text to jsonb - the two
 *      add-ons WordPress never built. The new builder generates them as
 *      structured JSON (slides: array of {title, bullets, scripture};
 *      social: {facebook, instagram, x, sms}), and a jsonb column refuses a
 *      malformed write instead of storing it.
 *   4. Creates sermon_generations - one row per AI generation, so the
 *      builder can refuse past 10 generations per church per UTC day.
 *      Members can insert and read; deliberately NO update or delete
 *      policy, because a member who can delete log rows can reset their
 *      own cap.
 *   5. Verifies all of it, read-only.
 *
 * RLS SCOPE: sermons' own policies are untouched - the member write policy
 * the Sermon Library already uses covers the builder's writes, and no new
 * public read path is created (published cards are the existing path,
 * probed when FF-31 closed). So no rule-4a anon probe is triggered by this
 * draft. Risk class per rule 8: HIGH (schema + a column drop + a new
 * table's RLS), hence the sectioning.
 */


/*
 * ============================================================
 * SECTION 1 of 5 - THE GATE. Read-only. Run this FIRST.
 * ============================================================
 *
 * >>> EXPECTED: every one of the three counts below is 0. <<<
 *
 * >>> IF sermons_with_body_text IS NOT 0, STOP. DO NOT RUN SECTION 2. <<<
 * Section 2 drops the body column, and a drop is the one thing in this
 * draft that cannot be undone. A nonzero count means some row is carrying
 * manuscript text nothing in the app can display - stopping and pasting
 * the count back IS the correct outcome of this draft in that case, and we
 * will look at what those rows hold before any drop is rewritten.
 *
 * The other two counts guard section 3 the same way: the text -> jsonb
 * retype is written for columns that have never been written to. Nonzero
 * there also means stop and paste back - the USING cast would either
 * mangle prose into a JSON error or, worse, succeed on something that
 * happens to parse.
 */

select
  count(*) filter (where body is not null)          as sermons_with_body_text,
  count(*) filter (where slide_content is not null) as sermons_with_slide_content,
  count(*) filter (where social_posts is not null)  as sermons_with_social_posts
from public.sermons;


/*
 * ============================================================
 * SECTION 2 of 5 - the manuscript column. CONTAINS THE DROP.
 * Only run after section 1 showed sermons_with_body_text = 0.
 * ============================================================
 *
 * EXPECTED: "ALTER TABLE" success, no rows returned. Section 5 confirms
 * body is gone and body_json exists.
 */

alter table public.sermons
  add column if not exists body_json jsonb;

alter table public.sermons
  drop column if exists body;

comment on column public.sermons.body_json is
  'The sermon manuscript as a TipTap JSON document (SERMON_EXTENSIONS schema: paragraphs, headings 2-3, lists, blockquote, and the inline marks pastor_notes.body_json allows). Never store raw HTML here - same closed-allowlist design as draft 33. Replaced the never-used body text column 2026-09-03.';


/*
 * ============================================================
 * SECTION 3 of 5 - slide_content and social_posts become jsonb.
 * Only run after section 1 showed both counts = 0.
 * ============================================================
 *
 * EXPECTED: "ALTER TABLE" success, no rows returned.
 *
 * The USING casts are belt and braces: with both columns all-NULL they
 * convert nothing. If section 1 was wrong and a stray non-JSON string
 * exists, the cast ERRORS rather than silently storing garbage - a loud
 * failure here is the safe failure.
 */

alter table public.sermons
  alter column slide_content type jsonb using slide_content::jsonb;

alter table public.sermons
  alter column social_posts type jsonb using social_posts::jsonb;

comment on column public.sermons.slide_content is
  'Presentation slides as JSON: an array of {title, bullets[], scripture?}. Generated by the Sermon Builder; the column was text and never written before 2026-09-03.';
comment on column public.sermons.social_posts is
  'Social posts as JSON: {facebook, instagram, x, sms}. Generated by the Sermon Builder; the column was text and never written before 2026-09-03.';


/*
 * ============================================================
 * SECTION 4 of 5 - the generation log, for the daily cap
 * ============================================================
 *
 * EXPECTED: CREATE TABLE / CREATE INDEX / ALTER TABLE / two CREATE POLICY
 * / two GRANT successes, no rows returned.
 *
 * One row per AI generation. The builder counts a church's rows for the
 * current UTC day before generating and refuses at 10 - which bounds the
 * platform's worst-case spend per church at roughly $2/day and is already
 * far past normal use.
 *
 * NO update or delete policy, and no update/delete grants, ON PURPOSE.
 * Every other portal table gives members full access; this one is a meter,
 * and a member who could delete its rows could reset their own cap. The
 * with check on insert pins church_id and user_id to the caller, so a row
 * cannot be logged against another church or another user.
 *
 * Explicit grants because draft 18 established that this project does not
 * rely on default privileges: authenticated gets exactly select + insert,
 * anon gets nothing.
 */

create table if not exists public.sermon_generations (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamp with time zone not null default now()
);

comment on table public.sermon_generations is
  'One row per Sermon Builder AI generation. Exists so the builder can enforce 10 generations per church per UTC day. Deliberately append-only for members - see draft 35 section 4.';

create index if not exists sermon_generations_church_day
  on public.sermon_generations (church_id, created_at);

alter table public.sermon_generations enable row level security;

drop policy if exists "sermon_generations: member read" on public.sermon_generations;
create policy "sermon_generations: member read"
  on public.sermon_generations for select
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = sermon_generations.church_id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "sermon_generations: member insert own" on public.sermon_generations;
create policy "sermon_generations: member insert own"
  on public.sermon_generations for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.church_members cm
      where cm.church_id = sermon_generations.church_id
        and cm.user_id = auth.uid()
    )
  );

grant select, insert on public.sermon_generations to authenticated;


/*
 * ============================================================
 * SECTION 5 of 5 - verify (read-only)
 * ============================================================
 *
 * EXPECTED, first query: body ABSENT; body_json present with data_type
 * jsonb; slide_content and social_posts both data_type jsonb; every other
 * sermons column unchanged.
 *
 * EXPECTED, second query: exactly two rows for sermon_generations -
 * "member insert own" (cmd INSERT) and "member read" (cmd SELECT) - and
 * nothing else. No ALL, no UPDATE, no DELETE.
 *
 * EXPECTED, third query: rowsecurity = true for sermon_generations.
 */

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'sermons'
order by ordinal_position;

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'sermon_generations'
order by policyname;

select relname, relrowsecurity as rowsecurity
from pg_class
where relname = 'sermon_generations';
