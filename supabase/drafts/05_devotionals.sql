-- ============================================================
-- DRAFT 05 - devotionals table
-- Project: cyyxhhwuyeyvewqrhewt
-- Status: NOT RUN. Jason reviews and runs manually.
-- ============================================================
--
-- Resolves ADDENDUM_01 decision B2 = "pastor-authored per church".
-- Migration 01 deliberately did NOT create this table while B2 was open;
-- `sermons.devotional` (text) has been the stopgap. This is the real table.
--
-- Blocks Phase B step 7 (/devotionals and /devotionals/[id]). Every other
-- Phase B page is independent of it.
--
-- Column set follows ADDENDUM_01 section C item 2. Two deliberate deviations,
-- both flagged so you can strike them before running:
--
--   1. `source` - ADDENDUM_01 section D recommends designing the schema so a
--      future YourLife CC syndication feed can be marked without a migration.
--      Defaults to 'church'; nothing reads it in Phase B.
--   2. `excerpt` - the prototype's devotional cards show a one-line blurb.
--      Nullable; the app falls back to deriving one from `body` when it is
--      empty, so leaving it null is fine forever.
--
-- Deliberately NOT included:
--   - `slug`  - ADDENDUM_01's sitemap routes /devotionals/[id], so id is the key
--   - `read_minutes` - derived from body word count at render time, so no
--     pastor has to fill in a number that a computer can count
--   - `sort_order` - ordering is published_at desc; a manual order column
--     would be a second source of truth for the same thing
--
-- RLS mirrors public.announcements and public.groups exactly (anon read
-- visible, church_members full write), with ONE addition called out below.

begin;

create table if not exists public.devotionals (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,
  title         text not null,
  body          text not null,
  excerpt       text,
  scripture_ref text,
  author_name   text,
  source        text not null default 'church',
  published_at  timestamp with time zone,
  visible       boolean not null default true,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

comment on column public.devotionals.source is
  'church | syndicated - reserved for a future YourLife CC feed (ADDENDUM_01 D/B2)';
comment on column public.devotionals.published_at is
  'null = draft. Public reads require a non-null value at or before now().';
comment on column public.devotionals.excerpt is
  'Optional card blurb. When null the app derives one from body.';

-- index the exact shape of the two public queries:
--   index page  - church_id + visible + published_at desc
--   detail page - primary key, already indexed
create index if not exists idx_devotionals_public
  on public.devotionals (church_id, published_at desc)
  where visible = true;

alter table public.devotionals enable row level security;


-- ---- devotionals: anon read published, members write ----
-- Mirrors "announcements: anon read visible" / "groups: anon read visible",
-- with one ADDITION: the published_at guard.
--
-- The sibling tables gate on `visible` alone because they have no scheduling
-- concept. This table does. Without the guard, a devotional written on Monday
-- and dated Friday is already readable through the anon REST endpoint on
-- Monday - not visible on the site, but fetchable by anyone who asks for it.
-- Strike the published_at lines if you would rather keep strict parity with
-- the other tables and filter in the query instead.
drop policy if exists "devotionals: anon read published"
  on public.devotionals;

create policy "devotionals: anon read published"
  on public.devotionals for select
  using (
    visible = true
    and published_at is not null
    and published_at <= now()
  );

drop policy if exists "devotionals: member write"
  on public.devotionals;

create policy "devotionals: member write"
  on public.devotionals for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = devotionals.church_id
        and cm.user_id = auth.uid()
    )
  );

commit;


-- ============================================================
-- VERIFY - run after commit, paste the output back
-- ============================================================
-- Expect: 11 columns, rowsecurity = true, 2 policies.
--
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'devotionals'
--  order by ordinal_position;
--
-- select relrowsecurity from pg_class where oid = 'public.devotionals'::regclass;
--
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'devotionals'
--  order by policyname;
