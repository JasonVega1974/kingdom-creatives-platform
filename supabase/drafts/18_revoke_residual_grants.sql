/* ============================================================
   DRAFT 18 - revoke the write grants nothing uses
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Requires: draft 17 (applied 2026-08-27).
   Required for: nothing today. This closes a trap, not a hole.

   WHAT THIS IS
   Section 4 of draft 17 showed churches still carrying a blanket INSERT grant
   for `authenticated` on every column - address, created_at, custom_domain,
   giving_mode, giving_url and the rest. Draft 17 revoked UPDATE and re-granted
   seven columns, but never touched INSERT, because nothing inserts churches
   from the portal. DELETE was left alone on both tables for the same reason.

   IS IT EXPLOITABLE TODAY? No. A privilege is necessary but not sufficient -
   RLS still has to permit the command. churches has exactly two policies after
   draft 17, `public can view active churches` (select) and `pastor+ can edit
   church` (update). With no INSERT policy, an insert fails 42501 no matter what
   the column grants say. Same for delete on both tables.

   THEN WHY BOTHER
   Because the grant is a loaded trap rather than a live bug. The moment anyone
   adds a permissive INSERT policy - a self-signup flow is the obvious future
   candidate - the blanket column grant activates underneath it and exposes
   slug, custom_domain, status and giving_mode on the insert path. That is
   precisely the failure the column grants in draft 17 exist to prevent, and it
   would arrive silently, attached to a change that looks unrelated to any of
   this.

   Grants and policies are two independent gates. Draft 17 closed the policy
   gate properly and left the grant gate open on the commands it did not need.
   This closes it, so a future policy cannot quietly inherit more than it asks
   for.

   WHAT IS DELIBERATELY LEFT ALONE
   - SELECT on both tables. The public site reads them with the anon key; that
     is how tenant resolution works at all.
   - The column grants added by draft 17. Unchanged.
   - service_role. It bypasses RLS and owns the sync jobs, and revoking from
     anon/authenticated does not touch it.

   SAFE TO RUN TWICE. REVOKE on a privilege that is already absent is a no-op,
   not an error.
   ============================================================ */


/* ============================================================
   SECTION 1 - BEFORE. Run alone, keep the output.

   Expect rows for churches INSERT (every column) and DELETE, and for
   church_theme DELETE. Those are what section 2 removes.
   ============================================================ */

select table_name,
       grantee,
       privilege_type,
       count(*) as columns_granted
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name in ('churches', 'church_theme')
   and grantee in ('anon', 'authenticated')
 group by table_name, grantee, privilege_type
 order by table_name, grantee, privilege_type;


/* ============================================================
   SECTION 2 - THE REVOKE
   ============================================================ */

begin;

revoke insert on public.churches     from anon, authenticated;
revoke delete on public.churches     from anon, authenticated;
revoke delete on public.church_theme from anon, authenticated;

commit;


/* ============================================================
   SECTION 3 - VERIFY

   Expect exactly this and nothing more:

     churches      authenticated  SELECT  (all columns)
     churches      anon           SELECT  (all columns)
     churches      authenticated  UPDATE  7   name, tagline, address, phone,
                                              email, service_times, updated_at
     church_theme  authenticated  SELECT  (all columns)
     church_theme  anon           SELECT  (all columns)
     church_theme  authenticated  INSERT  8
     church_theme  authenticated  UPDATE  7

   No INSERT or DELETE row for churches. No DELETE row for church_theme.
   No write row of any kind for anon.
   ============================================================ */

select table_name,
       grantee,
       privilege_type,
       count(*) as columns_granted
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name in ('churches', 'church_theme')
   and grantee in ('anon', 'authenticated')
 group by table_name, grantee, privilege_type
 order by table_name, grantee, privilege_type;
