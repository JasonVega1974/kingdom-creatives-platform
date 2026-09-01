/* ============================================================
   DRAFT 29 - put the YouTube CHANNEL ID in church_links.external_id
   Project: cyyxhhwuyeyvewqrhewt
   Status:  RUN 2026-09-01 by Jason. APPLIED.

            Section 3 confirmed both rows: external_id holds the UC... ids,
            usable_by_the_api = true for both, and url still holds the handle
            links as intended.

              Preaching      UCvn51ekTkysjT-yhuLRG2xg
              Bible Studies  UCpBsbEYujr_gIEme3kgItWw

            Verified end to end afterwards, not just by the query: /sermons
            went from 6 cards (the database alone) to 48 - 24 from each
            channel - with both channel tabs rendering and curated rows still
            winning where they exist.

            NOTE ON TIMING. For up to 60 seconds after this ran the site still
            showed the old six, because getChurchLinks caches for 60s and the
            page was still seeing @handles. Not a fault; expected, and worth
            not panicking about next time.
   Requires: nothing. Data only - no schema change.

   >>> RUN THE SECTIONS SEPARATELY. Section 1 is the before. <<<

   WHY
   The two `kind = 'video'` rows carry an @handle in external_id:

     Preaching      @churchfortruckers
     Bible Studies  @truckersbiblestudy

   A handle is a display name and YouTube lets it be changed. The channel ID is
   permanent and is what the Data API accepts - channels.list?id= takes a UC...
   id, not a handle. Two spellings of one channel is also exactly the "two
   sources of truth" problem this change exists to remove.

   The `url` column keeps the handle URL, because that is the human-facing link
   the footer and the Worship page already render and it reads better than
   /channel/UCvn51... So: url stays human, external_id becomes canonical.

   THE IDS WERE VERIFIED, NOT ASSUMED
   Fetched from YouTube on 2026-09-01 and confirmed by TWO independent fields
   agreeing on each channel page - "externalId" in the embedded metadata and
   the <link rel="canonical"> href:

     @churchfortruckers    -> UCvn51ekTkysjT-yhuLRG2xg   "Church for Truckers"
     @truckersbiblestudy   -> UCpBsbEYujr_gIEme3kgItWw   "CHURCH for Truckers
                                                          Bible Study"

   These match the two ids Jason supplied.

   UNTIL THIS RUNS, THE FEED STAYS OFF. sermonChannels() in lib/sermon-feed.ts
   accepts only external_ids beginning "UC", so rows holding a handle are
   skipped rather than sent to the API - a handle would 400 on every request.
   With no usable channels the site falls back to the sermons table, which is
   exactly what it shows today. Running this is what switches the feed on.

   SAFE TO RUN TWICE. Sets fixed literals matched on url; re-running writes the
   same values.
   ============================================================ */


/* ============================================================
   SECTION 1 - BEFORE. Run alone, keep the output.

   Expect two rows, both external_id starting with '@'.
   ============================================================ */

select l.label,
       l.platform,
       l.url,
       l.external_id
  from public.church_links l
  join public.churches c on c.id = l.church_id
 where c.slug = 'church-for-truckers'
   and l.kind = 'video'
 order by l.sort_order;


/* ============================================================
   SECTION 2 - THE FIX

   Matched on url rather than on label or sort_order: a label is
   pastor-editable and a sort order is reorderable, but the url identifies
   which channel the row is actually for.
   ============================================================ */

begin;

update public.church_links l
   set external_id = 'UCvn51ekTkysjT-yhuLRG2xg',
       updated_at  = now()
  from public.churches c
 where c.id = l.church_id
   and c.slug = 'church-for-truckers'
   and l.kind = 'video'
   and l.url like '%@churchfortruckers%';

update public.church_links l
   set external_id = 'UCpBsbEYujr_gIEme3kgItWw',
       updated_at  = now()
  from public.churches c
 where c.id = l.church_id
   and c.slug = 'church-for-truckers'
   and l.kind = 'video'
   and l.url like '%@truckersbiblestudy%';

commit;


/* ============================================================
   SECTION 3 - VERIFY

   Expect exactly:

     Preaching       https://youtube.com/@churchfortruckers    UCvn51ekTkysjT-yhuLRG2xg
     Bible Studies   https://youtube.com/@truckersbiblestudy   UCpBsbEYujr_gIEme3kgItWw

   A row still showing an '@' handle means its UPDATE matched nothing - check
   the url in section 1's output against the LIKE patterns above.
   ============================================================ */

select l.label,
       l.url,
       l.external_id,
       l.external_id like 'UC%' as usable_by_the_api
  from public.church_links l
  join public.churches c on c.id = l.church_id
 where c.slug = 'church-for-truckers'
   and l.kind = 'video'
 order by l.sort_order;
