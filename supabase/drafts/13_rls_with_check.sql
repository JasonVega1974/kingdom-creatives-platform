-- ============================================================
-- DRAFT 13 - close the RLS `with check` gap (FF-23)
-- Project: cyyxhhwuyeyvewqrhewt
-- Status:  NOT RUN. Jason reviews and runs manually.
-- Required for: a second church having real data in the system.
-- ============================================================
--
-- RUN THIS LAST in the batch, after 09. Section 1 is an audit, and running it
-- after 09 means church_links is included in the report.
--
-- >>> RUN THE THREE SECTIONS SEPARATELY. <<<
-- The Supabase SQL editor shows you the result of the LAST statement only. If
-- you paste the whole file at once you will see section 3 and never see the
-- audit, which is the part worth reading. Select section 1, run, paste the
-- output back. Then section 2. Then section 3.
--
--
-- WHAT IS WRONG
-- Migration 01 writes its member policies like this:
--
--   create policy "announcements: member write"
--     on public.announcements for all
--     using ( exists (select 1 from church_members cm
--                     where cm.church_id = announcements.church_id
--                       and cm.user_id = auth.uid()) );
--
-- `using` tests the row as it exists BEFORE the statement. `with check` tests
-- the row as it will exist AFTER. On a policy covering UPDATE and INSERT,
-- leaving `with check` off means Postgres only constrains what you may touch,
-- never what you may turn it into. A member of church A can run
--
--   update announcements set church_id = '<church B>' where id = '<their row>';
--
-- and the row passes: it belonged to their church when the check ran. The row
-- lands in church B's data. Nothing errors, nothing logs, and church B's pastor
-- sees an announcement they did not write.
--
-- The fix is mechanical: re-issue each policy with a `with check` clause
-- identical to its `using` clause. Same predicate, now applied to the after
-- image as well as the before image.
--
--
-- WHAT CHANGED SINCE FF-23 WAS FILED
-- FF-23 said "eight tables". Reading the migration line by line, it is SEVEN
-- policies across seven tables, and the membership is not what the entry said:
--
--   - `gifts: member read` is `for select`. A SELECT policy has no after image,
--     so `with check` is not merely missing, it is not a legal clause there.
--     FF-23 listed gifts wrongly. It is untouched by this file.
--
--   + `pastor_notes: owner update` IS affected and FF-23 did not list it. It is
--     `for update using (auth.uid() = user_id)` with no `with check`, so a
--     pastor can reassign one of their own notes to another user_id - writing
--     a private note into someone else's private notes. Different table, same
--     root cause.
--
--
-- SAFE TO RUN TWICE. Every statement is drop-if-exists then create.
-- SAFE TO RUN NOW. Section 2 is wrapped in a transaction, so a failure rolls
-- back rather than leaving a table with its policy dropped and nothing in its
-- place. Per CLAUDE.md rule 8 this project backs nothing public, so there is no
-- maintenance window to schedule.
-- ============================================================


-- ============================================================
-- SECTION 1 - AUDIT (read-only, changes nothing)
--
-- Run this ALONE and paste the output back before running section 2.
--
-- It answers two separate questions:
--   a. which policies are missing `with check`   - what section 2 fixes
--   b. which tables have RLS turned OFF entirely - NOT fixed here, see below
--
-- Question (b) matters more than (a) and I cannot answer it from the repo.
-- Migration 01 enables RLS on exactly eight tables. The generated types list
-- twenty-one. The other thirteen - churches, church_members, church_sections,
-- church_theme, contacts, documents, events, gallery, sermons, staff,
-- support_tickets, templates, videos - predate migration 01, and whether they
-- had RLS enabled when they were created is not recorded anywhere I can read.
--
-- If any of them comes back OFF, that is a bigger hole than FF-23: Supabase
-- grants the anon role table privileges by default, and RLS is the only thing
-- standing between the anon key and the table. `church_members` being OFF would
-- be the worst case - anyone could insert themselves as a pastor of any church.
--
-- I have deliberately NOT enabled RLS on those tables in this file. Turning it
-- on without a matching select policy would silently break the public site,
-- which reads churches and church_sections anonymously by design. Send me the
-- output and I will draft 14 against what is actually there.
-- ============================================================

with t as (
  select c.oid, c.relname::text as tbl, c.relrowsecurity as rls_on
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
)
select
  t.tbl                                    as table_name,
  case when t.rls_on then 'on' else 'OFF' end as rls,
  coalesce(p.polname, '(none)')            as policy_name,
  coalesce(
    case p.polcmd
      when '*' then 'ALL'
      when 'r' then 'select'
      when 'a' then 'insert'
      when 'w' then 'update'
      when 'd' then 'delete'
    end, '-')                              as cmd,
  case when p.polqual      is null then 'no' else 'yes' end as has_using,
  case when p.polwithcheck is null then 'no' else 'yes' end as has_with_check,
  case
    when not t.rls_on
      then '*** RLS OFF - table is exposed to the anon key ***'
    when p.polname is null
      then 'RLS on but no policy - only the service role can touch this'
    when p.polcmd in ('*', 'w') and p.polwithcheck is null
      then '>>> MISSING with check - section 2 fixes this'
    else 'ok'
  end                                      as verdict
from t
left join pg_policy p on p.polrelid = t.oid
order by
  -- problems first, so the interesting rows are at the top of the result pane
  case
    when not t.rls_on                                        then 0
    when p.polcmd in ('*', 'w') and p.polwithcheck is null   then 1
    when p.polname is null                                   then 2
    else 3
  end,
  t.tbl,
  p.polname;


-- ============================================================
-- SECTION 2 - THE FIX
--
-- Seven policies. Each one is dropped and recreated with a `with check` clause
-- character-identical to its `using` clause. No predicate is being changed, no
-- access is being granted or removed - the same people can touch the same rows
-- as before. The only new behaviour is that the row they write must still
-- belong to their church when the write finishes.
-- ============================================================

begin;

-- ---- 1. announcements ----
drop policy if exists "announcements: member write"
  on public.announcements;

create policy "announcements: member write"
  on public.announcements for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = announcements.church_id
        and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = announcements.church_id
        and cm.user_id = auth.uid()
    )
  );


-- ---- 2. prayer_requests ----
-- Note: "prayer_requests: anon submit" (for insert, with check (true)) is
-- untouched and still permits public submissions. This policy is permissive and
-- sits alongside it - a member write still passes via one policy or the other.
drop policy if exists "prayer_requests: member full access"
  on public.prayer_requests;

create policy "prayer_requests: member full access"
  on public.prayer_requests for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = prayer_requests.church_id
        and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = prayer_requests.church_id
        and cm.user_id = auth.uid()
    )
  );


-- ---- 3. groups ----
drop policy if exists "groups: member write"
  on public.groups;

create policy "groups: member write"
  on public.groups for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = groups.church_id
        and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = groups.church_id
        and cm.user_id = auth.uid()
    )
  );


-- ---- 4. ministries ----
drop policy if exists "ministries: member write"
  on public.ministries;

create policy "ministries: member write"
  on public.ministries for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = ministries.church_id
        and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = ministries.church_id
        and cm.user_id = auth.uid()
    )
  );


-- ---- 5. email_lists ----
drop policy if exists "email_lists: member full access"
  on public.email_lists;

create policy "email_lists: member full access"
  on public.email_lists for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = email_lists.church_id
        and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = email_lists.church_id
        and cm.user_id = auth.uid()
    )
  );


-- ---- 6. contact_list_memberships ----
-- This one reaches through email_lists to find the church, so the after image
-- check also stops a member re-pointing a membership row at a list belonging to
-- another church.
drop policy if exists "contact_list_memberships: member full access"
  on public.contact_list_memberships;

create policy "contact_list_memberships: member full access"
  on public.contact_list_memberships for all
  using (
    exists (
      select 1 from public.email_lists el
      join public.church_members cm on cm.church_id = el.church_id
      where el.id = contact_list_memberships.list_id
        and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.email_lists el
      join public.church_members cm on cm.church_id = el.church_id
      where el.id = contact_list_memberships.list_id
        and cm.user_id = auth.uid()
    )
  );


-- ---- 7. pastor_notes: owner update ----
-- The one FF-23 missed. Not a tenant boundary - a user boundary. Without the
-- after image check a pastor can set user_id to another user and file a private
-- note in someone else's notes.
drop policy if exists "pastor_notes: owner update"
  on public.pastor_notes;

create policy "pastor_notes: owner update"
  on public.pastor_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;


-- ============================================================
-- SECTION 3 - VERIFY
--
-- Expect SEVEN rows, every one reading 'fixed'. Anything reading
-- 'STILL MISSING' means that policy did not take - stop and send it back.
-- ============================================================

select
  c.relname::text as table_name,
  p.polname       as policy_name,
  case p.polcmd when '*' then 'ALL' when 'w' then 'update' else p.polcmd::text end as cmd,
  case when p.polwithcheck is null
       then '*** STILL MISSING with check ***'
       else 'fixed'
  end             as verdict
from pg_policy p
join pg_class c     on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and p.polname in (
    'announcements: member write',
    'prayer_requests: member full access',
    'groups: member write',
    'ministries: member write',
    'email_lists: member full access',
    'contact_list_memberships: member full access',
    'pastor_notes: owner update'
  )
order by c.relname, p.polname;
