/* APPLIED 2026-08-27 against project cyyxhhwuyeyvewqrhewt.
   Moved from supabase/drafts/ after the run. History, not a to-do. */

/* ============================================================
   DRAFT 16 - do churches / church_theme have a write policy? (READ ONLY)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  safe to run any time. Changes nothing.

   WHY
   Church Details reports "Saved and live on the website" and writes nothing.
   Edit My Website saves correctly. The difference is the table:

     Edit My Website -> church_sections -> has "pastor+ can edit sections"
     Church Details  -> churches, church_theme -> not in that policy set

   The 2026-08-27 audit listed nine `pastor+ can edit` ALL policies. churches
   and church_theme were not among them. If neither has an UPDATE or ALL
   policy, RLS filters the row out of the UPDATE's scope, Postgres reports
   0 rows changed, PostgREST answers 204, and supabase-js returns
   { error: null } - a silent refusal that looks exactly like success.

   That also predicts the asymmetry worth confirming below: an UPDATE with no
   policy is silent, but an INSERT with no policy raises 42501. saveBranding
   upserts church_theme, so it should FAIL LOUDLY where saveIdentity failed
   quietly - if the church_theme row already exists it takes the UPDATE path
   and goes quiet too.

   Draft 17 gets written against this output, not against a guess.
   ============================================================ */

select c.relname                                   as table_name,
       case when c.relrowsecurity then 'on' else 'OFF' end as rls,
       coalesce(p.polname, '(no policy)')          as policy_name,
       coalesce(
         case p.polcmd
           when '*' then 'ALL'
           when 'r' then 'select'
           when 'a' then 'insert'
           when 'w' then 'update'
           when 'd' then 'delete'
         end, '-')                                 as cmd,
       pg_get_expr(p.polqual, p.polrelid)          as using_expr,
       pg_get_expr(p.polwithcheck, p.polrelid)     as with_check_expr,
       case
         when p.polcmd in ('*', 'w') then '<<< a write policy exists'
         else ''
       end                                         as note
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
 where n.nspname = 'public'
   and c.relname in ('churches', 'church_theme')
 order by c.relname, p.polcmd, p.polname;
