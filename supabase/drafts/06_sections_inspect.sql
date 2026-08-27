-- ============================================================
-- DRAFT 06 - church_sections diagnostics (READ ONLY)
-- Project: cyyxhhwuyeyvewqrhewt
-- Church:  36cb9fdf-4ca1-414f-a206-c3885e07ed5a (church-for-truckers)
-- Status:  SELECT statements only. Nothing here writes, deletes or alters.
-- ============================================================
--
-- WHY: draft 04 failed with a duplicate key on (church_id, section_key).
-- That points at a unique constraint on those two columns that does NOT
-- include page_slug - almost certainly created before ADDENDUM_01 added the
-- page dimension, and never widened when migration 01 added the column.
--
-- If that is what Q1 shows, the multi-page design is blocked at the schema
-- level, not by stale data: draft 04 seeds `page_hero` on ten different pages
-- and the constraint permits exactly one per church. Deleting rows would not
-- change that. The fix is to widen the constraint to include page_slug, which
-- is a schema change - it gets drafted separately once these results are in.
--
-- Run all five. Paste the output back. Nothing is decided until then.

-- ------------------------------------------------------------
-- Q1. THE ANSWER. Constraints and indexes on church_sections.
--     Look for a UNIQUE on (church_id, section_key) with no page_slug.
-- ------------------------------------------------------------
select conname            as constraint_name,
       contype            as kind,          -- p = primary key, u = unique, f = fk
       pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.church_sections'::regclass
 order by contype, conname;

select indexname,
       indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename  = 'church_sections'
 order by indexname;


-- ------------------------------------------------------------
-- Q2. Every existing row for CFT, in render order.
--     This is the "show me what is there before deleting anything" list.
-- ------------------------------------------------------------
select id,
       page_slug,
       section_key,
       sort_order,
       visible,
       jsonb_typeof(content)        as content_kind,
       length(content::text)        as content_bytes,
       left(content::text, 160)     as content_preview,
       updated_at,
       updated_by
  from public.church_sections
 where church_id = '36cb9fdf-4ca1-414f-a206-c3885e07ed5a'
 order by page_slug, sort_order, section_key;


-- ------------------------------------------------------------
-- Q3. Shape summary - how many rows, on which pages.
--     Before draft 04 runs this should be small. If page_slug is 'home'
--     for everything, these rows predate the page dimension.
-- ------------------------------------------------------------
select page_slug,
       count(*)                     as rows,
       min(sort_order)              as min_sort,
       max(sort_order)              as max_sort
  from public.church_sections
 where church_id = '36cb9fdf-4ca1-414f-a206-c3885e07ed5a'
 group by page_slug
 order by page_slug;


-- ------------------------------------------------------------
-- Q4. Does any OTHER church have sections?
--     Widening a constraint affects every tenant, not just CFT. If this
--     returns only CFT the change is low risk; if not, say so before we act.
-- ------------------------------------------------------------
select church_id,
       count(*) as rows,
       count(distinct page_slug) as pages
  from public.church_sections
 group by church_id
 order by rows desc;


-- ------------------------------------------------------------
-- Q5. Which existing section_key values collide with draft 04.
--     Any row listed here is one draft 04 would have to work around,
--     independent of the constraint question.
-- ------------------------------------------------------------
select e.page_slug,
       e.section_key,
       e.sort_order,
       e.updated_at
  from public.church_sections e
 where e.church_id = '36cb9fdf-4ca1-414f-a206-c3885e07ed5a'
   and e.section_key in (
     'hero','about_strip','mile_stats','latest_sermon','events_preview',
     'bulletin','get_connected','giving_band','page_hero','expect','faq',
     'visit_form','timeline','beliefs','ministries_intro','about_ctas',
     'group_filters','event_filters','worship_filters','reader',
     'verse_of_day','reading_plan','ylcc_bridge','give_band','other_ways'
   )
 order by e.page_slug, e.section_key;
