/* ============================================================
   DRAFT 27 - prove the prayer wall shows approved and NOTHING else
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Requires: nothing. Read-only in effect - section 2 rolls back.

   WHY THIS EXISTS
   The Prayer Wall moderation tab introduces two statuses that had never been
   written before: 'private' and 'archived'. Both must be invisible to a
   visitor, and 'private' especially so - it is the status a pastor picks for a
   request about a diagnosis or a marriage that was never meant to be public.

   Getting that wrong is not a cosmetic bug. It publishes something a person
   asked to be kept private.

   WHY CODE REVIEW IS NOT ENOUGH (ground rule 4a)
   Two things claim to exclude it, and both look right by inspection:

     lib/collections.ts   .eq("status", "approved")
     RLS "anon read approved"   using (status = 'approved' and church active)

   That is exactly what FF-27, FF-31 and FF-42 also looked like before they
   shipped. Reading the filter proves the query is well formed. Only an anon
   read proves what comes back.

   WHY A PLAIN SELECT WOULD BE A FAKE PROBE
   public.prayer_requests is currently EMPTY. As the anon role it is also
   empty by policy. So "select as anon, get 0 rows" passes whether the policy
   works or not - it cannot fail, which makes it worthless (FF-35).

   This probe therefore INSERTS one row per status first, inside a transaction,
   and rolls back. The approved row is the control: if it does not come back,
   the probe itself is broken and the three zeros mean nothing.

   WHAT A FAILING RUN LOOKS LIKE - read this before running
     approved_visible = 0  -> the probe is broken, ignore everything else
     pending_visible  > 0  -> unread requests are public. STOP.
     private_visible  > 0  -> PRIVATE REQUESTS ARE PUBLIC. STOP, do not ship.
     archived_visible > 0  -> archived requests are public. STOP.
   Expected: 1, 0, 0, 0.
   ============================================================ */


/* ============================================================
   SECTION 1 - the policies as they stand. Run alone, keep the output.

   Expect exactly three rows:
     prayer_requests: anon submit         INSERT  status = 'pending' ...
     prayer_requests: anon read approved  SELECT  status = 'approved' ...
     prayer_requests: member full access  ALL     church_members ...
   ============================================================ */

select polname                                as policy_name,
       case polcmd when 'r' then 'SELECT'
                   when 'a' then 'INSERT'
                   when 'w' then 'UPDATE'
                   when 'd' then 'DELETE'
                   when '*' then 'ALL' end    as command,
       pg_get_expr(polqual, polrelid)         as using_expr,
       pg_get_expr(polwithcheck, polrelid)    as with_check_expr
  from pg_policy
 where polrelid = 'public.prayer_requests'::regclass
 order by polname;


/* ============================================================
   SECTION 2 - THE PROBE. Everything rolls back.

   Run the whole block at once. The rollback is part of it.
   ============================================================ */

begin;

-- Insert one row per status as the OWNER, bypassing the anon insert policy on
-- purpose. The point is to test the READ, and the insert policy would refuse
-- three of these four rows before the read was ever reached.
insert into public.prayer_requests (church_id, body, display_name, status)
select c.id, v.body, 'Probe', v.status
  from public.churches c
  cross join (values
        ('PROBE approved - MUST be visible', 'approved'),
        ('PROBE pending  - must NOT be visible', 'pending'),
        ('PROBE private  - must NOT be visible', 'private'),
        ('PROBE archived - must NOT be visible', 'archived')
      ) as v(body, status)
 where c.slug = 'church-for-truckers';

-- Now read exactly the way the public page reads: as anon, through the same
-- policy. set local confines the role change to this transaction.
set local role anon;

select
  count(*) filter (where status = 'approved') as approved_visible,
  count(*) filter (where status = 'pending')  as pending_visible,
  count(*) filter (where status = 'private')  as private_visible,
  count(*) filter (where status = 'archived') as archived_visible
  from public.prayer_requests
 where display_name = 'Probe';

-- Back to the owner before rolling back, so the rollback is not itself
-- executed under a role that may not be permitted to do it (FF-35).
reset role;

rollback;


/* ============================================================
   SECTION 3 - confirm the rollback took.

   Expect 0. A non-zero count means probe rows are now live data and must be
   deleted by hand:
     delete from public.prayer_requests where display_name = 'Probe';
   ============================================================ */

select count(*) as probe_rows_left
  from public.prayer_requests
 where display_name = 'Probe';
