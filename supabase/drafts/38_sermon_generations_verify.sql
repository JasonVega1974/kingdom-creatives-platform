/*
 * ============================================================
 * DRAFT 38 - verify the generation-cap log through real RLS
 *            (replaces the broken draft 36; rewritten after v1
 *             of this file failed on its own scaffolding)
 * Project: cyyxhhwuyeyvewqrhewt
 * Status:  PASSED 2026-09-03. Both sections.
 *          Section 1: member_rows 1, todays_count 1 - a real member can
 *          log a generation and count it, so the route handler's cap check
 *          works for an actual pastor.
 *          Section 2: "Success. No rows returned." - outcome B below. The
 *          member could not delete the row it had just written, so the cap
 *          cannot be self-reset. Note this landed as the RLS-layer
 *          guarantee rather than the grant-layer one - see the note under
 *          outcome A.
 * Required for: closing out the Sermon Builder per the FF-27 rule
 * ============================================================
 *
 * >>> RUN THE TWO SECTIONS SEPARATELY. Both roll back. <<<
 * Section 2 is expected to end in an ERROR, and that error is a PASS - see
 * its header. Running the two together would let that expected error hide
 * section 1's result, which is the part with numbers in it.
 *
 *
 * WHY THIS FILE HAS NOW BEEN WRONG TWICE, AND WHAT CHANGED
 *
 * Draft 36 put the insert, count and delete in ONE statement as three
 * CTEs. Every CTE in a statement shares one snapshot, so the count and the
 * delete could not see the insert: `todays_count 0` was guaranteed, and
 * `deleted_rows 0` was a FALSE PASS - an assertion that could not fail,
 * which is what FF-35 exists to forbid.
 *
 * Version 1 of THIS draft fixed the snapshot problem with a plpgsql DO
 * block writing results into a temp table, and failed differently:
 * "relation probe_result does not exist" - the temp table created earlier
 * in the same paste was not visible inside the block. I do not have a
 * confirmed mechanism for that (leading suspicion is how the SQL editor
 * hands the script to the server, not anything about this database), and
 * that is exactly the point: a verification probe must not depend on
 * machinery whose behaviour I am guessing at.
 *
 * So this version depends on nothing. No temp table, no DO block, no
 * CTEs - just plain statements run in order, which is the shape drafts 34
 * and 37 both ran successfully. Each statement sees the previous one's
 * work, which is the property draft 36 lacked, and the SQL editor's
 * "last statement wins" display is used deliberately rather than worked
 * around.
 *
 * WHAT IS BEING PROVEN. Draft 35 section 5 showed the two
 * sermon_generations policies EXIST. Existence is not authorization -
 * FF-27, FF-31 and FF-42 all failed on precisely that gap. Section 1 below
 * proves a real church member can log a generation and count it (the cap
 * check the route handler makes). Section 2 proves that same member cannot
 * delete it (the append-only guarantee: a church must not be able to reset
 * its own meter).
 */


/*
 * ============================================================
 * SECTION 1 of 2 - the write and the count. Run this first.
 * ============================================================
 *
 * Statement 1 logs a generation exactly as generate/route.ts does.
 * Statement 2 then counts today's rows for the church - a SEPARATE
 * statement, so unlike draft 36 it actually sees the row just written.
 *
 * EXPECTED: one row.
 *
 *   member_rows    1     the mocked member resolved (draft 37 proved this
 *                        chain healthy; it is re-asserted here so a
 *                        surprise 0 is visible rather than silent)
 *   todays_count   1      the insert policy authorized the write AND the
 *                        read policy allows counting it. 2 or more is also
 *                        a pass - it just means real generations ran today
 *
 * A with-check refusal RAISES rather than inserting zero rows, so if the
 * insert policy is wrong this section ERRORS instead of returning a row.
 * Either an error, or todays_count 0, means STOP: the route handler's cap
 * logging would fail for a real pastor and every generation would die on
 * "Could not start a generation. Please contact Kingdom Creatives."
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

insert into public.sermon_generations (church_id, user_id)
select cm.church_id, cm.user_id
from public.church_members cm
join public.churches c on c.id = cm.church_id
where c.slug = 'church-for-truckers'
  and cm.user_id = auth.uid()
limit 1;

select
  (select count(*)
     from public.church_members cm
     join public.churches c on c.id = cm.church_id
     where c.slug = 'church-for-truckers'
       and cm.user_id = auth.uid())                                  as member_rows,
  (select count(*)
     from public.sermon_generations sg
     join public.churches c on c.id = sg.church_id
     where c.slug = 'church-for-truckers'
       and sg.created_at >= date_trunc('day', (now() at time zone 'utc'))
                            at time zone 'utc')                      as todays_count;

rollback;


/*
 * ============================================================
 * SECTION 2 of 2 - the append-only assertion. Run after section 1.
 * ============================================================
 *
 * Statement 1 writes a row so there is something real to delete - without
 * it, a delete affecting zero rows would prove nothing, which was draft
 * 36's false pass. Statement 2 then attempts to delete it, as a separate
 * statement that can genuinely see it.
 *
 * TWO OUTCOMES ARE BOTH A PASS, and one of them looks like a failure:
 *
 *   A) ERROR: permission denied for table sermon_generations
 *      Draft 35 granted authenticated only select and insert, so on a
 *      project without permissive default privileges the delete is refused
 *      at the GRANT layer before RLS is consulted.
 *      THIS IS NOT WHAT HAPPENED. The run got outcome B, which means this
 *      project's default privileges had already granted DELETE on the new
 *      table - draft 35's explicit grant was additive, not restrictive.
 *      The append-only property still holds, but it rests on RLS alone
 *      rather than on both layers. Draft 18 set the precedent for tidying
 *      exactly this (it revoked unused INSERT/DELETE grants); a follow-up
 *      revoking update and delete on sermon_generations would restore the
 *      belt-and-braces. Not urgent - proven to hold as it stands.
 *
 *   B) A result set with ZERO rows returned.
 *      Also a pass: the grant existed but no delete policy matched, so RLS
 *      filtered the row away.
 *
 * THE FAILURE IS A RESULT SET WITH ONE OR MORE ROWS. That would mean a
 * church member can delete its own meter rows and generate without limit -
 * stop and paste it back, because the cap would be unenforceable.
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

insert into public.sermon_generations (church_id, user_id)
select cm.church_id, cm.user_id
from public.church_members cm
join public.churches c on c.id = cm.church_id
where c.slug = 'church-for-truckers'
  and cm.user_id = auth.uid()
limit 1;

delete from public.sermon_generations sg
using public.churches c
where c.id = sg.church_id
  and c.slug = 'church-for-truckers'
returning sg.id;

rollback;
