/* ============================================================
   DRAFT 28 - revoke the prayer_requests write grants nothing uses
   Project: cyyxhhwuyeyvewqrhewt
   Status:  RUN 2026-09-01 by Jason. APPLIED.

            Section 2 committed. Verified afterwards from outside the script,
            as anon against a uuid that does not exist so no row could be
            touched either way:

              UPDATE -> 42501 permission denied for table prayer_requests
              DELETE -> 42501 permission denied for table prayer_requests

            Before the revoke both returned 204 with zero rows - RLS filtering
            silently. The change from silent filter to hard privilege denial is
            what proves the revoke took.

            Section 3b raised 42501 "new row violates row-level security policy"
            on the final block, which is the PASS condition - see the note
            there. That error also proves the anon INSERT grant survived: a lost
            grant fails with "permission denied for table" BEFORE any policy is
            evaluated, so reaching the RLS check at all means the public prayer
            form still works and the FF-34 hole is still shut.

            Final state - anon: INSERT, SELECT. authenticated: unchanged.
   Requires: nothing. Independent of draft 27 and of the Prayer Wall tab.

   >>> RUN SECTION 1 FIRST AND READ IT. Sections 2-3 assume what it shows. <<<

   WHAT THIS IS
   Same shape as draft 18, on a table draft 18 never reached. Supabase grants
   ALL on a new public table to anon and authenticated by default. Migrations
   17, 18 and 23 walked that back for churches, church_theme and church_media.
   public.prayer_requests was never touched, so it should still carry the
   blanket grant - section 1 confirms before anything is revoked.

   IS IT EXPLOITABLE TODAY? No, and section 1 is what proves it rather than
   this comment. A privilege is necessary but not sufficient - RLS still has to
   permit the command. The three policies on this table are:

     anon submit          INSERT, with check (status = 'pending' ...)
     anon read approved   SELECT, using (status = 'approved' ...)
     member full access   ALL,    using/with check (church_members ...)

   For an anon UPDATE or DELETE the only applicable policy is "member full
   access", whose test is `cm.user_id = auth.uid()`. An anon request has no
   auth.uid(), so it fails and the command is refused regardless of the grant.

   THEN WHY BOTHER
   Because the grant is a loaded trap, exactly as draft 18 put it. The moment
   anyone adds a permissive UPDATE policy - a "let a submitter edit their own
   request" flow is the obvious future candidate - the blanket column grant
   activates underneath it, and `status` is in it. Anything that can write
   `status` can publish itself to the prayer wall, which is the FF-34 hole all
   over again, arriving silently attached to a change that looks unrelated.

   WHAT IS DELIBERATELY LEFT ALONE
   - anon INSERT stays. It is how the public form submits, and the insert
     policy already pins status, prayed_count, approved_at and approved_by.
   - anon SELECT stays. The read policy already restricts it to approved rows
     of active churches.
   - authenticated keeps SELECT, UPDATE and DELETE. Those are the Prayer Wall
     moderation tab, and "member full access" gates them.
   ============================================================ */


/* ============================================================
   SECTION 1 - BEFORE. Run alone, keep the output.

   Expect, if the default grant is still in place: rows for anon and
   authenticated covering INSERT, SELECT, UPDATE, DELETE (and probably
   REFERENCES / TRIGGER / TRUNCATE).

   If anon already has no UPDATE or DELETE row, the trap is already closed -
   stop here and do not run section 2.
   ============================================================ */

select grantee,
       privilege_type,
       is_grantable
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name   = 'prayer_requests'
   and grantee in ('anon', 'authenticated')
 order by grantee, privilege_type;


/* ============================================================
   SECTION 2 - THE REVOKE

   anon loses the two commands no policy would let it run anyway. Nothing in
   the application uses them: the public site inserts and reads, and every
   write in the portal runs as `authenticated`.
   ============================================================ */

begin;

revoke update on public.prayer_requests from anon;
revoke delete on public.prayer_requests from anon;

commit;


/* ============================================================
   SECTION 3 - VERIFY

   3a - the grants. Expect anon to have INSERT and SELECT only. authenticated
   keeps all four.
   ============================================================ */

select grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name   = 'prayer_requests'
   and grantee in ('anon', 'authenticated')
 group by grantee
 order by grantee;

/* ============================================================
   3b - REACHABILITY. The grants above are the theory; this is whether the
   two things that must still work, still work. Everything rolls back.

   Expect:
     submit_ok        = 1      the public form can still submit
     preapproved      = ERROR  a pre-approved submission is still refused
   A failure here means section 2 revoked something load-bearing - the
   rollback means nothing is lost, but do not leave it in that state.
   ============================================================ */

begin;

set local role anon;

-- Must succeed: this is the public prayer form.
insert into public.prayer_requests (church_id, body, display_name, status)
select c.id, 'PROBE submit', 'Probe', 'pending'
  from public.churches c
 where c.slug = 'church-for-truckers';

select count(*) as submit_ok
  from public.prayer_requests
 where display_name = 'Probe';

reset role;

rollback;

/* Then, separately, confirm the FF-34 hole is still shut. Run this on its own
   - it is EXPECTED TO RAISE. "new row violates row-level security policy" is
   the pass condition; if it inserts, the insert policy has been lost. */

begin;
set local role anon;

insert into public.prayer_requests (church_id, body, display_name, status)
select c.id, 'PROBE preapproved - MUST BE REFUSED', 'Probe', 'approved'
  from public.churches c
 where c.slug = 'church-for-truckers';

/* No `reset role` here, unlike the block above, and the difference is
   deliberate. This insert is EXPECTED to raise 42501, which aborts the
   transaction - and an aborted transaction rejects every further command
   except COMMIT and ROLLBACK with:

     25P02  current transaction is aborted, commands ignored until end of
            transaction block

   So a `reset role` on this path could never run; it would only add a second,
   confusing error after the one that means success. `rollback` is enough:
   `set local role` is scoped to the transaction and reverts on its own. */
rollback;
