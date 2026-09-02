/*
 * ============================================================
 * DRAFT 37 - diagnose why draft 36's member CTE came back empty
 * Project: cyyxhhwuyeyvewqrhewt
 * Status:  NOT RUN.
 * Required for: fixing draft 36; nothing else blocks on it
 * ============================================================
 *
 * >>> RUN AS ONE SCRIPT, ONE EXECUTION. READ-ONLY, ROLLS BACK. <<<
 *
 * WHAT WENT WRONG IN 36, precisely: inserted_rows 0 WITHOUT an error means
 * the insert's source CTE selected nothing - a with-check refusal would
 * have errored loudly instead. So the sermon_generations policy was never
 * tested; the break is upstream, in reading churches/church_members as the
 * mocked member with the `user_id = auth.uid()` filter that draft 34's
 * working probe did not have. Neither table's SELECT policy is defined in
 * this repo (both predate migration 01 - FF-26's other authorization
 * model), so this measures each link instead of guessing.
 *
 * EXPECTED: one row, whose columns say which link is broken:
 *
 *   claims_seen        the JSON set by set_config - proves the mock took
 *   uid_seen           what auth.uid() returns under it. NULL here is the
 *                      smoking gun: this project's auth.uid() reads a
 *                      different setting than request.jwt.claims, and 36's
 *                      filter compared user_id to NULL
 *   sub_in_claims      the sub we intended - compare with uid_seen
 *   churches_visible   rows of churches readable as authenticated where
 *                      slug = 'church-for-truckers'. 0 = churches' select
 *                      policy excludes authenticated (anon-only)
 *   members_visible    church_members rows readable at all. 0 = its select
 *                      policy shuts authenticated out entirely (then draft
 *                      34 worked only because ITS join ran... paste this
 *                      back and we rethink together)
 *   members_matching   rows matching user_id = auth.uid() - 36's filter.
 *                      The number that was effectively 0
 *   policies           every pg_policies row for churches, church_members
 *                      and sermon_generations: the actual using/with-check
 *                      expressions, roles and commands, so the fix targets
 *                      what is really there
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

select
  current_setting('request.jwt.claims', true)                          as claims_seen,
  auth.uid()                                                           as uid_seen,
  (current_setting('request.jwt.claims', true)::json ->> 'sub')        as sub_in_claims,
  (select count(*) from public.churches
     where slug = 'church-for-truckers')                               as churches_visible,
  (select count(*) from public.church_members)                         as members_visible,
  (select count(*) from public.church_members
     where user_id = auth.uid())                                       as members_matching,
  (select json_agg(json_build_object(
      'table', tablename, 'policy', policyname, 'cmd', cmd,
      'roles', roles, 'using', qual, 'check', with_check))
     from pg_policies
     where schemaname = 'public'
       and tablename in ('churches', 'church_members', 'sermon_generations')) as policies;

rollback;
