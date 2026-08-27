-- APPLIED 2026-08-27 against project cyyxhhwuyeyvewqrhewt.
-- Moved from supabase/drafts/ after the run. History, not a to-do.

-- ============================================================
-- DRAFT 09 - church_links
-- Project: cyyxhhwuyeyvewqrhewt
-- Status:  APPLIED 2026-08-27.
-- Required for: portal "Social & Video" and "Giving" tabs; public site
--               header/footer social row and every Give button.
-- ============================================================
--
-- WHY THIS TABLE EXISTS
-- `churches` carries `youtube_channel_id` and `giving_url` as single values.
-- Church for Truckers has TWO YouTube channels on day one (@churchfortruckers
-- for preaching, @truckersbiblestudy for studies), so the single column is
-- already wrong for the first tenant. Socials have no home at all today.
--
-- Shape is {kind, platform, url} deliberately - never `tithely_form_id`.
-- The next church uses Givelify, and that must not be a migration.
--
-- WHAT THIS DOES NOT DO
-- It does not drop churches.youtube_channel_id or churches.giving_url. Phase B
-- code reads them today and would break. They become derived - the row with
-- is_primary = true wins - and are dropped in a later migration once nothing
-- reads them. Two sources for one fact is exactly the pp_primary_color bug, so
-- this is a deliberate, time-boxed overlap, not a permanent one. See
-- docs/PORTAL_SPEC.md "Deprecation path".
--
-- SAFE TO RUN TWICE.
-- ============================================================


-- ------------------------------------------------------------
-- 1. TABLE
-- ------------------------------------------------------------
create table if not exists public.church_links (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,

  -- What the link is for. Drives which portal tab edits it and where the
  -- public site renders it.
  kind        text not null check (kind in ('social', 'video', 'giving')),

  -- Who hosts it. Free text on purpose: a new platform is a data change,
  -- not a migration. The portal offers a picker of known values.
  platform    text not null,

  -- Pastor-facing name. This is what a driver sees on the website too:
  -- "Sunday Preaching", "Bible Study", "Give".
  label       text not null,

  url         text not null,

  -- Channel handle, playlist id, Tithe.ly formId. Nullable - most links
  -- are just a URL, and the ones that are not differ per platform.
  external_id text,

  sort_order  int  not null default 0,

  -- "The" church YouTube / "the" Give button, when something can only show
  -- one. Enforced to at most one per (church_id, kind) by the index below.
  is_primary  boolean not null default false,

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);


-- ------------------------------------------------------------
-- 2. INDEXES
-- ------------------------------------------------------------

-- Render order lookup: "every video link for this church, in order".
create index if not exists church_links_church_kind_idx
  on public.church_links (church_id, kind, sort_order);

-- At most one primary per kind. Partial, so the many non-primary rows
-- do not collide with each other.
create unique index if not exists church_links_one_primary_per_kind_uidx
  on public.church_links (church_id, kind)
  where is_primary;


-- ------------------------------------------------------------
-- 3. RLS
--
-- Same shape as the migration 01 policies, with one correction: those were
-- written with `using` only. A `for all` policy without `with check` lets a
-- member UPDATE a row's church_id to a church they do not belong to, moving
-- the row out of their tenant. Both clauses are present here. Migration 01's
-- policies need the same fix - tracked as a fast-follow, not done in this
-- file, because it touches eight unrelated tables.
-- ------------------------------------------------------------
alter table public.church_links enable row level security;

-- Public: these links are rendered on the public site by design.
drop policy if exists "church_links: anon read" on public.church_links;
create policy "church_links: anon read"
  on public.church_links for select
  using (true);

drop policy if exists "church_links: member write" on public.church_links;
create policy "church_links: member write"
  on public.church_links for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = church_links.church_id
        and cm.user_id   = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = church_links.church_id
        and cm.user_id   = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- 4. CONFIRM
-- ------------------------------------------------------------
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'church_links'
 order by ordinal_position;

select policyname, cmd,
       qual       is not null as has_using,
       with_check is not null as has_check
  from pg_policies
 where schemaname = 'public' and tablename = 'church_links'
 order by policyname;
