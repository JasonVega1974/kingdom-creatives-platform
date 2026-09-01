/* ============================================================
   DRAFT 30 - correct the /devotionals hero copy (FF-30)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  RUN 2026-09-01 by Jason. APPLIED.

            Section 3 returned all three booleans true - em_dash_ok,
            no_stale_claim and others_intact - so section 2b was not needed and
            eyebrow, headline and featured_label are untouched.

            THEN VERIFIED AGAINST THE SERVED PAGE, which is the check that
            actually mattered here. The first fetch of /devotionals after the
            SQL ran STILL SHOWED THE OLD LEDE, with X-Vercel-Cache: MISS and
            Age: 0 - a freshly rendered page carrying stale content.

            That is not a fault. getPageSections wraps its read in
            unstable_cache with revalidate: 60. The SQL write bypassed the
            application entirely, so neither updateTag nor revalidatePath fired
            (FF-29, FF-49), and the row was re-read only once the 60 second
            window expired. It corrected itself on the next request.

            Final state on churchfortruckers.org/devotionals:
              new wording present            true
              "straight from the team" gone  true
              "most weekdays" gone           true
              em dash renders                true
              mojibake sequences             0
              today's reading, archive and pager all still rendering

            THE LESSON, worth carrying: after any draft that edits
            church_sections, the served page can lag the database by up to a
            minute. A single fetch immediately afterwards proves nothing.
            Fetch, and if it is stale, fetch again before concluding anything.
   Requires: nothing. Data only - no schema change.

   >>> RUN THE SECTIONS SEPARATELY. Section 1 is the before. <<<

   WHY

   The lede on /devotionals says something that is not true:

     "Written to be read in the time it takes to fill two tanks.
      New ones most weekdays, straight from the team."

   Both halves of the second sentence are wrong as of 2026-09-01. The
   devotionals are SYNDICATED from the YourLife CC project - nobody on the
   church's team writes them - and all 365 already exist, so nothing "arrives"
   weekly. The page went live in commit d868cd9 and has been making that claim
   to visitors since.

   The `empty` string in the same row is also dead:

     "The first devotional posts soon. Check back this week."

   It can never render. The page always has 365 entries, so the empty branch is
   unreachable, and the string sits in the data as a promise that will not be
   kept. Replaced with an honest technical fallback in the tone used elsewhere
   ("Refresh the page - nothing has been lost").

   NOT CHANGED: eyebrow, headline and featured_label are all still accurate.
   The "two tanks" opening is kept - it is the best line in there and it is the
   voice the rest of the site uses.

   ONE THING THE NEW COPY DELIBERATELY DOES NOT CLAIM. It says "a year's worth
   of readings", not "365 devotionals". The archive does hold 365, but the daily
   rotation only ever surfaces the first 60 of them - see FF-30. "A new one
   every day" is true; "365 devotionals, one a day" would not be.

   SAFE TO RUN TWICE. The `||` merge sets fixed literals, so re-running writes
   the same values.
   ============================================================ */


/* ============================================================
   SECTION 1 - BEFORE. Run alone, keep the output.

   Expect one row, with the two strings quoted above.
   ============================================================ */

select s.page_slug,
       s.section_key,
       s.content ->> 'lede'  as lede,
       s.content ->> 'empty' as empty_state
  from public.church_sections s
  join public.churches c on c.id = s.church_id
 where s.id = '02634636-ac58-46b8-93aa-f681a85ae217'
   and c.slug = 'church-for-truckers';


/* ============================================================
   SECTION 2 - THE FIX

   Matched on the row id AND the church slug, page and section. The id alone
   would be enough; the rest is a guard that makes the statement say what it
   means, and makes it impossible for a copied id to touch another church.

   `||` merges the two keys and leaves every other key in the object alone -
   eyebrow, headline and featured_label are untouched.

   NOTE: the lede contains an em dash. If your SQL editor mangles it, use the
   ASCII alternative in section 2b instead and tell Claude, so the codebase
   stops assuming the character survived.
   ============================================================ */

begin;

update public.church_sections s
   set content = s.content || jsonb_build_object(
         'lede',
         'Written to be read in the time it takes to fill two tanks. A new one every day, drawn from a year''s worth of readings — scripture, a thought to chew on, and a prayer.',
         'empty',
         'No devotional loaded. Refresh the page - nothing has been lost.'
       ),
       updated_at = now()
  from public.churches c
 where c.id = s.church_id
   and s.id = '02634636-ac58-46b8-93aa-f681a85ae217'
   and c.slug = 'church-for-truckers'
   and s.page_slug = 'devotionals'
   and s.section_key = 'page_hero';

commit;


/* ============================================================
   SECTION 2b - ONLY IF THE EM DASH DID NOT SURVIVE

   Skip this unless section 3 shows a mangled character. Identical wording with
   a plain hyphen, matching the " - " style the rest of the site's copy uses.
   ============================================================ */

-- begin;
-- update public.church_sections s
--    set content = s.content || jsonb_build_object(
--          'lede',
--          'Written to be read in the time it takes to fill two tanks. A new one every day, drawn from a year''s worth of readings - scripture, a thought to chew on, and a prayer.'
--        ),
--        updated_at = now()
--   from public.churches c
--  where c.id = s.church_id
--    and s.id = '02634636-ac58-46b8-93aa-f681a85ae217'
--    and c.slug = 'church-for-truckers';
-- commit;


/* ============================================================
   SECTION 3 - VERIFY

   Expect:

     lede        Written to be read in the time it takes to fill two tanks.
                 A new one every day, drawn from a year's worth of readings
                 — scripture, a thought to chew on, and a prayer.
     empty_state No devotional loaded. Refresh the page - nothing has been lost.

     em_dash_ok      true   the character survived the round trip
     no_stale_claim  true   "from the team" and "most weekdays" are both gone
     others_intact   true   eyebrow, headline and featured_label unchanged

   If em_dash_ok is false, run section 2b.
   ============================================================ */

select s.content ->> 'lede'  as lede,
       s.content ->> 'empty' as empty_state,
       (s.content ->> 'lede') like '%—%'                     as em_dash_ok,
       (s.content ->> 'lede') not like '%from the team%'
         and (s.content ->> 'lede') not like '%most weekdays%' as no_stale_claim,
       (s.content ->> 'eyebrow')        = 'Devotionals - Five minutes at the pump'
         and (s.content ->> 'headline') = 'Fuel-stop devotionals.'
         and (s.content ->> 'featured_label') = 'Today''s devotional'
                                                              as others_intact
  from public.church_sections s
  join public.churches c on c.id = s.church_id
 where s.id = '02634636-ac58-46b8-93aa-f681a85ae217'
   and c.slug = 'church-for-truckers';
