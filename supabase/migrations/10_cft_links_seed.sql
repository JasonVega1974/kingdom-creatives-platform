-- APPLIED 2026-08-27 against project cyyxhhwuyeyvewqrhewt.
-- Moved from supabase/drafts/ after the run. History, not a to-do.

-- ============================================================
-- DRAFT 10 - Church for Truckers links seed
-- Project: cyyxhhwuyeyvewqrhewt
-- Church:  church-for-truckers
-- Status:  APPLIED 2026-08-27.
-- Requires: draft 09 (church_links) to have been run first.
-- ============================================================
--
-- Data provided by the pastor. Data only - no schema change.
--
-- NOTE ON THE FACEBOOK LINK: it is a GROUP, not a Page. Facebook exposes no
-- public feed embed for groups, so the public site treats this as link-out
-- only. Do not build a feed widget against it.
--
-- SAFE TO RUN TWICE. Each row is inserted only if no row with the same
-- (church_id, kind, url) already exists, so a re-run adds nothing and a link
-- the pastor has since edited in the portal is not clobbered.
-- ============================================================

with cft as (
  select id from public.churches where slug = 'church-for-truckers'
),
incoming (kind, platform, label, url, external_id, sort_order, is_primary) as (
  values
    -- ---- video ----
    ('video',  'youtube',  'Preaching',
     'https://youtube.com/@churchfortruckers',   '@churchfortruckers',  0, true),
    ('video',  'youtube',  'Bible Studies',
     'https://youtube.com/@truckersbiblestudy',  '@truckersbiblestudy', 1, false),

    -- ---- social ----
    ('social', 'facebook', 'Facebook Group',
     'https://www.facebook.com/share/g/1DWogJsdjF/', null,              0, true),

    -- ---- giving ----
    ('giving', 'tithely',  'Give',
     'https://give.tithe.ly/?formId=fbac2b6b-bc31-4b75-a81a-39846f75eff1',
     'fbac2b6b-bc31-4b75-a81a-39846f75eff1',                            0, true)
)
insert into public.church_links
  (church_id, kind, platform, label, url, external_id, sort_order, is_primary)
select cft.id, i.kind, i.platform, i.label, i.url, i.external_id, i.sort_order, i.is_primary
  from incoming i
 cross join cft
 where not exists (
   select 1 from public.church_links existing
    where existing.church_id = cft.id
      and existing.kind      = i.kind
      and existing.url       = i.url
 );


-- ------------------------------------------------------------
-- CONFIRM - expect 4 rows, one primary per kind
-- ------------------------------------------------------------
select l.kind, l.platform, l.label, l.url, l.external_id, l.sort_order, l.is_primary
  from public.church_links l
  join public.churches c on c.id = l.church_id
 where c.slug = 'church-for-truckers'
 order by l.kind, l.sort_order;
