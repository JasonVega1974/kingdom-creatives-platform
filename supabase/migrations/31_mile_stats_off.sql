/* ============================================================
   DRAFT 31 (Phase 2, Draft A) - switch off the mile-marker stats for CFT
   Project: cyyxhhwuyeyvewqrhewt
   Status:  RUN 2026-09-01 by Jason. APPLIED.

            Verified on churchfortruckers.org after the run: no data-mm
            markers anywhere on the served home page - the four seeded stats
            are gone, content untouched (this was a switch, not a deletion).
   Requires: nothing by itself, but run it TOGETHER WITH draft 32, AFTER the
             Phase 2 code deploys - see ORDERING below.

   >>> RUN THE SECTIONS SEPARATELY. Section 1 is the before. <<<

   WHY
   The home page's four mile-marker stats are seeded prototype numbers, not
   facts about this church:

     38 states with members on the road this week
     24/7 prayer line answered by real people
     11 phone-based small groups across 4 time zones
     6 yrs of Sundays without missing a broadcast

   Nobody has 38 states of members or 11 phone groups; the groups table has
   zero rows. These are false claims on a live church site - the same class of
   problem as the devotionals hero copy fixed in migration 30.

   The section TYPE stays in the registry and the renderer, and this row keeps
   its content: another church with real numbers can use mile_stats, and CFT
   can switch it back on in Edit My Website if real numbers ever exist. This
   draft only flips visible - it deletes nothing.

   ORDERING
   Run with draft 32 immediately after the Phase 2 deploy. The about-grid's
   right column renders daily_devotional first and mile_stats behind it, so:
     - both drafts run  -> devotional card shows, stats gone      (the goal)
     - only 31 runs     -> right column briefly empty             (avoid)
     - neither runs yet -> stats keep showing, no breakage        (current)

   SAFE TO RUN TWICE. Sets a fixed literal.
   ============================================================ */


/* ============================================================
   SECTION 1 - BEFORE. Run alone, keep the output.

   Expect one row, visible = true, with the seeded items in content.
   ============================================================ */

select s.id,
       s.sort_order,
       s.visible,
       jsonb_array_length(s.content -> 'items') as seeded_stat_count
  from public.church_sections s
  join public.churches c on c.id = s.church_id
 where c.slug = 'church-for-truckers'
   and s.page_slug = 'home'
   and s.section_key = 'mile_stats';


/* ============================================================
   SECTION 2 - THE FIX
   ============================================================ */

begin;

update public.church_sections s
   set visible = false,
       updated_at = now()
  from public.churches c
 where c.id = s.church_id
   and c.slug = 'church-for-truckers'
   and s.page_slug = 'home'
   and s.section_key = 'mile_stats';

commit;


/* ============================================================
   SECTION 3 - VERIFY

   Expect: visible = false, seeded_stat_count unchanged (content untouched -
   this is a switch, not a deletion).
   ============================================================ */

select s.visible,
       jsonb_array_length(s.content -> 'items') as seeded_stat_count,
       s.updated_at
  from public.church_sections s
  join public.churches c on c.id = s.church_id
 where c.slug = 'church-for-truckers'
   and s.page_slug = 'home'
   and s.section_key = 'mile_stats';
