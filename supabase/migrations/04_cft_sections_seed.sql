-- APPLIED 2026-08-27 against project cyyxhhwuyeyvewqrhewt.
-- Moved from supabase/drafts/ after the run. History, not a to-do.

-- ============================================================
-- DRAFT 04 - church_sections seed for Church for Truckers
-- Project: cyyxhhwuyeyvewqrhewt
-- Church:  36cb9fdf-4ca1-414f-a206-c3885e07ed5a (church-for-truckers)
-- Status:  APPLIED 2026-08-27.
-- ============================================================
--
-- Critical path for Phase B. The acceptance criterion is "content renders 100%
-- from DB"; this is the content. Every page hero, timeline entry, belief,
-- FAQ answer and giving blurb in prototypes/cft-site-orange.html lives here.
--
-- SAFE TO RUN TWICE. Every row is inserted through a NOT EXISTS anti-join on
-- (church_id, page_slug, section_key). Existing rows are never updated and
-- never deleted, so anything already edited in the portal survives untouched.
-- Re-running after adding a row below inserts only the new one.
--
-- SCOPE - what is here and what is deliberately not:
--
--   IS here:  prose the prototype treats as final - page heroes, the About
--             timeline and beliefs, Visit expectations and FAQ, Bible sidebar,
--             giving copy, section labels, and every empty-state string.
--
--   NOT here: collection content. staff, ministries, groups, videos,
--             announcements, prayer_requests, events and sermons stay empty
--             until the pastor and board send real material (KC_MASTER_TODO
--             section C). Those pages render empty states on purpose.
--
--   NOT here: service times. The hero logbook reads churches.service_times,
--             which is already populated. Duplicating it into a section would
--             create a second source of truth that silently drifts.
--
--   NOT here: hero imagery. "image_desktop" and "image_mobile" are seeded null
--             and hold gallery-bucket paths once real photos exist. The hero
--             renders a themed gradient until then.
--
-- section_key is the switch value for the Phase B section renderer. Unknown
-- keys render nothing (BUILD_BRIEF section 5), so adding a row here before the
-- component exists is harmless.
--
-- ASCII straight quotes only per ground rule 7. The prototype's curly quotes,
-- em dashes and &nbsp; are converted; wording is otherwise verbatim.

begin;

with church as (
  select '36cb9fdf-4ca1-414f-a206-c3885e07ed5a'::uuid as id
),
seed(page_slug, section_key, sort_order, content) as (
  values

  -- ==========================================================
  -- HOME
  -- ==========================================================
  ('home', 'hero', 10, $j${
    "headline": "Church for Truckers - Faith on the Road. Hope at Every Mile. 110 Garson Ln, Farmington, MO 63640",
    "eyebrow": "Farmington, MO - Streaming to every state",
    "lede": "We're a congregation of drivers, dispatchers, and the families who wait up for them. No pews required - just a parking spot, a phone signal, and an open heart.",
    "image_desktop": null,
    "image_mobile": null,
    "logbook_title": "Driver's log - weekly",
    "logbook_tz": "CT",
    "ctas": [
      { "label": "Watch this Sunday", "href": "/sermons", "style": "gold" },
      { "label": "Plan a visit", "href": "/visit", "style": "ghost" }
    ]
  }$j$::jsonb),

  ('home', 'about_strip', 20, $j${
    "eyebrow": "Mile 01 - Who we are",
    "heading": "A congregation that moves 60 mph.",
    "body": [
      "Church for Truckers started in a truck stop parking lot with three drivers, a thermos, and a Bible on a tailgate. We grew because the road is full of people who love God and can't make a 10 a.m. service in a building three states away.",
      "So we built church around the schedule you actually keep. Services stream live and stay up all week. Small groups meet by phone at 8 p.m. in whatever time zone you're rolling through. And when it's 3 a.m. on I-80 and the cab feels very quiet, somebody answers the prayer line."
    ],
    "lead_in": "Church for Truckers started in a truck stop parking lot",
    "verse": "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.",
    "verse_cite": "Proverbs 27:17",
    "cta": { "label": "Our full story", "href": "/about" }
  }$j$::jsonb),

  ('home', 'mile_stats', 30, $j${
    "items": [
      { "marker": "MM 38", "value": "38",   "label": "states with members on the road this week" },
      { "marker": "MM 24", "value": "24/7", "label": "prayer line answered by real people" },
      { "marker": "MM 11", "value": "11",   "label": "phone-based small groups across 4 time zones" },
      { "marker": "MM 06", "value": "6 yrs","label": "of Sundays without missing a broadcast" }
    ]
  }$j$::jsonb),

  ('home', 'latest_sermon', 40, $j${
    "eyebrow": "Mile 02 - This week's message",
    "badge": "LATEST - SYNCED FROM YOUTUBE",
    "archive_label": "Browse all messages",
    "archive_href": "/sermons",
    "empty": "The first message goes up this Sunday. Check back after 9:00 AM CT."
  }$j$::jsonb),

  ('home', 'events_preview', 50, $j${
    "eyebrow": "Mile 03 - On the calendar",
    "heading": "Where the convoy's headed.",
    "limit": 3,
    "cta": { "label": "Full calendar", "href": "/events" },
    "empty": "No upcoming events - check back soon."
  }$j$::jsonb),

  ('home', 'bulletin', 60, $j${
    "eyebrow": "The bulletin board",
    "heading": "Posted this week.",
    "announcements_title": "Announcements",
    "announcements_empty": "Nothing posted this week.",
    "prayer_title": "Prayer list",
    "prayer_note": "Names shared with permission",
    "prayer_cta": "Add a request",
    "prayer_empty": "The wall is quiet right now. Yours can be the first request.",
    "prayer_success": "Prayer request sent - a real person will pray over it",
    "prayer_pending_note": "Requests are read by a person before they appear here."
  }$j$::jsonb),

  ('home', 'get_connected', 70, $j${
    "eyebrow": "Get connected",
    "heading": "Three ways in.",
    "cards": [
      { "kicker": "Groups & Bible Studies", "title": "Find your convoy", "body": "Phone, video, and in-person groups with one-tap join links.", "href": "/groups" },
      { "kicker": "Ministries we support", "title": "Where gifts go", "body": "The ministries this church stands behind, beyond our own walls.", "href": "/about" },
      { "kicker": "Prayer wall", "title": "Add a request", "body": "Post it, and watch the amen count climb. Real people pray here.", "href": "/visit" }
    ]
  }$j$::jsonb),

  ('home', 'giving_band', 80, $j${
    "eyebrow": "Mile 04 - Keep it rolling",
    "heading": "Fuel the ministry.",
    "body": "Every gift keeps the stream live, the prayer line answered, and chaplains at truck stops from Farmington to Baton Rouge. Most of our givers are drivers giving $20 a month - it adds up like miles do.",
    "link": { "label": "All the ways to give", "href": "/give" },
    "card_title": "Give securely",
    "frequencies": ["One-time", "Monthly"],
    "amounts": [20, 50, 100, 250],
    "default_amount": 50,
    "custom_placeholder": "Or enter another amount",
    "submit_label": "Continue to giving",
    "note": "Already use Tithe.ly? This button can point straight to your existing Tithe.ly page - no new setup. Gifts may be tax-deductible; consult your tax advisor."
  }$j$::jsonb),

  -- ==========================================================
  -- VISIT
  -- ==========================================================
  ('visit', 'page_hero', 10, $j${
    "eyebrow": "Exit here - First-timers welcome",
    "headline": "Plan your visit.",
    "lede": "Whether you're parking a 70-foot rig at 110 Garson Ln or joining from a rest area three states away, here's everything you need to know before Sunday. No dress code, no pressure, coffee's on."
  }$j$::jsonb),

  ('visit', 'expect', 20, $j${
    "heading": "What to expect",
    "items": [
      { "icon": "truck",  "title": "Rig parking, no sweat",      "body": "The lot at 110 Garson Ln handles full combos. Follow the CHURCH FOR TRUCKERS signs off the highway - you won't miss the orange." },
      { "icon": "shirt",  "title": "Come as you are",            "body": "Most folks arrive in whatever they drove in wearing. If it's clean enough for the cab, it's clean enough for church." },
      { "icon": "clock",  "title": "75 minutes, tight schedule", "body": "We respect your clock the way dispatch never does. Worship, message, prayer - you're rolling in about an hour and change." },
      { "icon": "phone",  "title": "Can't make it in person?",   "body": "Same service, live on the site and YouTube at 9:00 AM CT. Chat is staffed - you'll be greeted by name." },
      { "icon": "family", "title": "Bring the homefront",        "body": "Spouses and kids are the other half of this congregation. Family watch parties run in six cities most Sundays." }
    ]
  }$j$::jsonb),

  ('visit', 'faq', 30, $j${
    "heading": "Common questions",
    "items": [
      { "q": "I haven't been to church in 20 years. Is that a problem?", "a": "About half of us said the same thing once. Nobody's checking attendance records. Show up, drink the coffee, see how it sits." },
      { "q": "What if I'm mid-route on Sunday morning?",                 "a": "The service stays posted all week, and the Wednesday 8 PM check-in call catches everyone who missed it. Church here fits your log book, not the other way around." },
      { "q": "Do I have to give money?",                                 "a": "No. The offering is for members who call this home. Guests should keep their wallets in their pockets - seriously." },
      { "q": "Is the prayer line really answered at 3 AM?",              "a": "Yes. It's staffed by retired drivers who remember what the overnight cab feels like. Any hour, any state." }
    ]
  }$j$::jsonb),

  ('visit', 'visit_form', 40, $j${
    "title": "Tell us you're coming",
    "sub": "We'll save you a parking spot and have a person - not a pamphlet - waiting for you.",
    "name_label": "Name",
    "name_placeholder": "First name is fine",
    "contact_label": "Email or cell",
    "contact_placeholder": "Wherever you actually check",
    "when_label": "Which Sunday?",
    "when_options": [
      "This Sunday - in person, Farmington MO",
      "Sep 13 - service + baptism at The Reset (KY)",
      "Online - whichever Sunday the route allows",
      "Not sure yet"
    ],
    "rig_label": "Bringing a rig?",
    "rig_options": ["No", "Yes - bobtail", "Yes - full combo (save me 70 ft)"],
    "note_label": "Anything we should know?",
    "note_placeholder": "First visit, prayer request, kids coming along...",
    "submit_label": "Plan my visit",
    "hint": "Goes straight to a real person. We reply within a day.",
    "success": "Visit request sent - see you Sunday"
  }$j$::jsonb),

  -- ==========================================================
  -- ABOUT
  -- ==========================================================
  ('about', 'page_hero', 10, $j${
    "eyebrow": "Our story - Est. 2020",
    "headline": "Three drivers, a thermos, and a tailgate.",
    "lede": "Church for Truckers exists because 3.5 million Americans keep this country stocked and fed - and almost none of them can make a Sunday service in a building. So we brought the building to the road."
  }$j$::jsonb),

  ('about', 'timeline', 20, $j${
    "stops": [
      { "year": "2020", "marker": "MM 0",   "title": "The parking lot", "body": "Ray Delgado, fourteen years an owner-operator, starts reading scripture off a tailgate at a truck stop with two other drivers waiting out a reset. Word travels the CB faster than any church bulletin." },
      { "year": "2021", "marker": "MM 88",  "title": "The phone bridge", "body": "Winter kills the tailgate meetings, so church moves to a conference line. Turns out a congregation that can't see each other prays harder. Eleven drivers become sixty." },
      { "year": "2023", "marker": "MM 204", "title": "The livestream", "body": "First Sunday broadcast from a borrowed sanctuary. Chat fills with mile markers instead of amens: I-40 near Amarillo. US-2, Montana. Parked in Laredo, engine off." },
      { "year": "2024", "marker": "MM 310", "title": "The prayer line", "body": "A driver in Wyoming calls a group leader at 3 AM instead of doing something worse. That call becomes a 24/7 prayer line staffed by retired drivers who know exactly what the overnight cab feels like." },
      { "year": "2026", "marker": "MM 412", "title": "Today", "body": "Members in 38 states, chaplains at truck stops in four, eleven phone groups, six years of Sundays without a missed broadcast. Still zero pews." }
    ]
  }$j$::jsonb),

  ('about', 'beliefs', 30, $j${
    "heading": "What we believe",
    "lede": "The historic Christian faith, stated plainly enough to read at a fuel stop.",
    "items": [
      { "title": "The Bible",  "body": "God's word, trustworthy for the whole route - doctrine, correction, and direction included." },
      { "title": "Jesus",      "body": "Fully God, fully man, crucified and risen. The only load that was ever hauled for someone else's account - yours." },
      { "title": "Grace",      "body": "You can't out-drive your past, and you don't have to. Salvation is a gift, not a settlement for miles logged." },
      { "title": "Community",  "body": "Nobody hauls alone. The church is a convoy - different rigs, same direction, watching each other's blind spots." }
    ]
  }$j$::jsonb),

  ('about', 'ministries_intro', 40, $j${
    "heading": "Ministries we support",
    "lede": "A portion of every gift goes back out the gate to ministries running the same route.",
    "empty": "The board is finalising this list. It will appear here as soon as it's confirmed."
  }$j$::jsonb),

  ('about', 'about_ctas', 50, $j${
    "ctas": [
      { "label": "Meet the team", "href": "/team",  "style": "solid" },
      { "label": "Plan a visit",  "href": "/visit", "style": "ghost" }
    ]
  }$j$::jsonb),

  -- ==========================================================
  -- TEAM
  -- ==========================================================
  ('team', 'page_hero', 10, $j${
    "eyebrow": "Our team - The crew",
    "headline": "People who've logged the miles.",
    "lede": "Every person on this team has either driven, dispatched, or waited up for someone who does. That's not a hiring policy - it just worked out that way, and we think God did it on purpose.",
    "empty": "Team profiles are being written up now. Check back shortly."
  }$j$::jsonb),

  -- ==========================================================
  -- GROUPS
  -- ==========================================================
  ('groups', 'page_hero', 10, $j${
    "eyebrow": "Groups & Bible Studies - Find your convoy",
    "headline": "Nobody hauls alone.",
    "lede": "Bible studies and small groups built around driver schedules - most meet by phone so you can join hands-free from any state. Pick one, tap join, and a leader will call you before your next reset."
  }$j$::jsonb),

  ('groups', 'group_filters', 20, $j${
    "filters": [
      { "value": "all",       "label": "All groups" },
      { "value": "phone",     "label": "Phone" },
      { "value": "video",     "label": "Video" },
      { "value": "in_person", "label": "In person" }
    ],
    "join_label": "Join",
    "link_label": "Link",
    "join_success": "Request sent - a leader will reach out before your next reset",
    "empty": "Groups are being set up now. Tell us you're interested and we'll call when the first one opens."
  }$j$::jsonb),

  -- ==========================================================
  -- EVENTS
  -- ==========================================================
  ('events', 'page_hero', 10, $j${
    "eyebrow": "Events - The road ahead",
    "headline": "Where the convoy's headed.",
    "lede": "In-person chapels follow the freight - we schedule around rodeo weekends, produce season, and holiday surges, because that's where you'll be anyway."
  }$j$::jsonb),

  ('events', 'event_filters', 20, $j${
    "filters": [
      { "value": "all",       "label": "All" },
      { "value": "in_person", "label": "In person" },
      { "value": "retreat",   "label": "Retreat" }
    ],
    "empty": "No upcoming events - check back soon."
  }$j$::jsonb),

  -- ==========================================================
  -- SERMONS
  -- ==========================================================
  ('sermons', 'page_hero', 10, $j${
    "eyebrow": "Sermons - The archive",
    "headline": "Messages built for the miles.",
    "lede": "Every Sunday, synced automatically from YouTube. Listen live, or queue a series for the long stretch between Denver and Kansas City.",
    "all_series_label": "All series",
    "watch_label": "Watch",
    "empty": "The archive fills up after the first broadcast. Nothing here yet."
  }$j$::jsonb),

  -- ==========================================================
  -- WORSHIP
  -- ==========================================================
  ('worship', 'page_hero', 10, $j${
    "eyebrow": "Worship Library - Music & stories",
    "headline": "Worship from the cab.",
    "lede": "Acoustic sets recorded for the road, plus Driver Stories - testimonies from the people in the chat every Sunday. Built to sound right through truck speakers."
  }$j$::jsonb),

  ('worship', 'worship_filters', 20, $j${
    "filters": [
      { "value": "all",     "label": "Everything" },
      { "value": "music",   "label": "Worship sets" },
      { "value": "stories", "label": "Driver Stories" }
    ],
    "play_label": "Play",
    "empty": "The first sets are being recorded. Nothing posted yet."
  }$j$::jsonb),

  -- ==========================================================
  -- BIBLE
  -- ==========================================================
  ('bible', 'page_hero', 10, $j${
    "eyebrow": "Bible - Read on the road",
    "headline": "The owner's manual.",
    "lede": "Read right here - big type, easy on the eyes at a rest stop. Pick up wherever the route left off."
  }$j$::jsonb),

  ('bible', 'reader', 20, $j${
    "default_book": "Psalms",
    "default_chapter": 121,
    "default_subtitle": "A song of ascents - The driver's psalm",
    "books": ["Psalms", "Proverbs", "Matthew", "John", "Romans", "Ecclesiastes"],
    "load_label": "Load passage",
    "error": "That passage didn't load. Try another, or check back in a minute."
  }$j$::jsonb),

  ('bible', 'verse_of_day', 30, $j${
    "title": "Verse for the road",
    "verse": "Thy word is a lamp unto my feet, and a light unto my path.",
    "reference": "Psalm 119:105"
  }$j$::jsonb),

  ('bible', 'reading_plan', 40, $j${
    "title": "Reading plan: The Long Haul",
    "body": "One psalm per fuel stop. At two stops a day you'll finish all 150 in under three months - most of a produce season.",
    "cta_label": "Start the plan"
  }$j$::jsonb),

  ('bible', 'ylcc_bridge', 50, $j${
    "title": "Go deeper with YourLife CC",
    "body": "Scripture memory, guided prayer, and a full faith library - built by the same crew, made for your phone. Free to start.",
    "cta_label": "Open YourLife CC",
    "cta_href": "https://yourlifecc.com"
  }$j$::jsonb),

  -- ==========================================================
  -- DEVOTIONALS  (page built last - draft 05 must run first)
  -- ==========================================================
  ('devotionals', 'page_hero', 10, $j${
    "eyebrow": "Devotionals - Five minutes at the pump",
    "headline": "Fuel-stop devotionals.",
    "lede": "Written to be read in the time it takes to fill two tanks. New ones most weekdays, straight from the team.",
    "featured_label": "Today's devotional",
    "read_label": "Read",
    "empty": "The first devotional posts soon. Check back this week."
  }$j$::jsonb),

  -- ==========================================================
  -- GIVE
  -- ==========================================================
  ('give', 'page_hero', 10, $j${
    "eyebrow": "Give - Keep it rolling",
    "headline": "Fuel the ministry.",
    "lede": "No building fund here - no building. Every dollar goes to the stream, the prayer line, truck stop chapels, and hot Thanksgiving meals for drivers who can't route home. Most of our givers are drivers giving $20 a month."
  }$j$::jsonb),

  ('give', 'give_band', 20, $j${
    "heading": "Give securely, from any state.",
    "body": "One-time or monthly, card or bank. Handled by Stripe - we never see your card number, and you can change or cancel monthly gifts anytime.",
    "bullets": [
      "24/7 prayer line - kept staffed",
      "Sunday stream - kept live",
      "4 truck stop chapels - kept open",
      "Holiday meals - kept hot"
    ],
    "card_title": "Give securely",
    "frequencies": ["One-time", "Monthly"],
    "amounts": [20, 50, 100, 250],
    "default_amount": 50,
    "custom_placeholder": "Or enter another amount",
    "submit_label": "Continue to giving",
    "note": "Already use Tithe.ly? This button can point straight to your existing Tithe.ly page - no new setup. Gifts may be tax-deductible; consult your tax advisor."
  }$j$::jsonb),

  ('give', 'other_ways', 30, $j${
    "items": [
      { "title": "By mail",        "body": "Church for Truckers, 110 Garson Ln, Farmington, MO 63640" },
      { "title": "At a chapel",    "body": "A lockbox goes to every in-person chapel. Cash, checks, and the occasional handful of quarters all welcome." },
      { "title": "With your hands","body": "Broke this month? So was the early church. Volunteer a prayer-line shift or a chat-greeter hour instead - it counts." }
    ]
  }$j$::jsonb)
)
insert into public.church_sections
  (church_id, page_slug, section_key, sort_order, visible, content)
select c.id, s.page_slug, s.section_key, s.sort_order, true, s.content
  from seed s
 cross join church c
 where not exists (
   select 1
     from public.church_sections e
    where e.church_id  = c.id
      and e.page_slug  = s.page_slug
      and e.section_key = s.section_key
 );

commit;


-- ============================================================
-- VERIFY - run after commit, paste the output back
-- ============================================================
-- Expect 34 rows across 11 page_slug values:
--   about 5 | bible 5 | devotionals 1 | events 2 | give 3 | groups 2
--   home 8 | sermons 1 | team 1 | visit 4 | worship 2
--
-- select page_slug, count(*) as sections
--   from public.church_sections
--  where church_id = '36cb9fdf-4ca1-414f-a206-c3885e07ed5a'
--  group by page_slug
--  order by page_slug;
--
-- Full listing, in render order:
--
-- select page_slug, section_key, sort_order, visible
--   from public.church_sections
--  where church_id = '36cb9fdf-4ca1-414f-a206-c3885e07ed5a'
--  order by page_slug, sort_order;
--
-- Sanity check that no jsonb landed as a bare string:
--
-- select page_slug, section_key, jsonb_typeof(content) as kind
--   from public.church_sections
--  where church_id = '36cb9fdf-4ca1-414f-a206-c3885e07ed5a'
--    and jsonb_typeof(content) <> 'object';
-- -- expect zero rows
