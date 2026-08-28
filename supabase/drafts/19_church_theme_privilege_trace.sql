/* ============================================================
   DRAFT 19 - trace "permission denied for table church_theme"
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Writes nothing: section 2 executes DML inside transactions that ROLL BACK.

   >>> RUN EACH PROBE SEPARATELY. The editor shows only the last result. <<<

   THE SYMPTOM
   saveBranding logs:

     [portal] saveBranding failed for church 36cb9fdf-...:
     permission denied for table church_theme

   WHAT THAT MESSAGE DOES AND DOES NOT TELL US

   It rules OUT row-level security. An RLS refusal reads "new row violates
   row-level security policy for table church_theme". This is the executor's
   ACL check instead, so it is a GRANT problem, not a policy problem.

   It does NOT rule out a missing COLUMN privilege. Postgres has a
   column-granular message ("permission denied for column c of relation t") but
   the executor's DML permission check does not use it - a missing column
   privilege on INSERT or UPDATE surfaces as "permission denied for table".
   So the wording cannot distinguish "no table privilege" from "no privilege on
   one of the columns being written".

   WHAT IS ALREADY KNOWN
   Draft 17 revoked table-level INSERT and UPDATE on church_theme from anon and
   authenticated, then granted them back per column - 8 columns for INSERT
   (including church_id) and 7 for UPDATE (excluding church_id). Per the
   PostgreSQL INSERT documentation that should be sufficient:

     "If a column list is specified, you only need INSERT privilege on the
      listed columns. Similarly, when ON CONFLICT DO UPDATE is specified, you
      only need UPDATE privilege on the column(s) that are listed to be
      updated."

   So either a grant did not land the way section 4 appeared to show, or the
   statement touches a column that was not granted. Section 4's output was
   truncated mid-list, so logo_url and updated_at were never confirmed present.

   THE LEADING HYPOTHESIS
   saveBranding upserts. CFT has a theme row from migration 03, so the statement
   takes ON CONFLICT DO UPDATE, and PostgREST builds the SET clause from the
   payload columns. If church_id is in that SET list, the statement needs UPDATE
   privilege on church_id, which draft 17 deliberately withheld. Probe C tests
   exactly that, in isolation.
   ============================================================ */


/* ============================================================
   SECTION 1 - PRIVILEGE INVENTORY (read-only)

   Complete and untruncated, straight from the catalog rather than from
   information_schema, so nothing is hidden by a summary.
   ============================================================ */

select 'TABLE LEVEL' as scope,
       priv         as privilege,
       has_table_privilege('authenticated', 'public.church_theme', priv) as authenticated,
       has_table_privilege('anon',          'public.church_theme', priv) as anon
  from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as priv
 order by priv;

select a.attname as column_name,
       has_column_privilege('authenticated', 'public.church_theme', a.attname, 'SELECT') as sel,
       has_column_privilege('authenticated', 'public.church_theme', a.attname, 'INSERT') as ins,
       has_column_privilege('authenticated', 'public.church_theme', a.attname, 'UPDATE') as upd
  from pg_attribute a
 where a.attrelid = 'public.church_theme'::regclass
   and a.attnum > 0
   and not a.attisdropped
 order by a.attnum;

/* Raw ACLs, in case a grant landed on an unexpected grantee. */
select relname, relacl::text as table_acl
  from pg_class
 where oid = 'public.church_theme'::regclass;

select a.attname, a.attacl::text as column_acl
  from pg_attribute a
 where a.attrelid = 'public.church_theme'::regclass
   and a.attnum > 0
   and not a.attisdropped
   and a.attacl is not null
 order by a.attnum;


/* ============================================================
   SECTION 2 - ROLE PROBES

   Each probe runs as `authenticated` and rolls back. Nothing is written.

   Reading the result of each probe:

     ERROR "permission denied ..."  -> a GRANT is missing. That probe found it.
     "UPDATE 0" / "INSERT 0 1"      -> privileges are fine; RLS filtered the row,
                                       which is expected here because there is no
                                       JWT so auth.uid() is null and the policy
                                       matches nothing.

   That distinction is the whole point: a privilege failure raises, an RLS
   refusal returns zero rows quietly. Same as the bug that started all of this.
   ============================================================ */


/* ---- PROBE A: update only the columns draft 17 granted ----
   Expect: UPDATE 0, no error. If this ERRORS, the 7-column UPDATE grant did not
   land and the problem is section 3 of draft 17, not the upsert. */

begin;
  set local role authenticated;
  update public.church_theme
     set color_primary = '#EC5D1B',
         color_secondary = '#161311',
         color_accent = '#FDFBF5',
         font_heading = font_heading,
         font_body = font_body,
         logo_url = logo_url,
         updated_at = now()
   where church_id = '36cb9fdf-4ca1-414f-a206-c3885e07ed5a';
rollback;


/* ---- PROBE B: update touching logo_url and updated_at alone ----
   Narrows probe A if it failed. These two are the columns section 4's
   truncated output never confirmed. Expect UPDATE 0, no error. */

begin;
  set local role authenticated;
  update public.church_theme
     set logo_url = logo_url,
         updated_at = now()
   where church_id = '36cb9fdf-4ca1-414f-a206-c3885e07ed5a';
rollback;


/* ---- PROBE C: THE HYPOTHESIS - update that writes church_id ----
   This is what PostgREST does if it puts the conflict target in the SET list.
   Expect: ERROR permission denied for table church_theme.

   If A and B pass and C errors, the cause is confirmed: the upsert writes
   church_id and draft 17 did not grant UPDATE on it. */

begin;
  set local role authenticated;
  update public.church_theme
     set church_id = church_id,
         color_primary = '#EC5D1B'
   where church_id = '36cb9fdf-4ca1-414f-a206-c3885e07ed5a';
rollback;


/* ---- PROBE D: the real statement shape ----
   An upsert with the same columns saveBranding sends. Whatever this does is
   what the portal does. Expect it to reproduce the failure exactly. */

begin;
  set local role authenticated;
  insert into public.church_theme
    (church_id, color_primary, color_secondary, color_accent,
     font_heading, font_body, logo_url, updated_at)
  values
    ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', '#EC5D1B', '#161311', '#FDFBF5',
     'Fraunces', 'Source Sans 3', null, now())
  on conflict (church_id) do update
    set color_primary   = excluded.color_primary,
        color_secondary = excluded.color_secondary,
        color_accent    = excluded.color_accent,
        font_heading    = excluded.font_heading,
        font_body       = excluded.font_body,
        logo_url        = excluded.logo_url,
        updated_at      = excluded.updated_at;
rollback;
