/* ============================================================
   DRAFT 32 (Phase 2, Draft B) - add the daily_devotional section for CFT
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Requires: the Phase 2 code DEPLOYED first (the renderer's daily_devotional
             case ships with it - before that deploy this row renders nothing
             in production). Run together with draft 31.

   WHY
   Phase 2 replaces the seeded mile-marker stats with today's devotional as a
   full card in the about grid's right-hand column. The card itself is code
   (components/site/devotionals.tsx, rendered server-side so the 365-entry
   array never ships); THIS row is what turns it on for Church for Truckers.

   MULTI-TENANT NOTE. The layout group lists both keys for that column -
   ["daily_devotional", "mile_stats"] - so a church with only stats still gets
   stats, CFT gets the devotional, and no shared code knows which church chose
   what. This insert is the per-church choice, which is why it is data.

   The sort_order is copied from the church's own mile_stats row so the
   about-grid group anchors at exactly the position it always had; falls back
   to 2 if that row ever disappears.

   The two content labels are pastor-facing wording, seeded here and read with
   fallbacks in code. The section is auto: true in the registry - no text
   boxes in Edit My Website, just the visibility toggle (see FF-45's rule on
   structured sections).

   SAFE TO RUN TWICE. Guarded by NOT EXISTS - a second run inserts nothing.
   ============================================================ */


/* ============================================================
   SECTION 1 - BEFORE. Run alone, keep the output.

   Expect: zero daily_devotional rows, and mile_stats' sort_order (the value
   the new row will take).
   ============================================================ */

select (select count(*) from public.church_sections d
         join public.churches c2 on c2.id = d.church_id
        where c2.slug = 'church-for-truckers'
          and d.page_slug = 'home'
          and d.section_key = 'daily_devotional') as existing_devotional_rows,
       s.sort_order as mile_stats_sort_order
  from public.church_sections s
  join public.churches c on c.id = s.church_id
 where c.slug = 'church-for-truckers'
   and s.page_slug = 'home'
   and s.section_key = 'mile_stats';


/* ============================================================
   SECTION 2 - THE INSERT
   ============================================================ */

begin;

insert into public.church_sections
       (church_id, page_slug, section_key, sort_order, visible, content)
select c.id,
       'home',
       'daily_devotional',
       coalesce((select ms.sort_order
                   from public.church_sections ms
                  where ms.church_id = c.id
                    and ms.page_slug = 'home'
                    and ms.section_key = 'mile_stats'), 2),
       true,
       jsonb_build_object(
         'label', 'Today''s devotional',
         'read_label', 'Read the full devotional'
       )
  from public.churches c
 where c.slug = 'church-for-truckers'
   and not exists (select 1
                     from public.church_sections d
                    where d.church_id = c.id
                      and d.page_slug = 'home'
                      and d.section_key = 'daily_devotional');

commit;


/* ============================================================
   SECTION 3 - VERIFY

   Expect exactly one row: visible = true, sort_order equal to mile_stats'
   from section 1, and both labels present.
   ============================================================ */

select s.section_key,
       s.sort_order,
       s.visible,
       s.content ->> 'label'      as label,
       s.content ->> 'read_label' as read_label
  from public.church_sections s
  join public.churches c on c.id = s.church_id
 where c.slug = 'church-for-truckers'
   and s.page_slug = 'home'
   and s.section_key = 'daily_devotional';
