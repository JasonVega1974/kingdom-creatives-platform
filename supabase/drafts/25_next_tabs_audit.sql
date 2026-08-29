/* ============================================================
   DRAFT 25 - reachability audit for the next tabs (AUDIT)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Writes nothing: every probe rolls back.

   >>> RUN THE SECTIONS SEPARATELY. <<<

   Per CLAUDE.md ground rule 4a. Covers announcements, ministries and
   church_links - the three tables the next tabs touch - and asks BOTH
   questions this project keeps getting wrong:

     1. can a pastor write it?          (draft 22's question)
     2. can anon READ it back the way
        the public page reads it?       (FF-42's question, the one that was
                                         skipped and cost three incidents)

   Draft 22 asked only the first. FF-42 happened because the second was
   inferred from "the FK exists and the types compile" rather than executed.
   Both are asked here, before a line of the tabs is written.

   NOT COVERED: `gifts`. Nothing is being built against it - see the Giving
   note in section 4.
   ============================================================ */


/* ============================================================
   SECTION 1 - POLICY INVENTORY (read-only)

   Context for sections 2 and 3, not a verdict. Read `using_expr`: anything
   resolving through church_members is member-only whatever roles it nominally
   applies to.
   ============================================================ */

select c.relname::text as table_name,
       coalesce(p.polname, '(no policy)') as policy_name,
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
   and c.relname in ('announcements', 'ministries', 'church_links')
 order by c.relname, p.polcmd, p.polname;


/* ============================================================
   SECTION 2 - WRITE PROBES (rolls back)

   The full lifecycle each tab performs, as the pastor's own role.

     INSERT 0 1 / UPDATE 1 / DELETE 1   the tab can do that
     ERROR 42501                        a policy or grant is missing
     UPDATE 0 / DELETE 0, no error      RLS filtered it silently - FF-27's
                                        shape, and the one that matters most
   ============================================================ */

begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', u.id, 'role', 'authenticated')::text,
  true
) as jwt_set
  from auth.users u
 where u.email = 'jasonvega1974@gmail.com';

set local role authenticated;

/* ---- announcements ---- */
insert into public.announcements (church_id, body, visible, sort_order)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'Probe announcement', true, 999);

update public.announcements set body = 'Probe announcement 2'
 where body = 'Probe announcement';

delete from public.announcements where body = 'Probe announcement 2';

/* ---- ministries ---- */
insert into public.ministries (church_id, name, visible, sort_order)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'Probe Ministry', true, 999);

update public.ministries set name = 'Probe Ministry 2' where name = 'Probe Ministry';

delete from public.ministries where name = 'Probe Ministry 2';

/* ---- church_links ----
   The giving link and the two YouTube channels. Nothing has ever written this
   table from the portal - draft 10 seeded it and no UI has touched it since. */
insert into public.church_links
  (church_id, kind, platform, label, url, sort_order, is_primary)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'social', 'probe',
        'Probe Link', 'https://example.com/probe', 999, false);

update public.church_links set label = 'Probe Link 2' where platform = 'probe';

delete from public.church_links where platform = 'probe';

select 'all three writable by a pastor' as verdict;

rollback;


/* ============================================================
   SECTION 3 - ANON READ PROBES (rolls back)

   Ground rule 4a. Seeds BOTH states and reads as anon, because every one of
   these tables is rendered publicly and a policy that looks right can still
   return nothing.

   Expect:
     announcements  visible=1  hidden=0
     ministries     visible=1  hidden=0
     church_links   any=1                 (no visibility column - the whole
                                            row set is public by design, which
                                            is how the Give button resolves)

   A hidden row coming back 1 means the visible flag is not honoured and the
   tab would publish drafts. A visible row coming back 0 is FF-42 again.
   ============================================================ */

begin;

insert into public.announcements (church_id, body, visible, sort_order)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'Probe anon visible', true,  998),
       ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'Probe anon hidden',  false, 999);

insert into public.ministries (church_id, name, visible, sort_order)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'Probe Min Visible', true,  998),
       ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'Probe Min Hidden',  false, 999);

insert into public.church_links
  (church_id, kind, platform, label, url, sort_order, is_primary)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'social', 'probe',
        'Probe Link', 'https://example.com/probe', 999, false);

set local role anon;

select
  (select count(*) from public.announcements where body = 'Probe anon visible')
    as ann_visible,
  (select count(*) from public.announcements where body = 'Probe anon hidden')
    as ann_hidden,
  (select count(*) from public.ministries where name = 'Probe Min Visible')
    as min_visible,
  (select count(*) from public.ministries where name = 'Probe Min Hidden')
    as min_hidden,
  (select count(*) from public.church_links where platform = 'probe')
    as link_any;

rollback;


/* ============================================================
   SECTION 4 - GIVING: is there anything to report on?

   Read-only. This is evidence for a scoping decision, not a fix.

   The prototype's Giving tab is a MODE SWITCH - "Use my Tithe.ly link" or
   "Built-in giving (Stripe)" - and its own words put the gift list under
   Stripe only: "Gifts happen right on your website, and every gift shows up in
   the list on this page." Under Tithe.ly it says the opposite: "Nothing about
   how you receive money changes."

   gifts.stripe_session_id says the same thing in the schema: that table is
   populated by Stripe webhooks. Tithe.ly does not push into our database.

   FF-32 decided Tithe.ly, no Stripe. So there is no data source for a gift
   list, and this query should return zero.

   If it returns rows, something is populating gifts that I do not know about,
   and the Giving scoping below is wrong.
   ============================================================ */

select count(*) as gift_rows,
       count(stripe_session_id) as with_stripe_session,
       min(created_at) as earliest,
       max(created_at) as latest
  from public.gifts;

select giving_mode, giving_url is not null as has_giving_url
  from public.churches
 where slug = 'church-for-truckers';
