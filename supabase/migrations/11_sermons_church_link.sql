-- APPLIED 2026-08-28 against project cyyxhhwuyeyvewqrhewt.
-- Moved from supabase/drafts/ after the run. History, not a to-do.
-- Verified composite: sermons_church_link_fkey FOREIGN KEY
-- (church_link_id, church_id) REFERENCES church_links(id, church_id).

-- ============================================================
-- DRAFT 11 - sermons.church_link_id
-- Project:  cyyxhhwuyeyvewqrhewt
-- Status:   APPLIED 2026-08-28.
-- Requires: draft 09 (church_links) to have been run first.
-- Required for: the Sermon Library tab, and the nightly YouTube sync.
-- ============================================================
--
-- THE DECISION (Jason, 2026-08-27)
-- "Which channel did this sermon come from" is answered by a nullable FK to
-- church_links, NOT by a channel enum or a second youtube_channel_id column.
--
--   - reuses the multi-channel model instead of a parallel one
--   - a church with three channels needs no migration
--   - the pastor-facing label ("Preaching", "Bible Studies") comes free from
--     church_links.label - nothing hardcoded, nothing to keep in sync
--   - nullable, so a manually added sermon, or one predating channel setup,
--     is never blocked
--
-- NOT TOUCHED: sermons.youtube_id, which is the VIDEO id. This column is the
-- CHANNEL it came from. Different facts, both needed.
--
-- SAFE TO RUN TWICE. Every step is guarded.
-- ============================================================


-- ------------------------------------------------------------
-- 0. PRECONDITIONS - stop with a readable message, not a cascade of errors
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.church_links') is null then
    raise exception
      'church_links does not exist. Run draft 09 first, then re-run this file.';
  end if;

  -- Section 2 uses the ON DELETE SET NULL column list, which is Postgres 15+.
  if current_setting('server_version_num')::int < 150000 then
    raise exception
      'Postgres 15+ required for ON DELETE SET NULL (col). Server is %. See the note in section 2.',
      current_setting('server_version');
  end if;
end
$$;


-- ------------------------------------------------------------
-- 1. THE COLUMN
-- ------------------------------------------------------------
alter table public.sermons
  add column if not exists church_link_id uuid;


-- ------------------------------------------------------------
-- 2. THE FOREIGN KEY - deliberately composite
--
-- A plain `references church_links(id)` would let a sermon point at ANOTHER
-- church's channel row. RLS does not catch that: both the sermon and the link
-- pass their own church's policy, and the mismatch only shows up as one
-- church's sermon labelled with another church's channel name.
--
-- Referencing (id, church_id) instead makes the tenant part of the key, so the
-- database refuses the cross-tenant row outright. It needs a unique index on
-- church_links (id, church_id) to point at - redundant against the primary key
-- by definition, which is exactly why it is free.
--
-- ON DELETE SET NULL (church_link_id) names the column on purpose: the plain
-- form would try to null church_id too, and that column is NOT NULL. Deleting
-- a channel must orphan its sermons, never delete them. Postgres 15+ only -
-- guarded in section 0. If that guard ever fires, the fallback is
-- ON DELETE NO ACTION plus an explicit "unlink these sermons first" step in
-- the portal, which is worse UX but works everywhere.
-- ------------------------------------------------------------
create unique index if not exists church_links_id_church_uidx
  on public.church_links (id, church_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.sermons'::regclass
       and conname  = 'sermons_church_link_fkey'
  ) then
    alter table public.sermons
      add constraint sermons_church_link_fkey
      foreign key (church_link_id, church_id)
      references public.church_links (id, church_id)
      on delete set null (church_link_id);
  end if;
end
$$;


-- ------------------------------------------------------------
-- 3. INDEX - "every sermon from this channel, newest first"
--
-- Partial: the majority of rows will be null while channels are being set up,
-- and a null church_link_id is never a search term.
-- ------------------------------------------------------------
create index if not exists sermons_church_link_idx
  on public.sermons (church_link_id, preached_at desc)
  where church_link_id is not null;


-- ------------------------------------------------------------
-- 4. CONFIRM
-- ------------------------------------------------------------
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'sermons'
   and column_name  = 'church_link_id';

select conname as constraint_name,
       pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.sermons'::regclass
   and contype  = 'f'
 order by conname;

-- Expect 0 rows. Any row here is a sermon pointing at a channel that belongs
-- to a different church - impossible once the FK above exists, so this is a
-- check that the constraint really took.
select s.id as sermon_id, s.church_id as sermon_church, l.church_id as link_church
  from public.sermons s
  join public.church_links l on l.id = s.church_link_id
 where l.church_id <> s.church_id;
