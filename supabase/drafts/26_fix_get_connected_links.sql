/* ============================================================
   DRAFT 26 - fix two of the three "Three ways in" links (FF-46)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Requires: nothing. Data only - no schema change.

   >>> RUN THE SECTIONS SEPARATELY. Section 1 is the before/after. <<<

   WHAT IS WRONG
   The three cards under "Three ways in" on the home page carry their hrefs in
   church_sections.content, not in code, so this is a data fix. Seeded by draft
   04, they point at:

     Find your convoy  (Groups & Bible Studies)  ->  /groups   CORRECT
     Where gifts go    (Ministries we support)   ->  /about    right page, top
     Add a request     (Prayer wall)             ->  /visit    WRONG PAGE

   `/visit` holds page_hero, expect, faq and visit_form. There is no prayer
   wall on it and never was. The prayer wall is the `bulletin` section on the
   HOME page - the same page the card sits on. A visitor clicking "Add a
   request" lands on the Plan-a-Visit form instead, which is a different form
   asking for different things.

   The prototype pointed this at #/visit too, so it came across faithfully.
   Faithful to a mockup where every page was one scrolling document and the
   distinction did not exist.

   `/about` is the right page for ministries - they render there, in
   `ministries_intro`. But the link lands at the top, so a visitor who asked
   "where do gifts go" reads the church's founding story and a statement of
   faith before reaching the list. The anchor fixes the landing, not the page.

   Anchor targets were added in the same change:
     #ministries  on the ministries section  (components/site/section-renderer)
     #prayer      on the home bulletin

   NOT CHANGED: the first card. /groups is correct and this leaves it alone.

   SAFE TO RUN TWICE. jsonb_set is idempotent - re-running writes the same
   values.
   ============================================================ */


/* ============================================================
   SECTION 1 - BEFORE. Run alone, keep the output.

   Expect three rows: /groups, /about, /visit.
   ============================================================ */

select card ->> 'kicker' as kicker,
       card ->> 'title'  as title,
       card ->> 'href'   as href
  from public.church_sections s
  cross join lateral jsonb_array_elements(s.content -> 'cards') as card
  join public.churches c on c.id = s.church_id
 where c.slug = 'church-for-truckers'
   and s.page_slug = 'home'
   and s.section_key = 'get_connected';


/* ============================================================
   SECTION 2 - THE FIX

   Rebuilds the cards array with the two corrected hrefs, matching on the
   kicker rather than on array position - a reordered array should not
   silently repoint the wrong card.

   The first card is passed through untouched.
   ============================================================ */

begin;

update public.church_sections s
   set content = jsonb_set(
         s.content,
         '{cards}',
         (
           select jsonb_agg(
             case
               when card ->> 'kicker' = 'Ministries we support'
                 then jsonb_set(card, '{href}', '"/about#ministries"'::jsonb)
               when card ->> 'kicker' = 'Prayer wall'
                 then jsonb_set(card, '{href}', '"#prayer"'::jsonb)
               else card
             end
             order by ordinality
           )
           from jsonb_array_elements(s.content -> 'cards')
                with ordinality as t(card, ordinality)
         )
       ),
       updated_at = now()
  from public.churches c
 where c.id = s.church_id
   and c.slug = 'church-for-truckers'
   and s.page_slug = 'home'
   and s.section_key = 'get_connected';

commit;


/* ============================================================
   SECTION 3 - VERIFY

   Expect:
     Groups & Bible Studies  ->  /groups
     Ministries we support   ->  /about#ministries
     Prayer wall             ->  #prayer

   Order must still be Groups, Ministries, Prayer - the `order by ordinality`
   preserves it, and a scrambled order here means the rebuild dropped it.
   ============================================================ */

select card ->> 'kicker' as kicker,
       card ->> 'title'  as title,
       card ->> 'href'   as href
  from public.church_sections s
  cross join lateral jsonb_array_elements(s.content -> 'cards') as card
  join public.churches c on c.id = s.church_id
 where c.slug = 'church-for-truckers'
   and s.page_slug = 'home'
   and s.section_key = 'get_connected';
