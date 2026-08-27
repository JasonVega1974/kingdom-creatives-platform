-- APPLIED 2026-08-27 against project cyyxhhwuyeyvewqrhewt.
-- Moved from supabase/drafts/ after the run. History, not a to-do.

-- ============================================================
-- DRAFT 08 - widen the church_sections unique constraint
-- Project: cyyxhhwuyeyvewqrhewt
-- Status:  APPLIED 2026-08-27.
-- Unblocks: draft 04 (CFT sections seed), all of Phase B and Phase C.
-- ============================================================
--
-- THE BUG
-- Draft 04 failed with a duplicate key on
-- `church_sections_church_id_section_key_key`. That constraint is
-- UNIQUE (church_id, section_key) - it predates ADDENDUM_01, which added the
-- page dimension, and was never widened when migration 01 added page_slug.
--
-- So the table permits exactly ONE `page_hero` per church. Draft 04 seeds
-- `page_hero` on ten different pages. This is a schema problem, not stale
-- data: deleting rows would not change it.
--
-- THE FIX
-- Widen to UNIQUE (church_id, page_slug, section_key). One section key per
-- page per church, which is what the multi-page design has always meant.
--
-- SAFE TO RUN TWICE. Every step is guarded. It does not delete a single row.
-- Section 1 prints the before-state, section 2 changes it, section 3 prints
-- the after-state - paste all three back.
-- ============================================================


-- ------------------------------------------------------------
-- 1. BEFORE - what is on the table right now
-- ------------------------------------------------------------
select 'BEFORE' as phase,
       conname  as constraint_name,
       pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.church_sections'::regclass
   and contype in ('u', 'p')
 order by conname;


-- ------------------------------------------------------------
-- 2. THE CHANGE
--
-- Drops any UNIQUE constraint whose column list is exactly
-- (church_id, section_key) - matched by shape, not by name, because the
-- generated name is not guaranteed. A constraint that already includes
-- page_slug is left alone.
-- ------------------------------------------------------------
do $$
declare
  target        text;
  narrow_cols   int;
  page_slug_att int;
begin
  select attnum into page_slug_att
    from pg_attribute
   where attrelid = 'public.church_sections'::regclass
     and attname  = 'page_slug'
     and not attisdropped;

  if page_slug_att is null then
    raise exception
      'church_sections.page_slug does not exist - migration 01 did not apply. Stop here.';
  end if;

  for target, narrow_cols in
    select c.conname, array_length(c.conkey, 1)
      from pg_constraint c
     where c.conrelid = 'public.church_sections'::regclass
       and c.contype  = 'u'
       and not (page_slug_att = any (c.conkey))
  loop
    -- Only the (church_id, section_key) pair, nothing wider or narrower.
    if narrow_cols = 2 then
      raise notice 'dropping narrow unique constraint: %', target;
      execute format(
        'alter table public.church_sections drop constraint %I', target);
    else
      raise notice 'leaving constraint alone (% cols): %', narrow_cols, target;
    end if;
  end loop;
end
$$;

-- The widened constraint. `if not exists` on the index, then adopt it as a
-- constraint, so a re-run is a no-op rather than an error.
create unique index if not exists church_sections_church_page_key_uidx
  on public.church_sections (church_id, page_slug, section_key);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.church_sections'::regclass
       and conname  = 'church_sections_church_page_key_uniq'
  ) then
    alter table public.church_sections
      add constraint church_sections_church_page_key_uniq
      unique using index church_sections_church_page_key_uidx;
  end if;
end
$$;


-- ------------------------------------------------------------
-- 3. AFTER - confirm the new shape, and that nothing was lost
-- ------------------------------------------------------------
select 'AFTER' as phase,
       conname as constraint_name,
       pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.church_sections'::regclass
   and contype in ('u', 'p')
 order by conname;

select 'ROW COUNT' as phase, count(*) as rows
  from public.church_sections;
