/* APPLIED 2026-08-28 against project cyyxhhwuyeyvewqrhewt.
   Moved from supabase/drafts/ after the run. History, not a to-do.
   Both fixes confirmed by probe. The pre-approved prayer insert was
   refused with 42501 (FF-34 closed); the contacts insert succeeded once
   the probe stopped counting as anon (FF-33 closed) - see the note on 4b. */

/* ============================================================
   DRAFT 21 - policies for the two public forms (FF-33, FF-34)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  APPLIED 2026-08-28.
   Required for: the Plan-a-Visit form working, and the prayer wall being safe
                 to render.

   >>> RUN THE SECTIONS SEPARATELY. Section 1 is the audit. <<<

   Phase B step 4 builds the two forms the prototype banner warns against
   porting from Web3Forms: Plan a Visit writes `contacts`, the prayer request
   writes `prayer_requests`. Reading the existing policies first turned up two
   problems, one blocking and one a hole.

   ------------------------------------------------------------
   PROBLEM 1 (FF-33) - contacts has no anon insert policy
   ------------------------------------------------------------
   The 2026-08-27 audit shows `contacts` with exactly two policies,
   `pastor+ can edit contacts` (ALL) and `staff+ can view contacts` (select).
   Neither is satisfiable for anon, so a visitor submitting the visit form is
   refused.

   It fails LOUDLY, unlike FF-27: an INSERT with no matching policy raises
   42501, where an UPDATE is silently filtered to zero rows. So this one would
   have surfaced on the first submission rather than pretending to work.

   ------------------------------------------------------------
   PROBLEM 2 (FF-34) - prayer_requests anon policies are too loose
   ------------------------------------------------------------
   Migration 01 wrote:

     create policy "prayer_requests: anon submit"
       on public.prayer_requests for insert
       with check (true);

     create policy "prayer_requests: anon read approved"
       on public.prayer_requests for select
       using (status = 'approved');

   `with check (true)` constrains NOTHING. The anon key ships in every browser,
   so anyone can POST straight to /rest/v1/prayer_requests and choose every
   column - including `status`. Setting `status = 'approved'` satisfies the read
   policy above, so arbitrary text publishes itself to a church's prayer wall
   with no moderation. `church_id`, `prayed_count`, `approved_at` and
   `approved_by` are equally unconstrained.

   Going through a Server Action does not help. The action can set
   status = 'pending' correctly and the direct POST still works - the endpoint
   is public and the policy is the only thing standing in front of it.

   Separately, the read policy has NO church filter. `using (status =
   'approved')` returns approved rows for EVERY church, so one church's prayer
   wall is readable from any other church's site, or with a bare anon key. That
   is the cross-tenant class this project treats as a blocker before a second
   church has real data.

   Neither is exploitable today - nothing public reads or writes prayer_requests
   until step 4 ships the bulletin. Both become live on that deploy.

   SAFE TO RUN TWICE. drop-if-exists then create throughout.
   ============================================================ */


/* ============================================================
   SECTION 1 - AUDIT (read-only)

   Confirms both problems before section 2 acts. Read `with_check_expr` on the
   insert policies: `true` is the hole, and a missing row for contacts is the
   blocker.
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
   and c.relname in ('contacts', 'prayer_requests', 'announcements')
 order by c.relname, p.polcmd, p.polname;

/* What contacts.type actually holds today, so section 2's allow-list matches
   reality rather than the ADDENDUM_01 comment. Expect zero rows or 'general'. */
select type, count(*) as rows
  from public.contacts
 group by type
 order by type;


/* ============================================================
   SECTION 2 - contacts: let a visitor submit (FF-33)

   Constrained rather than `with check (true)`:

     - the church must exist and be active. A form post naming a suspended or
       nonexistent church is not a contact, it is noise.
     - `type` must be one of the four the application uses. Without this, a
       crafted post could invent types and quietly partition the pastor's inbox
       into buckets no tab reads.

   No SELECT for anon. A visitor may write to this table and must never read
   it - it holds other people's names, emails and phone numbers. The pastor
   reads it through `staff+ can view contacts`, which already exists.
   ============================================================ */

begin;

drop policy if exists "contacts: anon submit" on public.contacts;

create policy "contacts: anon submit"
  on public.contacts for insert
  with check (
    type in ('general', 'visit', 'prayer', 'group')
    and church_id in (
      select c.id from public.churches c where c.status = 'active'
    )
  );

commit;


/* ============================================================
   SECTION 3 - prayer_requests: close the self-publish hole (FF-34)

   The insert policy gains the constraints `with check (true)` never had:

     - status must be 'pending'. This is the whole fix. A submission cannot
       arrive pre-approved, so the prayer wall shows only what a pastor let
       through.
     - prayed_count must start at 0, so a request cannot arrive claiming
       hundreds of prayers.
     - approved_at and approved_by must be null - those are the moderator's
       marks, not the submitter's.
     - the church must be active, same reasoning as contacts.

   The read policy gains the church scoping it never had. Without it one
   church's approved requests are readable from any other church's site.

   NOT CHANGED: `prayer_requests: member full access`, which is how the pastor
   approves a request. Approval flips status to 'approved' as an authenticated
   member and is unaffected by the insert policy above.
   ============================================================ */

begin;

drop policy if exists "prayer_requests: anon submit" on public.prayer_requests;

create policy "prayer_requests: anon submit"
  on public.prayer_requests for insert
  with check (
    status = 'pending'
    and prayed_count = 0
    and approved_at is null
    and approved_by is null
    and church_id in (
      select c.id from public.churches c where c.status = 'active'
    )
  );

drop policy if exists "prayer_requests: anon read approved" on public.prayer_requests;

create policy "prayer_requests: anon read approved"
  on public.prayer_requests for select
  using (
    status = 'approved'
    and church_id in (
      select c.id from public.churches c where c.status = 'active'
    )
  );

commit;


/* ============================================================
   SECTION 4 - VERIFY

   4a - the policies. Expect:

     contacts         contacts: anon submit              insert  with check set
     prayer_requests  prayer_requests: anon submit       insert  status = pending ...
     prayer_requests  prayer_requests: anon read approved select  ... and church active

   4b - a reachability probe, same pattern as draft 20. Everything rolls back.

   Expect, as the anon role:
     visit_ok      = 1   the visit form can write
     preapproved   = ERROR  a pre-approved submission is REFUSED
   The second is the point: if it inserts, section 3 did not take.
   ============================================================ */

select c.relname::text as table_name,
       p.polname as policy_name,
       case p.polcmd when 'r' then 'select' when 'a' then 'insert' else p.polcmd::text end as cmd,
       pg_get_expr(p.polqual, p.polrelid)      as using_expr,
       pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_policy p on p.polrelid = c.oid
 where n.nspname = 'public'
   and c.relname in ('contacts', 'prayer_requests')
   and p.polcmd in ('a', 'r')
 order by c.relname, p.polname;


/* ---- 4b. Probe. Run the block; it rolls back either way. ---- */

/* CORRECTED 2026-08-28. The first version of this probe counted the row while
   still `set local role anon`, and returned 0 with no error - which reads as a
   failed insert when the insert had in fact succeeded.

   contacts has NO anon SELECT policy, deliberately: a visitor may write to that
   table and must never read it. So anon cannot see its own row, and the count
   was measuring the read policy rather than the write it was meant to test.

   `reset role` before counting. The insert running without raising is the real
   result; the count only confirms the row landed. Same mistake as draft 20's
   staff/groups controls - a check that returns the same value whether or not
   the thing under test worked. */

begin;
  set local role anon;

  insert into public.contacts (church_id, type, name, email, message)
  values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'visit',
          'RLS probe', 'probe@example.com', 'rolled back');

  reset role;

  select count(*) as visit_ok from public.contacts
   where email = 'probe@example.com';
rollback;

/* This one MUST fail with "new row violates row-level security policy".
   If it succeeds, the prayer wall can still be self-published to. */
begin;
  set local role anon;

  insert into public.prayer_requests (church_id, body, status)
  values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a',
          'RLS probe - should be refused', 'approved');
rollback;
