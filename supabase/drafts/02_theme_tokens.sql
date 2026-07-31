-- ============================================================
-- DRAFT 02 - church_theme token expansion (OPTIONAL)
-- Project: cyyxhhwuyeyvewqrhewt
-- Status: NOT RUN. Jason reviews and runs manually.
-- ============================================================
--
-- NOT required for Phase A, Phase B or Phase C. Only run this if a church
-- needs a look the current three colour columns cannot express.
--
-- Today church_theme stores color_primary, color_secondary, color_accent,
-- font_heading, font_body, logo_url. lib/theme.ts derives the brand ramp with
-- CSS color-mix and uses platform-wide constants for the neutral ramp
-- (paper / paper-dim / surface / ink / ink-soft / line).
--
-- That is a deliberate v1 simplification: one colour picker in the portal's
-- Theme tab produces a coherent site, and a pastor cannot accidentally make
-- their own body text unreadable. The cost is that every church shares the
-- same warm off-white paper, and derived shades land near - not exactly on -
-- a hand-picked palette.
--
-- Run this when either of those becomes a real constraint. All columns are
-- nullable: null means "keep deriving it", so existing churches are unaffected
-- and lib/theme.ts can adopt the columns one at a time.

alter table public.church_theme
  -- exact brand ramp (overrides the color-mix derivation)
  add column if not exists color_brand_deep  text,
  add column if not exists color_brand_night text,
  add column if not exists color_brand_soft  text,
  -- neutral ramp
  add column if not exists color_paper       text,
  add column if not exists color_paper_dim   text,
  add column if not exists color_surface     text,
  add column if not exists color_ink         text,
  add column if not exists color_ink_soft    text,
  add column if not exists color_line        text,
  -- shape
  add column if not exists radius_px         integer,
  -- BUILD_BRIEF section 4: the arched hero treatment, per-church opt-out
  add column if not exists hero_arch         boolean not null default true;

comment on column public.church_theme.color_brand_deep is
  'Exact hover/active shade. Null = derive from color_primary via color-mix.';
comment on column public.church_theme.color_paper is
  'Page background. Null = platform default #FAF7F0.';
comment on column public.church_theme.hero_arch is
  'False disables the arched hero clip-path; hero degrades to a rectangle.';

-- Confirm - paste this result back to Claude.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'church_theme'
order by ordinal_position;

-- ============================================================
-- AFTER RUNNING
-- 1. npm run types  (regenerates types/database.ts from the live schema)
-- 2. lib/theme.ts: prefer the stored value, fall back to the derivation.
--    The token names already match, so it is one `??` per token.
-- ============================================================
