/*
 * >>> DO NOT RUN. SUPERSEDED BY DRAFT 38. Kept as the record. <<<
 *
 * Ran 2026-09-03 and returned 0/0/0. The database was fine - draft 37
 * proved the whole RLS chain healthy - and THIS FILE was the bug: the
 * insert, count and delete below are three CTEs in one statement, so they
 * share a single snapshot and neither the count nor the delete can see the
 * insert. Its headline assertion, deleted_rows 0, therefore could not fail,
 * which is exactly the kind of probe FF-35 exists to forbid.
 *
 * ============================================================
 * DRAFT 36 - verify the generation-cap log through real RLS
 * Project: cyyxhhwuyeyvewqrhewt
 * Status:  FAILED 2026-09-03, superseded by draft 38.
 * Required for: closing out the Sermon Builder per the FF-27 rule
 * ============================================================
 *
 * >>> RUN AS ONE SCRIPT, ONE EXECUTION. <<< Same shape as draft 34: one
 * transaction, mocked member JWT, rollback at the end - nothing persists,
 * safe against production, re-runnable.
 *
 * WHAT THIS PROVES. Draft 35 section 5 showed the two sermon_generations
 * policies EXIST; existence is not authorization (FF-27, FF-31, FF-42 all
 * failed on exactly that gap). This runs the app's real pattern as a real
 * CFT member: insert a log row (generate/route.ts's cap logging), count
 * today's rows (the cap check and the page's "X of 10 left"), and -
 * the append-only claim - attempt a DELETE, which must affect 0 rows
 * because no delete policy exists.
 *
 * EXPECTED, the final SELECT returns one row with three columns:
 *   inserted_rows   1   the insert-own policy authorized the write
 *   todays_count    1+  the member read policy lets the cap be counted
 *                       (exactly 1 unless real generations ran today)
 *   deleted_rows    0   THE POINT: even the member who wrote the row
 *                       cannot delete it - the cap cannot be self-reset
 *
 * deleted_rows of anything but 0 means the append-only design failed -
 * stop and paste it back. inserted_rows of 0 means RLS refused the insert
 * and every generation would die with "contact Kingdom Creatives" - same:
 * stop, paste back.
 */

begin;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (
      select cm.user_id::text
      from public.church_members cm
      join public.churches c on c.id = cm.church_id
      where c.slug = 'church-for-truckers'
      limit 1
    ),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

/* 1. INSERT - the route's cap logging, church and user pinned to caller. */
with member as (
  select cm.church_id, cm.user_id
  from public.church_members cm
  join public.churches c on c.id = cm.church_id
  where c.slug = 'church-for-truckers'
    and cm.user_id = auth.uid()
  limit 1
),
ins as (
  insert into public.sermon_generations (church_id, user_id)
  select church_id, user_id from member
  returning id
),
/* 2. COUNT - the cap check, same UTC-day window the route uses. */
cnt as (
  select count(*) as todays_count
  from public.sermon_generations sg
  where sg.church_id = (select church_id from member)
    and sg.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
),
/* 3. DELETE ATTEMPT - must touch 0 rows: no delete policy exists. */
del as (
  delete from public.sermon_generations
  where church_id = (select church_id from member)
  returning id
)
select
  (select count(*) from ins) as inserted_rows,
  (select todays_count from cnt) as todays_count,
  (select count(*) from del) as deleted_rows;

rollback;
