/* ============================================================
   DRAFT 15 - post-batch verification (READ ONLY)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  safe to run any time. Changes nothing. No transaction needed.

   Ran 08, 04, 09, 10, 12, 13 on 2026-08-27 without keeping the output.
   "No errors" is not the same as "it took": every seed in that batch is
   guarded with `where not exists` or `if not exists`, which is what makes
   them safe to re-run and also what makes a silent no-op look identical
   to a successful insert if you only watch for errors.

   Every check is a scalar, so this returns a FIXED row count with its own
   verdict per row. Run the whole file at once.

   Block comments, not line comments - a dropped `--` on copy made Postgres
   parse the prose as SQL. Numbering: 14 is reserved for the FF-24 fix.
   ============================================================ */

select 'draft 08' as draft,
       'church_sections unique constraint includes page_slug' as check_name,
       coalesce(
         (select string_agg(pg_get_constraintdef(oid), ' | ' order by conname)
            from pg_constraint
           where conrelid = 'public.church_sections'::regclass
             and contype  = 'u'),
         '(no unique constraint)') as actual,
       case when exists (
         select 1 from pg_constraint
          where conrelid = 'public.church_sections'::regclass
            and contype  = 'u'
            and pg_get_constraintdef(oid) like '%page_slug%'
       ) then 'PASS' else 'FAIL - draft 04 could not have seeded correctly' end as verdict

union all
select 'draft 04',
       'CFT church_sections row count (expect 34)',
       (select count(*)::text from public.church_sections s
          join public.churches c on c.id = s.church_id
         where c.slug = 'church-for-truckers'),
       case when (select count(*) from public.church_sections s
                    join public.churches c on c.id = s.church_id
                   where c.slug = 'church-for-truckers') = 34
            then 'PASS' else 'CHECK - expected 34' end

union all
select 'draft 04',
       'CFT distinct page_slug count (expect 11)',
       (select count(distinct s.page_slug)::text from public.church_sections s
          join public.churches c on c.id = s.church_id
         where c.slug = 'church-for-truckers'),
       case when (select count(distinct s.page_slug) from public.church_sections s
                    join public.churches c on c.id = s.church_id
                   where c.slug = 'church-for-truckers') = 11
            then 'PASS' else 'CHECK - expected 11' end

union all
select 'draft 04',
       'content jsonb that is not an object (expect 0)',
       (select count(*)::text from public.church_sections s
          join public.churches c on c.id = s.church_id
         where c.slug = 'church-for-truckers'
           and jsonb_typeof(s.content) <> 'object'),
       case when (select count(*) from public.church_sections s
                    join public.churches c on c.id = s.church_id
                   where c.slug = 'church-for-truckers'
                     and jsonb_typeof(s.content) <> 'object') = 0
            then 'PASS' else 'FAIL - a section landed as a bare string' end

union all
select 'draft 09',
       'church_links table exists',
       coalesce(to_regclass('public.church_links')::text, '(missing)'),
       case when to_regclass('public.church_links') is not null
            then 'PASS' else 'FAIL' end

union all
select 'draft 09',
       'church_links RLS enabled + policy count (expect on / 2)',
       coalesce((select case when relrowsecurity then 'on' else 'OFF' end
                   from pg_class where oid = to_regclass('public.church_links')), '(no table)')
         || ' / '
         || coalesce((select count(*)::text from pg_policy
                       where polrelid = to_regclass('public.church_links')), '0'),
       case when (select relrowsecurity from pg_class
                   where oid = to_regclass('public.church_links'))
            then 'PASS' else 'FAIL - anon key can read/write church_links' end

union all
select 'draft 10',
       'CFT church_links row count (expect 4)',
       (select count(*)::text from public.church_links l
          join public.churches c on c.id = l.church_id
         where c.slug = 'church-for-truckers'),
       case when (select count(*) from public.church_links l
                    join public.churches c on c.id = l.church_id
                   where c.slug = 'church-for-truckers') = 4
            then 'PASS' else 'CHECK - expected 4 (2 video, 1 social, 1 giving)' end

union all
select 'draft 10',
       'CFT links by kind',
       coalesce((select string_agg(k.kind || '=' || k.n, ', ' order by k.kind)
                   from (select l.kind, count(*)::text as n
                           from public.church_links l
                           join public.churches c on c.id = l.church_id
                          where c.slug = 'church-for-truckers'
                          group by l.kind) k), '(none)'),
       'expect giving=1, social=1, video=2'

union all
select 'draft 12',
       'CFT portal members (expect at least 1 pastor)',
       coalesce((select string_agg(u.email || ' (' || m.role || ')', ', ' order by u.email)
                   from public.church_members m
                   join public.churches c on c.id = m.church_id
                   join auth.users u on u.id = m.user_id
                  where c.slug = 'church-for-truckers'), '(nobody - portal login will fail)'),
       case when exists (
         select 1 from public.church_members m
           join public.churches c on c.id = m.church_id
          where c.slug = 'church-for-truckers'
       ) then 'PASS' else 'FAIL - you cannot log into the portal' end

union all
select 'draft 11',
       'sermons.church_link_id present (not run yet - expect absent)',
       case when exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'sermons'
            and column_name  = 'church_link_id'
       ) then 'present' else 'absent' end,
       'informational - absent is expected, 11 is deliberately deferred'

order by draft, check_name;
