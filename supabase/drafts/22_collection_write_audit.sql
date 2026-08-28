/* ============================================================
   DRAFT 22 - can a pastor actually write the collection tables? (AUDIT)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Writes nothing: every probe rolls back.

   >>> RUN THE SECTIONS SEPARATELY. <<<

   WHY THIS EXISTS
   Phase C is about to build four portal tabs - Our Team, Sermon Library,
   Events, Groups - each of which inserts, updates and deletes rows in a table
   nothing has written to before. Every previous assumption about these
   policies has been checked only for READS.

   The pattern so far has not been kind:

     FF-27  churches had no write policy at all; saves reported success
     FF-31  events and sermons had no public read; pages rendered empty
     FF-33  contacts had no anon insert; the visit form could not save
     FF-34  prayer_requests accepted anything, including status = 'approved'

   Four for four. So this audit runs BEFORE the tabs are built rather than after
   a form silently fails.

   WHAT IS BEING TESTED
   Not "does a policy exist" - draft 20 proved that question is the wrong one
   (FF-35). This executes the writes a portal tab would perform, as the pastor's
   own role with his JWT claim set, and rolls them back.

   Section 2 sets `request.jwt.claims` so `auth.uid()` returns Jason's user id,
   which is what every `pastor+ can edit` policy resolves through. Without it,
   `set local role authenticated` alone leaves auth.uid() null and every policy
   correctly refuses - which would look like a failure and is not one.

   HOW TO READ IT
     INSERT 0 1 / UPDATE 1 / DELETE 1   -> the tab can do that operation
     ERROR 42501                        -> a policy or grant is missing. Stop
                                           and draft the fix before building.
     UPDATE 0 / DELETE 0                -> RLS filtered it silently. Same
                                           problem, quieter. This is FF-27's
                                           shape and matters most.
   ============================================================ */


/* ============================================================
   SECTION 1 - POLICY INVENTORY (read-only)

   Context for section 2's results, not a verdict on its own.
   ============================================================ */

select c.relname::text as table_name,
       p.polname       as policy_name,
       case p.polcmd
         when '*' then 'ALL' when 'r' then 'select' when 'a' then 'insert'
         when 'w' then 'update' when 'd' then 'delete'
       end as cmd,
       pg_get_expr(p.polqual, p.polrelid)      as using_expr,
       pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
 where n.nspname = 'public'
   and c.relname in ('staff', 'sermons', 'events', 'groups')
 order by c.relname, p.polcmd, p.polname;

/* Column-level grants. churches and church_theme were narrowed by drafts 17 and
   18; these four were never touched, so `authenticated` should still hold the
   Supabase blanket grant. A row here reading fewer columns than the table has
   would explain a write failing on one field. */
select table_name, privilege_type, count(*) as columns_granted
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name in ('staff', 'sermons', 'events', 'groups')
   and grantee = 'authenticated'
   and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
 group by table_name, privilege_type
 order by table_name, privilege_type;


/* ============================================================
   SECTION 2 - WRITE PROBES

   Run this whole block. It rolls back.

   Each table gets the full lifecycle a portal tab performs: insert a row,
   update it, delete it. Anything that raises stops the transaction, so the
   FIRST error is the one to report - later statements never ran.
   ============================================================ */

begin;

/* auth.uid() comes from the JWT claim, not from `set role`. Without this every
   pastor+ policy refuses correctly and the probe measures nothing. */
select set_config(
  'request.jwt.claims',
  json_build_object('sub', u.id, 'role', 'authenticated')::text,
  true
) as jwt_set
  from auth.users u
 where u.email = 'jasonvega1974@gmail.com';

set local role authenticated;

/* ---- staff : Our Team ---- */
insert into public.staff (church_id, name, role_title, bio, visible, sort_order)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a',
        'Probe Person', 'Probe Role', 'rolled back', true, 999);

update public.staff set role_title = 'Probe Role 2'
 where name = 'Probe Person';

delete from public.staff where name = 'Probe Person';

/* ---- sermons : Sermon Library ---- */
insert into public.sermons (church_id, title, status)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'Probe Sermon', 'draft');

update public.sermons set status = 'published' where title = 'Probe Sermon';

delete from public.sermons where title = 'Probe Sermon';

/* ---- events : Events ---- */
insert into public.events (church_id, title, starts_at, published)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a',
        'Probe Event', now() + interval '30 days', false);

update public.events set published = true where title = 'Probe Event';

delete from public.events where title = 'Probe Event';

/* ---- groups : Groups & Studies ---- */
insert into public.groups (church_id, name, visible, sort_order,
                           frequency, location_type)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a',
        'Probe Group', true, 999, 'weekly', 'video');

update public.groups set name = 'Probe Group 2' where name = 'Probe Group';

delete from public.groups where name = 'Probe Group 2';

/* Reached only if every statement above succeeded. */
select 'all four tables writable by a pastor' as verdict;

rollback;


/* ============================================================
   SECTION 3 - PUBLIC READ SPOT-CHECK

   Confirms the other half: a row a pastor creates is visible to a visitor.
   /team is the one being built first and staff already has
   `public can view visible staff of active churches`, so this should pass -
   but that policy has never had a row to return.

   `visible = false` must come back invisible. If both counts are 1, the
   visible flag is not being honoured and the Team tab would publish drafts.
   ============================================================ */

begin;

insert into public.staff (church_id, name, visible, sort_order)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'Probe Visible', true, 998),
       ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'Probe Hidden', false, 999);

set local role anon;

select
  (select count(*) from public.staff where name = 'Probe Visible') as anon_sees_visible,
  (select count(*) from public.staff where name = 'Probe Hidden')  as anon_sees_hidden;

rollback;

/* Expect anon_sees_visible = 1, anon_sees_hidden = 0. */
