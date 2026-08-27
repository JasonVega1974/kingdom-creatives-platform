/* ============================================================
   DRAFT 14 - enforce videos.published in the public select policy (FF-25)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Required for: Phase B serving a video page. Not urgent today - nothing
   public reads videos yet and CFT has no video rows.

   WHAT THIS IS NOT
   This is not the draft 14 that was reserved for FF-24. That entry is closed:
   the section 1 audit came back with RLS on for all twenty-one tables. And the
   `with check` gap on the nine `pastor+ can edit` policies is not a defect -
   Postgres applies `using` to the after-image when `with check` is absent, so
   those policies already constrain writes. See FF-23 STATUS.

   WHAT IS ACTUALLY WRONG
   videos has `published boolean not null`. The public policy ignores it:

     using ( church_id in (select id from churches where status = 'active') )

   church_sections filters `visible = true`. staff filters `visible = true`.
   videos filters nothing, so an unpublished video is readable by anyone with
   the anon key - which ships in every browser bundle. No login required.

   gallery has no visibility column, so its policy is correct as written and is
   deliberately not touched here.

   WHAT DOES NOT CHANGE
   `staff+ can view videos` is a separate permissive policy and is untouched, so
   an authenticated pastor/staff/admin still sees unpublished rows in the
   portal. Permissive policies OR together: a portal user passes via that policy
   regardless of what the public one says.

   SAFE TO RUN TWICE - drop if exists, then create.
   ============================================================ */


/* ------------------------------------------------------------
   SECTION 1 - BEFORE. Run alone, keep the output.
   Expect one row whose using_expr has no reference to `published`.
   ------------------------------------------------------------ */

select p.polname as policy_name,
       pg_get_expr(p.polqual, p.polrelid) as using_expr,
       case when pg_get_expr(p.polqual, p.polrelid) like '%published%'
            then 'already filtered - this draft may have run'
            else 'NOT filtered - FF-25 confirmed' end as verdict
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname = 'videos'
   and p.polname = 'public can view videos of active churches';


/* ------------------------------------------------------------
   SECTION 2 - THE FIX. Wrapped so a failure rolls back rather than
   leaving videos with no public policy at all.
   ------------------------------------------------------------ */

begin;

drop policy if exists "public can view videos of active churches"
  on public.videos;

create policy "public can view videos of active churches"
  on public.videos for select
  using (
    published = true
    and church_id in (
      select c.id from public.churches c
       where c.status = 'active'
    )
  );

commit;


/* ------------------------------------------------------------
   SECTION 3 - VERIFY. Expect one row reading 'fixed'.
   ------------------------------------------------------------ */

select p.polname as policy_name,
       pg_get_expr(p.polqual, p.polrelid) as using_expr,
       case when pg_get_expr(p.polqual, p.polrelid) like '%published%'
            then 'fixed'
            else '*** STILL UNFILTERED ***' end as verdict
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname = 'videos'
   and p.polname = 'public can view videos of active churches';
