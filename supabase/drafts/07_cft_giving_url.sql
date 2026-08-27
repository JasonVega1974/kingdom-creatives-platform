-- ============================================================
-- DRAFT 07 - CFT Tithe.ly giving URL
-- Project: cyyxhhwuyeyvewqrhewt
-- Church:  36cb9fdf-4ca1-414f-a206-c3885e07ed5a (church-for-truckers)
-- Status:  NOT RUN. Jason reviews and runs manually.
-- ============================================================
--
-- Data only - no schema change. Fills the placeholder left by
-- migration 01 section 5:
--
--     giving_url  = '',   -- paste Tithe.ly URL when received
--
-- giving_mode is already 'tithely', so nothing else needs to move. Every
-- "Give" button on the public site (home giving_band, /give give_band,
-- header nav) reads churches.giving_url - this row is the single source.
-- No URL is hardcoded anywhere in the app.
--
-- SAFE TO RUN TWICE. It is an idempotent UPDATE of one row, matched by slug.
-- ============================================================

update public.churches
set
  giving_mode = 'tithely',
  giving_url  = 'https://give.tithe.ly/?formId=fbac2b6b-bc31-4b75-a81a-39846f75eff1',
  updated_at  = now()
where slug = 'church-for-truckers';

-- Confirm it landed on exactly one row
select slug, giving_mode, giving_url, updated_at
from public.churches
where slug = 'church-for-truckers';
