/* ============================================================
   DRAFT 18 - revoke the write grants nothing uses
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Requires: draft 17 (applied 2026-08-27).
   Required for: section 2b unblocks the branding form, which is broken right
   now. Sections 1/2/3 close a latent trap and are not urgent.

   Section 2b was conditional when this file was written and is now CONFIRMED -
   draft 19 isolated the cause. Run the whole file.

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
   SECTION 2b - the branding-form fix. CONFIRMED by draft 19, run it.

   saveBranding failed with:

     [portal] saveBranding failed for church 36cb9fdf-...:
     permission denied for table church_theme

   Draft 19 isolated the cause. Probe A updated the seven columns draft 17
   granted and succeeded. Probe C was identical except that it also wrote
   church_id, and raised 42501. The column ACL agrees: church_id is
   {authenticated=a/postgres} - INSERT only - while every other column is
   {authenticated=aw/postgres}, INSERT and UPDATE.

   Note the message said "table", not "column". Postgres has a column-granular
   form but the executor's DML permission check does not use it, so a missing
   COLUMN privilege on INSERT/UPDATE also reports as "permission denied for
   table". The wording cannot distinguish the two; the probes can.

   WHY THE COLUMN IS WRITTEN AT ALL
   saveBranding upserts. CFT has a theme row from migration 03, so the
   statement takes ON CONFLICT DO UPDATE, and PostgREST builds the SET clause
   from every column in the payload - including church_id, the conflict target.
   Draft 19 probe D, whose SET list was written by hand WITHOUT church_id,
   passed the ACL check and stopped at RLS instead. That difference is the bug.

   WHY THIS IS SAFE
   The update policy from draft 17 carries a `with check` on church_id, so the
   row must still belong to a church the user pastors after the write. The
   grant opens the column; the policy still decides the value. A pastor cannot
   push their theme into a church they do not belong to.

   One honest edge: a pastor of TWO churches could move a theme row from one to
   the other, since both pass the check. They can already edit both themes, so
   this grants no new reach - but if either church already has a theme row the
   primary key refuses it, and if not, the origin church is left without one.
   Not worth blocking; worth knowing.
   ============================================================ */

begin;

grant update (church_id) on public.church_theme to authenticated;

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
     church_theme  authenticated  UPDATE  8   was 7 before section 2b added
                                              church_id

   No INSERT or DELETE row for churches. No DELETE row for church_theme.
   No write row of any kind for anon.

   church_theme INSERT and UPDATE are both 8 now, but they are not the same
   eight: INSERT includes church_id and UPDATE now does too, so the two lists
   finally match. That is the upsert's requirement, not a coincidence.
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
