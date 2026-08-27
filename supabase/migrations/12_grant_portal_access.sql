-- APPLIED 2026-08-27 against project cyyxhhwuyeyvewqrhewt.
-- Moved from supabase/drafts/ after the run. History, not a to-do.

-- ============================================================
-- DRAFT 12 - grant yourself Pastor Portal access
-- Project: cyyxhhwuyeyvewqrhewt
-- Status:  APPLIED 2026-08-27.
-- Required for: logging into the portal at all.
-- ============================================================
--
-- WHY YOU NEED THIS
-- There is no signup flow yet, by design - a church portal is not something
-- strangers register for. `requirePortalUser()` asks two questions: is there a
-- verified session, and is that user in `church_members` for THIS church. A
-- valid Supabase login with no membership row lands on /portal/no-access, which
-- looks exactly like a bug if you are not expecting it.
--
-- BEFORE RUNNING THIS
-- Create the auth user first, in the Supabase dashboard:
--   Authentication -> Users -> Add user -> Create new user
--   Email:    jasonvega1974@gmail.com  (or whichever address you sign in as)
--   Password: set one
--   Tick "Auto Confirm User"
--
-- The auto-confirm matters. An unconfirmed user cannot sign in with a password,
-- and the login screen deliberately does not distinguish that case from a wrong
-- password - so it would just say the details do not match.
--
-- >>> CHANGE THE EMAIL IN TWO PLACES BELOW (sections 1 and 2) <<<
-- Written as plain literals on purpose: psql variables (\set) are a psql
-- meta-command and do nothing in the Supabase SQL editor.
--
-- SAFE TO RUN TWICE. Guarded by NOT EXISTS on (church_id, user_id).
-- ============================================================


-- ------------------------------------------------------------
-- 1. PRECHECK - confirm both pieces exist before writing anything.
--    Expect exactly two rows.
-- ------------------------------------------------------------
select 'auth user' as thing,
       u.id::text  as id,
       case when u.email_confirmed_at is null
            then 'NOT CONFIRMED - password login will fail, fix in the dashboard'
            else 'confirmed'
       end as note
  from auth.users u
 where u.email = 'jasonvega1974@gmail.com'   -- <<< EMAIL (1 of 2)

union all

select 'church', c.id::text, coalesce(c.name, '(no name yet)')
  from public.churches c
 where c.slug = 'church-for-truckers';

-- If the "auth user" row is missing, stop and create it in the dashboard.
-- This file does not create auth users - password hashing is Supabase's job,
-- not something to hand-roll in SQL.


-- ------------------------------------------------------------
-- 2. THE MEMBERSHIP ROW, then confirm it in one statement.
--
-- role is 'pastor'. Nothing enforces roles yet - every migration 01 policy
-- checks membership, not role - so this is a label for later, not a permission
-- today. See docs/PORTAL_SPEC.md open question 3.
-- ------------------------------------------------------------
with target as (
  select c.id as church_id, u.id as user_id
    from public.churches c
    cross join auth.users u
   where c.slug  = 'church-for-truckers'
     and u.email = 'jasonvega1974@gmail.com'  -- <<< EMAIL (2 of 2)
),
inserted as (
  insert into public.church_members (church_id, user_id, role, approved_at, approved_by)
  select t.church_id, t.user_id, 'pastor', now(), t.user_id
    from target t
   where not exists (
     select 1 from public.church_members m
      where m.church_id = t.church_id
        and m.user_id   = t.user_id
   )
  returning 1
)
select (select count(*) from inserted) as rows_inserted,
       (select count(*) from target)   as target_matched;

-- rows_inserted = 1, target_matched = 1  -> access granted.
-- rows_inserted = 0, target_matched = 1  -> already had access. Fine.
-- target_matched = 0                     -> the email or slug did not match.
--                                           Nothing was written. Recheck section 1.


-- ------------------------------------------------------------
-- 3. CONFIRM - everyone who can sign into the CFT portal
-- ------------------------------------------------------------
select u.email, c.slug as church, m.role, m.approved_at
  from public.church_members m
  join public.churches c on c.id = m.church_id
  join auth.users     u on u.id = m.user_id
 where c.slug = 'church-for-truckers'
 order by u.email;
