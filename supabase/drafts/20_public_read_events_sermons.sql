/* ============================================================
   DRAFT 20 - public read policies for events and sermons (FF-31)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Required for: /events and /sermons showing anything at all.
   Requires: nothing. Safe to run now.

   >>> RUN THE SECTIONS SEPARATELY. Section 1 is the audit. <<<

   WHAT IS WRONG
   The public site reads with the anon key. The 2026-08-27 audit listed every
   policy on the nine pre-migration-01 tables, and only four carry a PUBLIC
   select policy:

     church_sections  public can view visible sections of active churches
     gallery          public can view gallery of active churches
     staff            public can view visible staff of active churches
     videos           public can view videos of active churches

   events and sermons have exactly two policies each - "pastor+ can edit" and
   "staff+ can view" - and neither admits the anon role. So an anonymous
   visitor reading events or sermons gets ZERO ROWS.

   Not an error. Not a 403. RLS filters the rows out and PostgREST returns an
   empty array, so /events and /sermons would render their seeded empty states
   forever and look like a church that has not added anything yet. Same silent
   shape as FF-27: the write was refused and reported success.

   Migration 01's own tables are fine - it wrote "groups: anon read visible",
   "ministries: anon read visible", "announcements: anon read visible" and
   "prayer_requests: anon read approved" at the time. events and sermons
   predate it and were never given the equivalent.

   WHAT EACH POLICY FILTERS ON
   Every public collection policy gates on the church being active AND the row
   being publishable. The column differs per table, which is itself worth
   knowing - there are three conventions in this schema:

     events    published boolean
     sermons   status text ('draft | published | archived' per the column
               comment in migration 01)
     videos    published boolean   <- draft 14, still unrun
     staff     visible boolean
     groups    visible boolean
     gallery   (no such column - nothing to filter)

   OPEN QUESTION - archived sermons. This draft admits status = 'published'
   only. If 'archived' is meant to stay publicly visible in a sermon archive
   rather than be withdrawn, say so and this becomes
   status in ('published', 'archived'). Guessing wrong in the permissive
   direction would republish sermons someone deliberately retired, so it is
   written the restrictive way.

   SAFE TO RUN TWICE. drop-if-exists then create.
   ============================================================ */


/* ============================================================
   SECTION 1 - AUDIT (read-only in effect; section 1b rolls back)

   CORRECTED 2026-08-28. The first version of this section had a column
   `anon_can_select` built from pg_policy.polroles. It was wrong and reported
   `true` for every table, events and sermons included.

   Why it was wrong: polroles records which ROLES a policy applies to, not
   whether its predicate can ever be TRUE. None of these policies was created
   with a TO clause, so they all default to PUBLIC and polroles is '{0}' - the
   all-roles placeholder. The check matched that and said "anon is in scope",
   which is true and useless. It would have said true for `documents`.

   The policies do apply to anon. Their predicates just resolve false for it:
   `staff+ can view events` requires
     church_id in (select church_members.church_id
                     from church_members where user_id = auth.uid() ...)
   and auth.uid() is null for anon, so the subquery is empty and no row passes.

   Reachability cannot be read off the catalog. It has to be executed.
   ============================================================ */

/* ---- 1a. The policy inventory, without the bogus verdict column. ----
   Read `using_expr`: any predicate resolving through church_members is
   staff-or-pastor only, whatever roles the policy nominally applies to. */

select c.relname::text as table_name,
       p.polname       as policy_name,
       case p.polcmd
         when '*' then 'ALL' when 'r' then 'select' when 'a' then 'insert'
         when 'w' then 'update' when 'd' then 'delete'
       end as cmd,
       coalesce(
         nullif(array_to_string(array(
           select quote_ident(rolname) from pg_roles where oid = any (p.polroles)
         ), ', '), ''),
         'PUBLIC (no TO clause)') as applies_to,
       pg_get_expr(p.polqual, p.polrelid) as using_expr
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
 where n.nspname = 'public'
   and c.relname in ('events', 'sermons', 'videos', 'staff', 'groups',
                     'ministries', 'gallery', 'church_sections')
   and p.polcmd in ('r', '*')
 order by c.relname, p.polname;


/* ---- 1b. REACHABILITY PROBE - the answer that matters. ----

   Inserts one row per table, reads the table as the anon role, then ROLLS
   BACK. Nothing is written. Same pattern as draft 19's probes.

   A probe row is required because CFT has no events or sermons yet: counting
   an empty table as anon returns 0 whether RLS blocks it or not, which proves
   nothing. Seeding one row inside the transaction makes 0 meaningful.

   Read each count:

     ERROR "permission denied for table"  -> no GRANT for anon. Different
                                             problem from this draft.
     0                                    -> GRANT fine, RLS refused. FF-31
                                             confirmed for that table.
     1                                    -> anon can read it. No fix needed.

   Run the whole block at once - the counts come back as one row.
   ============================================================ */

begin;

insert into public.events (church_id, title, starts_at, published)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a',
        'RLS probe - rolled back', now() + interval '7 days', true);

insert into public.sermons (church_id, title, status)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a',
        'RLS probe - rolled back', 'published');

set local role anon;

select
  (select count(*) from public.events)  as anon_sees_events,
  (select count(*) from public.sermons) as anon_sees_sermons,
  (select count(*) from public.staff)   as anon_sees_staff,
  (select count(*) from public.groups)  as anon_sees_groups;

rollback;


/* ---- 1c. Distinct sermons.status values actually present. ----
   Run alone. Decided 2026-08-28: the policy admits 'published' only, so this
   is to confirm nothing real is sitting under an unexpected value. */

select status, count(*) as rows
  from public.sermons
 group by status
 order by status;


/* ============================================================
   SECTION 2 - THE POLICIES
   ============================================================ */

begin;

/* ---- events ---- */
drop policy if exists "public can view published events of active churches"
  on public.events;

create policy "public can view published events of active churches"
  on public.events for select
  using (
    published = true
    and church_id in (
      select c.id from public.churches c where c.status = 'active'
    )
  );

/* ---- sermons ----
   status = 'published' only. See the open question in the header before
   widening this to include 'archived'. */
drop policy if exists "public can view published sermons of active churches"
  on public.sermons;

create policy "public can view published sermons of active churches"
  on public.sermons for select
  using (
    status = 'published'
    and church_id in (
      select c.id from public.churches c where c.status = 'active'
    )
  );

commit;


/* ============================================================
   SECTION 3 - VERIFY

   Expect anon_can_select = true for events and sermons, alongside the four
   that already had it. videos stays true but UNFILTERED until draft 14 runs -
   that is FF-25, and it becomes exploitable the moment /worship ships.
   ============================================================ */

with t as (
  select c.oid, c.relname::text as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('events', 'sermons', 'videos', 'staff', 'groups',
                       'ministries', 'gallery', 'church_sections')
)
select t.tbl as table_name,
       p.polname as policy_name,
       pg_get_expr(p.polqual, p.polrelid) as using_expr
  from t
  join pg_policy p on p.polrelid = t.oid
 where p.polcmd in ('r', '*')
   and (p.polroles = '{0}' or 'anon' = any (
         select rolname from pg_roles where oid = any (p.polroles)))
 order by t.tbl, p.polname;
