# ONBOARDING - standing up a new church

How to take a church from "the pastor said yes" to "the pastor is logged in and
their domain resolves". Written 2026-09-02, after Church for Truckers had been
through it once. CFT is the only church that has ever been onboarded, so every
model file referenced below is a CFT file.

**Read this first, because it changes how you read everything after it:**

There is no self-serve onboarding. There is no admin "create church" screen.
This document IS the provisioning system - a person reads it and types SQL.
See section 8 for what that costs and where the real thing would go.

**And there is a code change you must ship BEFORE you seed a second church.**
`/devotionals` serves Church for Truckers' 365 devotionals to every tenant, and
there is no data-level way to turn it off - not a section row, not a flag, not a
toggle in the portal. A second church launched today publishes another church's
devotional content under their own name, on a page their own header nav links
to. That is a launch blocker, not a design preference. The prerequisite section
immediately below is the fix, and it comes before section 1.

**Everything in section 2 is a production change.** CLAUDE.md ground rule 8:
`cyyxhhwuyeyvewqrhewt` backs the live public site, there is no staging database,
and there never was one. Ground rule 0.3 still holds without exception - Claude
drafts SQL into `supabase/drafts/`, Jason runs it in the Supabase SQL editor and
pastes the results back. Nothing in this file is authorisation to execute SQL.

Rough shape of the work, if nothing goes wrong and the pastor answers promptly:

| Stage | Who | Elapsed |
|---|---|---|
| **0. Ship the devotionals gate (prerequisite)** | **Jason / Claude - code + deploy** | **half a day, once, before church two exists** |
| 1. Collect (section 1) | pastor | days - this is the long pole |
| 2. Write the draft, run it (section 2) | Claude drafts, Jason runs | 1-2 hours |
| 3. Auth (section 3) | Jason | 10 minutes |
| 4. Domain + DNS (section 4) | Jason | 30 minutes, then DNS propagation |
| 5. CFT-specific decisions (section 5) | Jason, with the pastor | hours to weeks - see the table |
| 6. Verify (section 6) | Jason | 30 minutes |

Once stage 0 is done, adding a church needs **no code deploy** and **no new
environment variable**. The only other things in this runbook that touch a
deploy are the optional subdomain-to-apex redirect in section 4, and section 5
if the church needs the trucker design language removed.

---

## Stage 0 - PREREQUISITE: gate the devotionals per church

**Do this before seeding church number two. It is not optional and it is not
part of section 5's "decide later" list.**

### What is wrong

Verified 2026-09-02 by reading the render path, not by inspection of the seed:

- `components/site/page-collection.tsx` renders `DEVOTIONALS` - the 365-entry
  array in `lib/devotionals.ts` - for any request where
  `pageSlug === "devotionals"`. It is gated on nothing else. No section row, no
  church id, no flag.
- `devotionals` is in `PAGES` (`lib/portal/sections.ts`), so `/devotionals`
  routes for every church.
- `/devotionals` is a hardcoded entry in `NAV` in
  `components/site/site-header.tsx`, which is a **platform-wide constant**, not
  per-church. Every church's header links to it.

So the usual lever does not work here. Omitting the `devotionals.page_hero`
section row changes only the page heading; the 365 devotionals still render
below it, and the nav still points at them.

### Why this is a blocker and not a decision

The 365 entries are ported from YourLife CC and are Church for Truckers'
content (FF-30). A second church going live today publishes another
organisation's devotional writing, under their own church's name, on a page
their own navigation advertises. Nobody has to visit an obscure URL for it to
happen - the header does the advertising.

Compare the worship playlist, which is the same class of problem and is **not**
a blocker: those 30 songs render inside the `worship_filters` section, so
omitting that section row for a new church suppresses them with no code change.
That is why FF-54 reads as deferrable and this does not.

### The fix

Two parts. Both are needed - doing one without the other leaves either a dead
nav link or a live page nobody linked to.

1. **Gate the render.** Make `/devotionals` conditional on the church actually
   having devotionals. The cheapest correct shape is to key it off a section
   row the way every other page keys off its own: have
   `page-collection.tsx` return `null` for `devotionals` unless the church has
   a `devotionals` section row that opts in - reuse the existing
   `sections` argument it already receives, so no new data plumbing. A church
   that should serve them gets the row; a church that should not, does not.
2. **Make the public nav per-church.** `NAV` in `site-header.tsx` is a module
   constant. It already has precedent for being filtered - `videoChannels`
   trims the Watch group when a church has no usable channels, returning `NAV`
   unchanged otherwise. Extend that same filtering to drop `/devotionals` for a
   church that is not serving them.

While you are in there, decide the same question for **`/bible`** and the
`ylcc_bridge` section. Both are also platform-wide today, and `ylcc_bridge` is
a Kingdom Creatives cross-promotion rather than the church's content. They are
not blockers - a Bible reader is defensible on any church's site - but the nav
change is the same edit, and doing it twice is wasteful.

### How to verify it

Not by reading the diff. Deploy, then load `/devotionals` on a church that is
**not** meant to serve them and confirm the served HTML contains no devotional
body text, and that the header has no Devotionals link. Then load it on Church
for Truckers and confirm both are still there - that is the control, and
without it a blank page proves only that you broke the page for everyone
(FF-35).

### Estimated size

Half a day including the verification pass. It is one conditional in
`page-collection.tsx`, one filter in `site-header.tsx`, and a decision about
which section row means "yes".

Section 5.1 covers the longer-term version of this - moving devotionals and
worship into per-church tables. That remains deferrable. **This does not.**

---

## 1. What to collect from the pastor first

Collect all of it before writing any SQL. The failure mode this list exists to
prevent is discovering at step 2.4 that nobody ever asked for the giving link,
and the seed run stalls for three days.

### 1.1 Required to launch

Without these the site is either broken or lying.

| Item | Lands in | Notes |
|---|---|---|
| Church name | `churches.name` | |
| **Slug** | `churches.slug` | Lowercase, hyphens. Effectively permanent - see the judgment call below |
| Contact email | `churches.email` | Rendered on the site and in the legal pages |
| Physical address | `churches.address` | Also feeds `/privacy`, `/terms`, `/cookies` via `lib/legal.ts` |
| Service times | `churches.service_times` (jsonb) | `[{day, time, tz, label}]` is what the renderer reads. Migration 01's column comment also lists an unused `streaming: bool` - jsonb enforces no shape, so extra keys are harmless, but `{day, time, tz, label}` is what actually renders |
| **Giving link** | `church_links` `kind='giving'` | Tithe.ly URL or any other. No row = the Give button goes nowhere |
| Brand colours - 3 hex | `church_theme` | primary, secondary, and text-on-brand. See 2.2 - the third one is not a third brand colour |
| Fonts - 2 names | `church_theme` | **Do not bother collecting these - see 2.4.** As of a 2026-08-31 code change, no font choice renders; every church gets the same platform typeface |
| Pastor's login email | Supabase Auth + `church_members` | Section 3 |
| About / story copy | `church_sections` - `about.timeline`, `home.about_strip` | The single biggest writing ask. See 2.3 |
| Statement of faith | `church_sections` - `about.beliefs` | List-shaped, so seeded once and not pastor-editable (FF-45) |
| Custom domain | `churches.custom_domain` | Required **before** DNS points here, not after. Section 4 |

### 1.2 Can come later

All of these have a working empty state, or are editable in the portal once the
pastor has a login. None of them block launch.

| Item | Lands in | What happens without it |
|---|---|---|
| Banner photo, desktop | `home.hero.image_desktop` | Hero renders a themed gradient |
| Banner photo, **portrait for mobile** | `home.hero.image_mobile` | The desktop crop is used on phones, which usually looks wrong. Ask for both |
| Logo | `church_theme.logo_media_id` | The church name renders as text in the header |
| Tagline | `churches.tagline` | Omitted |
| Phone | `churches.phone` | Omitted |
| YouTube channel IDs | `church_links` `kind='video'` | `/sermons` shows only manually-entered sermons. See 2.4 - it must be the `UC...` id, not the `@handle` |
| Social links | `church_links` `kind='social'` | Footer social row is empty |
| Staff | `staff` table, portal "Our Team" | `/team` renders its seeded empty state |
| Ministries | `ministries` table, portal tab | `/about` ministries block is empty |
| Groups | `groups` table, portal tab | `/groups` renders its empty state |
| Events | `events` table, portal tab | `/events` renders its empty state |
| Announcements | `announcements` table, portal tab | Home bulletin board is empty |

### 1.3 The judgment call: the slug

Pick it with the pastor, in writing, before the first insert. It is not just a
database key:

- it is the subdomain the church uses before their domain moves -
  `{slug}.kingdom-creatives.com`
- it is the cache key for every cached read - `lib/church.ts` `churchTag(slug)`
  namespaces `church_sections`, `church_links`, `churches` and every collection
- `lib/tenant.ts` resolution rule 2 matches on it

Changing it later means re-pointing DNS, invalidating every cache entry, and
updating anything that referenced the subdomain. There is no rename path built.
Treat it as permanent.

### 1.4 What you deliberately do NOT collect

State this to the pastor so they do not go hunting:

- **No API keys.** Not YouTube, not Anthropic, not Bible. Every key is
  platform-level and already set. See section 4.
- **No payment credentials.** Giving is an outbound link to their own Tithe.ly
  (or equivalent) account. No card data ever touches this platform, and
  `lib/legal.ts` says so in the published privacy policy (FF-50).
- **No hosting or DNS provider login**, unless they want us to make the DNS
  change for them. Section 4 works either way.

---

## 2. The SQL, in order

### 2.0 How to package it

Write **one draft file**, `supabase/drafts/NN_<slug>_onboarding.sql`, taking the
next unused number. Per `supabase/drafts/README.md`:

- **Block comments (`/* ... */`), not `--`.** A dropped `--` prefix when pasting
  into the SQL editor makes Postgres parse the prose as SQL, and the symptom is
  a baffling `relation "the" does not exist`. This is the current rule, stated
  in the drafts README - it postdates some of the model files, and
  `03_cft_theme_seed.sql` in particular is written entirely in `--` line
  comments. Follow the README, not that file's own comment style; copy its SQL
  shape, not its formatting.
- Number sections and say **RUN THE SECTIONS SEPARATELY**. The SQL editor shows
  only the last statement's result, so a five-statement paste hides four
  results.
- **State the expected before and after for every section**, per ground rule 8.
  "SQL executed successfully" is not a result.
- Once it has run, move it to `supabase/migrations/` with the applied date in
  the header, and update the drafts README table.

Risk sizing per ground rule 8: this whole draft is **data-only and idempotent**
if you write every insert with a `NOT EXISTS` guard, which is what the CFT seeds
do. That puts it in the "run it, keep the before/after selects" tier. It does
not create tables, alter columns, or touch RLS - all of that already exists and
is table-level, not per-church.

### 2.1 Model files - what to copy from

| Step | Copy the shape from | Unique per church | Copy as-is |
|---|---|---|---|
| churches row | `supabase/migrations/01_kc_migration_01.sql` section 5 | `slug`, `custom_domain`, `name`, `address`, `email`, `service_times` | column list, `status='active'`, `giving_mode` |
| church_theme | `supabase/migrations/03_cft_theme_seed.sql` | all 5 values | the confirm select |
| church_sections | `supabase/migrations/04_cft_sections_seed.sql` | every `content` value | every `page_slug`, `section_key`, `sort_order`; the `NOT EXISTS` anti-join |
| church_links | `supabase/migrations/10_cft_links_seed.sql` | every url and label | the `kind` vocabulary, the guard, the confirm |
| church_members | `supabase/migrations/12_grant_portal_access.sql` | the email (two places), the slug (two places) | everything else, verbatim |

`03` is written as an `UPDATE` because CFT's `church_theme` row already existed
before migration 01. A genuinely new church has no row, so **use INSERT**. Same
trap in `01` section 5, which updates a pre-existing `churches` row.

### 2.2 Section 1 - precheck

Run this first and read it before writing anything. It is the section that
catches a slug or domain collision before it becomes a duplicate church.

```sql
/* Expect ZERO rows. Any row here means the slug or domain is taken. */
select id, slug, name, status, custom_domain
  from public.churches
 where slug = 'new-church-slug'
    or custom_domain in ('newchurch.org', 'www.newchurch.org');
```

### 2.3 Section 2 - the churches row

```sql
insert into public.churches
  (slug, name, tagline, address, phone, email,
   status, custom_domain, giving_mode, service_times)
select
  'new-church-slug',
  'New Church',
  'Their tagline',
  '123 Main St, Town, ST 00000',
  '',
  'info@newchurch.org',
  'active',
  'newchurch.org',
  'tithely',
  '[
     {"day": "Sunday",    "time": "10:00 AM", "tz": "CT", "label": "Morning service"},
     {"day": "Wednesday", "time": "7:00 PM",  "tz": "CT", "label": "Bible study"}
   ]'::jsonb
 where not exists (
   select 1 from public.churches where slug = 'new-church-slug'
 );

/* Confirm - expect exactly one row, status active. */
select id, slug, name, status, custom_domain, giving_mode
  from public.churches
 where slug = 'new-church-slug';
```

**`status` MUST be `'active'`.** This is the single most expensive thing to get
wrong, and it fails quietly in two directions at once:

- Both public select policies on `churches` and `church_theme` are
  `using (status = 'active')` (migration 17). A non-active church is invisible
  to the anon role, so the public site 404s with nothing in any log explaining
  why.
- Per **FF-28**, the portal's write-then-read-back is filtered by the same
  policy, so on a non-active church a *successful* save reads back zero rows and
  is reported to the pastor as a refusal.

There is no "draft church" state, and do not invent one. The pre-launch state is
a church that is `active` with `custom_domain` left null - reachable only at
`{slug}.kingdom-creatives.com`, which nobody has the URL for.

Leave `giving_url` and `youtube_channel_id` **null**. They are the legacy
single-value columns that `church_links` replaced; draft 09 kept them only
because Phase B code still read them. Writing to them now creates the
two-sources-for-one-fact problem that `church_links` exists to remove.

Also note the column grants from migration 17: `authenticated` can only UPDATE
`name`, `tagline`, `address`, `phone`, `email`, `service_times`. **`slug`,
`custom_domain`, `status`, `id` and `template_id` are not grantable to the
pastor by design** - changing any of those is always your SQL, never a portal
save.

### 2.4 Section 3 - church_theme

```sql
insert into public.church_theme
  (church_id, color_primary, color_secondary, color_accent, font_heading, font_body)
select c.id, '#2B5C8A', '#161311', '#FDFBF5', 'Lora', 'Inter'
  from public.churches c
 where c.slug = 'new-church-slug'
   and not exists (
     select 1 from public.church_theme t where t.church_id = c.id
   );

/* Confirm - expect one row with the five values above. */
select c.slug, t.color_primary, t.color_secondary, t.color_accent,
       t.font_heading, t.font_body
  from public.church_theme t
  join public.churches c on c.id = t.church_id
 where c.slug = 'new-church-slug';
```

Three things a pastor gets wrong when asked for "brand colours":

1. **`color_accent` is not a third brand colour.** It is the text colour that
   sits on top of brand-coloured fills - `--kc-brand-contrast`. Getting it wrong
   makes every button unreadable rather than merely off-brand. Near-white or
   near-black, chosen for contrast against `color_primary`.
2. **`color_secondary` becomes `--kc-accent`**, the dark band colour, not a
   second brand hue. CFT's is `#161311`, near-black.
3. **There are only three colours and two fonts.** The rest of the token set is
   derived in `lib/theme.ts` or is a platform-wide neutral. A church that wants
   its own neutral ramp is a schema change - `supabase/drafts/02_theme_tokens.sql`
   is the unrun draft for exactly that, and it stays unrun until someone needs
   it.

If the church has no strong opinion, **skip this row entirely**. `lib/church.ts`
returns `theme: null` cleanly and `lib/theme.ts` falls back to `DEFAULT_THEME`.
A church with no theme row renders the platform default palette, not a broken
page. Insert it anyway when you have the values - it is cheap and it is what the
portal's Branding panel edits.

**Correction, verified 2026-09-03 by reading `lib/theme.ts` directly - do not
trust an older description of this, including an earlier draft of this
document.** `font_heading` and `font_body` are not read for rendering at all.
A 2026-08-31 decision moved the whole platform - public site and portal - onto
one shared typeface (`PLATFORM_FONT`, currently Plus Jakarta Sans), and the
code comment says so explicitly: *"THIS IGNORES church_theme.font_heading AND
font_body."* `FONT_STACKS` today has exactly two entries
(`plus jakarta sans`, `ibm plex mono`) - CFT's seeded "Fraunces" / "Source Sans
3" are stale values nobody removed, not evidence the platform still reads
them. `saveBranding` still writes whatever you pass, so the insert in the SQL
above is harmless, but **it will not change anything a visitor sees.** Don't
spend pastor time collecting font preferences until per-church typography is
restored - the code comment points at an `FF-44` for that, which does not
exist in `docs/FAST_FOLLOW.md` as of this writing; if you need that decision
un-deferred, that gap is the first thing to fix, not this runbook.

### 2.5 Section 4 - church_sections, all 11 pages

This is the bulk of the draft. Copy the structure of
`supabase/migrations/04_cft_sections_seed.sql` - the `begin;`, the
`seed(page_slug, section_key, sort_order, content)` values list, the
`NOT EXISTS` anti-join on `(church_id, page_slug, section_key)`, and the
confirm selects. CFT's seed is 34 rows across 11 pages.

**One piece is not copyable literally: `with church as (select '<uuid>'::uuid
as id)`.** CFT's file hardcodes that church's already-known id, because CFT's
`churches` row existed before this draft ran. A new church has no id yet at
the time you are writing this section - look it up by slug instead:
`with church as (select id from public.churches where slug = 'new-church-slug')`.
Same pattern section 2.4's `church_theme` insert already uses. Pasting the
literal UUID pattern verbatim produces SQL that inserts against a church that
does not exist.

The `NOT EXISTS` guard is not decoration. It makes the file re-runnable: rows
the pastor has since edited in the portal are never clobbered, and adding one
row to the bottom and re-running inserts only that row.

The unique constraint is `(church_id, page_slug, section_key)` - migration 08
widened it from `(church_id, section_key)`, which had permitted exactly one
`page_hero` per church. That is already done; you inherit it.

**The 11 pages and their sections.** The authority is `PAGES` in
`lib/portal/sections.ts`, which `app/(public)/[slug]/page.tsx` validates every
incoming URL against. A page slug not in that list 404s. A page slug in the list
with no rows renders `EmptyPage` - deliberately a 200, because the header nav
links to it and a 404 behind a live nav link reads as a broken site.

| Page | Sections (in sort order) | Seed all of them? |
|---|---|---|
| `home` | hero, about_strip, daily_devotional*, mile_stats, latest_sermon*, events_preview*, bulletin*, get_connected, giving_band | See notes below |
| `visit` | page_hero, expect, faq, visit_form* | Yes |
| `about` | page_hero, timeline, beliefs, ministries_intro, about_ctas | Yes |
| `team` | page_hero | Yes |
| `groups` | page_hero, group_filters* | Yes |
| `events` | page_hero, event_filters* | Yes |
| `sermons` | page_hero | Yes |
| `worship` | page_hero, worship_filters* | See section 5 |
| `bible` | page_hero, reader*, verse_of_day*, reading_plan, ylcc_bridge | See note |
| `devotionals` | page_hero | See section 5 |
| `give` | page_hero, give_band, other_ways | Yes |

`*` marks `auto: true` in the registry - the section renders itself from other
data (the sermon feed, the events table, the Bible API) and shows no editable
text boxes in the portal. It still needs its row to exist for the section to
render at all.

Per-section notes that matter:

- **`mile_stats` - seed it `visible = false`, or not at all.** CFT's four stats
  ("38 states with members on the road this week") were seeded prototype numbers
  that were not true of the church, and migration 31 switched them off for
  exactly that reason. Do not ship invented statistics on a church's website.
  Seed the row with real numbers if the church has them, otherwise leave it off
  - the pastor can turn it on from Edit My Website later.
- **`daily_devotional`** turns on the devotional card in the home page's about
  grid. **Only insert it for a church that is genuinely meant to serve the
  devotional corpus** - see stage 0. It renders Church for Truckers' content.
- **`ylcc_bridge`** is the card pointing at YourLife CC. That is a Kingdom
  Creatives cross-promotion, not the church's content. Keep it or drop it as a
  business decision, but decide rather than copying it by reflex.
- **`bible.reader`** has `default_book` / `default_chapter` in its content. CFT's
  is Psalms 121 because that is the driver's psalm. Pick something for this
  church or leave the code fallback (John).

**The judgment call, and it is the most important one in this section:**

Six section fields are **list-shaped** (arrays of objects) and the section
editor cannot edit them. `FieldKind` (`lib/portal/sections.ts`) is actually
`text | textarea | paragraphs | image | url` - FF-45 and FF-57 describe it as
scalars only, which was true when they were written but is one kind short of
current code. `paragraphs` is real and useful (it's what `about_strip.body`
uses - a field that is a *list of strings*, not a list of objects, and it is
editable) but it does not help with the six below, which are lists of `{title,
body, ...}` objects: `faq.items`, `timeline.stops`, `beliefs.items`,
`expect.items`, `mile_stats.items`, `other_ways.items`, plus
`get_connected.cards`. See **FF-45** and **FF-57**.

Whatever you seed into those is what the pastor lives with until they call you
and you write more SQL. That is how FF-46 - two of three "Three ways in" links
pointing at the wrong page - had to be fixed. **Get the lists right at seed
time.** Send the pastor the FAQ questions, the timeline entries and the beliefs
list as a document, get them signed off, then seed. Do not seed CFT's and plan
to fix it later.

Everything else in `content` is prose in Church for Truckers' voice and must be
rewritten wholesale. Grep the seed for "driver", "truck", "road", "mile" before
you consider it done - see section 5.3.

Ground rule 7: **ASCII straight quotes only.** The prototype's curly quotes, em
dashes and `&nbsp;` get converted.

### 2.6 Section 5 - church_links

```sql
with target as (
  select id from public.churches where slug = 'new-church-slug'
),
incoming (kind, platform, label, url, external_id, sort_order, is_primary) as (
  values
    ('giving', 'tithely',  'Give',
     'https://give.tithe.ly/?formId=...', '...', 0, true),
    ('video',  'youtube',  'Sunday Services',
     'https://youtube.com/@newchurch', 'UC................', 0, true),
    ('social', 'facebook', 'Facebook',
     'https://facebook.com/newchurch', null, 0, true)
)
insert into public.church_links
  (church_id, kind, platform, label, url, external_id, sort_order, is_primary)
select t.id, i.kind, i.platform, i.label, i.url, i.external_id,
       i.sort_order, i.is_primary
  from incoming i cross join target t
 where not exists (
   select 1 from public.church_links e
    where e.church_id = t.id and e.kind = i.kind and e.url = i.url
 );

/* Confirm - expect one row per link, at most one is_primary per kind. */
select kind, platform, label, url, external_id, sort_order, is_primary
  from public.church_links l
  join public.churches c on c.id = l.church_id
 where c.slug = 'new-church-slug'
 order by kind, sort_order;
```

- `kind` is constrained to `social | video | giving`. `platform` is free text on
  purpose - a church using Givelify instead of Tithe.ly is a data change, not a
  migration.
- A partial unique index enforces **at most one `is_primary` per
  `(church_id, kind)`**. A second `is_primary` giving row raises rather than
  silently winning.
- **The `giving` row is required to launch.** `givingLink(links)` feeds every
  Give button and the giving band. No row means the button has no destination.
- **`video.external_id` must be the `UC...` channel ID, not the `@handle`.**
  Migration 29 exists because CFT was seeded with handles and `/sermons` showed
  only the six manually-entered sermons instead of 48. `channels.list?id=` takes
  a `UC...` id; a handle returns nothing, and `lib/youtube.ts` returns `[]` on
  every failure path, so the page renders its ordinary empty state and looks
  like a church that has not posted anything. Keep the handle URL in `url` -
  that is the human-facing link the footer renders.
  To find the channel ID: open the channel, view source, and read the
  `channelId` meta, or call `channels.list?forHandle=@name` once by hand.
- After this runs, the site can take **up to 60 seconds** to reflect it -
  `getChurchLinks` caches for 60s. Expected, not a fault (migration 29's note
  says so because it caused a scare).

### 2.7 Section 6 - church_members

See section 3 - the auth user must exist first.

One field the model file doesn't decide for you: `approved_by`. Migration 12
sets it to the new user's own id, because that file is Jason granting himself
access - a self-approval. Nothing in the schema enforces or reads this column
today (`role` is the same kind of unenforced label - PORTAL_SPEC open question
3), so it is a free choice, not a copied fact. Setting it to the same pastor
being granted access is the precedent and is harmless; if you'd rather it
reflect whoever is actually running this draft, that's equally valid and
equally inert. Decide once, don't agonise over it.

### 2.8 What you do NOT create

State these in the draft's header comment so nobody goes looking:

- **No RLS policies.** Every policy on every table is table-level and scoped by
  `church_id` or by `exists (select 1 from church_members ...)`. A new church
  inherits all of them the instant its `churches` row exists. Writing a
  per-church policy would be a mistake.
- **No storage buckets.** `church-media` (public) and `church-documents`
  (private) are shared by every church, with the church id as the first path
  segment and isolation enforced by policy on `storage.objects`. Migration 23
  decision 1 chose this specifically so that provisioning a church needs no
  elevated-privilege step that can fail half way.
- **No legal page rows.** `/privacy`, `/terms` and `/cookies` are platform
  templates in `lib/legal.ts` that read name, domain, contact and address from
  the `churches` row. They render for a new tenant on day one with no data
  migration. This is deliberate - see FF-50 and section 7.
- **No `gallery` rows.** `gallery` is superseded by `church_media` (FF-39) and
  has zero rows. Ignore it.
- **No devotional or worship rows.** Those are code, not data. Section 5.

---

## 3. Auth setup - how the pastor gets a login

### 3.1 Create the Supabase Auth user

Supabase Dashboard -> Authentication -> Users -> Add user -> Create new user.

- Email: the pastor's
- Password: set one
- **Tick "Auto Confirm User"**

The auto-confirm is not optional. An unconfirmed user cannot sign in with a
password, and `components/portal/login-form.tsx` deliberately does not
distinguish that case from a wrong password - it just says the details do not
match. You will spend an hour on it.

### 3.2 Run the membership insert

Copy `supabase/migrations/12_grant_portal_access.sql` verbatim. Change the email
in **two places** and the slug in **two places** - they are plain literals
because psql `\set` variables are a psql meta-command and do nothing in the
Supabase SQL editor.

Section 1 of that file is a precheck expecting exactly two rows: the auth user
and the church. If the auth user row is missing, stop - the file does not create
auth users, because password hashing is Supabase's job.

Section 2 reports:

```
rows_inserted = 1, target_matched = 1  -> access granted
rows_inserted = 0, target_matched = 1  -> already had access, fine
target_matched = 0                     -> email or slug did not match; nothing written
```

`role` is `'pastor'`. **Nothing enforces roles today** - every policy checks
membership, not role. It is a label for a permission model that does not exist
yet (PORTAL_SPEC open question 3).

### 3.3 What the pastor will hit

- **There is no signup.** Deliberately - a church portal is not something
  strangers register for. A valid Supabase login with no `church_members` row
  lands on `/portal/no-access`, which looks exactly like a bug if you are not
  expecting it.
- **FF-43: there is no password reset in the app.** No "forgot password" link,
  no recovery route, no email template. A locked-out pastor is stuck until
  someone resets the password in the Supabase dashboard.
- **And there is no change-password screen either.** Verified 2026-09-02:
  `supabase.auth.updateUser` is not called anywhere in `app/`, `components/` or
  `lib/`. So the password you set in 3.1 is the password the pastor has,
  permanently, unless you change it for them in the dashboard.

Say that out loud during handoff. The practical protocol until FF-43 is built:

1. Set a real password, not a placeholder. They cannot change it.
2. Send it over a channel that is not email if you can.
3. Tell them explicitly that a forgotten password means calling you, and that
   you can fix it in two minutes.

FF-43's fix needs a route, an email template and a recovery-token page, and it
needs the Brevo sender decided first - the default Supabase sender lands in spam
from a domain nobody recognises. It is not large, but it is real work, and
**FF-43's own deadline is "before Phase E provisions churches self-serve"**.
Onboarding church number two by hand is still inside that window. Onboarding
church number ten is not.

---

## 4. Vercel and the domain

### 4.1 Before the domain: the subdomain works immediately

From the moment the `churches` row exists, the church is live at
`{slug}.kingdom-creatives.com` - resolution rule 2 in `lib/tenant.ts`, which
needs `KC_ROOT_DOMAIN` set, and it is. This is the trial URL. Use it for
everything in section 6 before any DNS moves.

### 4.2 Add the domain to Vercel

Add **both** `newchurch.org` and `www.newchurch.org` to the
`kingdom-creatives-platform` project. If either is attached to another Vercel
project, Vercel reports a conflict and you must remove it there first.

Both forms matter. `normalizeHost()` strips a leading `www.` before resolution
rule 3 runs, and rule 3 checks the bare and `www.` forms of `custom_domain` - so
either resolves, **but only if Vercel is serving the hostname at all.**

**Check `churches.custom_domain` is populated before DNS moves, not during.** A
church whose column is null 404s on its own domain the moment DNS points at us.
It is rule 3 that carries the whole cutover.

### 4.3 DNS

Follow whatever Vercel shows for the apex - usually an A record, or ALIAS/ANAME
if the registrar supports it. `www` becomes a CNAME.

**Lower the TTL to 300s at least a day before**, so a rollback propagates in
minutes rather than hours. Restore it afterwards.

Then wait for certificates. Vercel issues them automatically once DNS resolves.
Do not test until the padlock is real - a certificate warning during the window
looks identical to a broken cutover and will send you chasing the wrong thing.

### 4.4 The subdomain redirect (optional, and only after section 6 passes)

308, subdomain to apex, `/portal` exempt. 308 not 302 because it is permanent
and preserves the method; `/portal` exempt because it is `noindex` already and
the pastor may be signed in on the subdomain mid-session.

This is the one part of onboarding that needs a **deploy**: it lives in
`vercel.ts` as a redirect with `has: [{ type: "host", value:
"{slug}.kingdom-creatives.com" }]`. See CUTOVER_PLAN.md step 5 and FF-37 for the
CFT precedent.

### 4.5 Environment variables

**Platform-level. Set once, shared by every church, never touched at
onboarding:**

| Variable | What |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the only two keys allowed in the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | " |
| `SUPABASE_SERVICE_ROLE_KEY` | server only, used sparingly |
| `KC_ROOT_DOMAIN` | `kingdom-creatives.com` - rule 2 needs it |
| `ANTHROPIC_API_KEY` | Sermon Builder, all tenants |
| `YOUTUBE_API_KEY` | sermon auto-pull, all tenants - see FF-53 |
| `ESV_API_KEY` | Bible reader, all tenants |
| `KC_BIBLE_PROVIDER` | which passage provider `/bible` uses |

**Environment-scoped knobs.** These are set differently in Production and
Preview and getting it backwards is quiet rather than loud. Do not touch them
when adding a church:

| Variable | Production | Preview / Dev |
|---|---|---|
| `KC_DEFAULT_CHURCH_SLUG` | **unset** | `church-for-truckers` |
| `KC_ALLOW_CHURCH_QUERY_OVERRIDE` | **unset** | `1` |

`KC_DEFAULT_CHURCH_SLUG` is the fallback for platform hosts only, and Vercel
assigns a `*.vercel.app` hostname to the *production* deployment too. Set it in
Production and that hostname serves one church's entire site under a name that
is not theirs - publicly reachable and indexable. **Do not repoint it at the new
church.** Leave it as it is. (README "Why the default slug is unset in
production" has the full argument.)

**Per-church environment variables: none. Zero. There are none today and you
should not add one.**

Everything tenant-specific is a database row - that is the design, and it is
what makes "add a church" a data change with no deploy. If you find yourself
wanting `NEWCHURCH_YOUTUBE_KEY`, that is FF-53's option 3 (per-tenant keys), it
is explicitly not built, and the shared key covers every tenant today.

---

## 5. What is CFT-specific and needs a decision

Be honest with yourself here. Three separate problems, three different costs.
None of them is blocking for church number two if that church happens to like
the aesthetic, and all of them are blocking for church number five.

### 5.1 Content that lives in code

| Thing | File | Size | Origin |
|---|---|---|---|
| 365 devotionals | `lib/devotionals.ts` | ~2,980 lines | Ported from YourLife CC (FF-30) |
| 30 worship songs | `lib/worship-playlist.ts` | 82 lines | Ported from YourLife CC (FF-54) |

Both are one church's curated content sitting in a TypeScript module because
there is nowhere else for it to come from. **A second church gets Church for
Truckers' devotionals and Church for Truckers' worship songs.** That is FF-54's
"blocking the day it has two", stated plainly.

They differ in one way that matters a lot, and it is why one of them is stage 0
and the other is not:

**The worship playlist is suppressible by data.** It renders inside the
`worship_filters` section, so omitting that section row for the new church
suppresses the songs with no code change. The cost is that it also suppresses
the video grid, which is the same section - so `/worship` becomes a hero and
nothing else. That is a real cost but it is a choice you can make per church,
today, in SQL.

**The devotionals are not.** See **stage 0** at the top of this document - the
gate is a prerequisite, already scoped, and must ship before church two exists.
Do not re-litigate it here.

What is left in this section is the longer-term version, which IS deferrable:

| Option | What it takes | Rough size |
|---|---|---|
| **A. Ship stage 0 and stop** - devotionals gated, worship suppressed per church by omitting a section row | the stage 0 change | half a day, and it is the minimum bar for a second church |
| **B. Move to tables** - `devotionals` and a worship/track table, per church, with portal tabs | two tables + RLS + a data migration of 365 + 30 rows + two portal CRUD tabs | several days. `supabase/drafts/05_devotionals.sql` is the deferred start of this |

Recommendation: **A before church two - it is stage 0 and it is mandatory. B
before church four.** B is the real fix and should not be rushed.
FF-54 records the one thing that makes B cheap when you get there:
`WorshipGrid` takes a `WorshipSong[]` and does not know where it came from, so
pointing the page at a query deletes the data file with nothing else to change.
Carry `artist` and `duration` across in the migration - they are hand-written
and the YouTube API does not return them in that form.

### 5.2 The trucker design language, in CSS

`app/(public)/site.css` (435 lines) and `app/(public)/site-overrides.css` (1,598
lines) are imported once, globally, in `app/(public)/layout.tsx`. There is no
per-church stylesheet. Every church currently gets this.

Roughly 69 lines across the two files carry a highway motif. The specific
ornaments, so you can find them:

| Ornament | Where | What it is |
|---|---|---|
| Mile-marker plates | `.mile`, `.mile::before` (`data-mm`), `.mile-stats` | Stat tiles stamped with "MM 38" like a highway marker |
| Driver's Log | `.logbook`, `.logbook-head/row/k/v`, overrides 16b | The service-times panel, styled as a trucker's logbook with dashed rules |
| Lane markings | `.eyebrow::before`, `.centerline`, `.timeline`, `@keyframes kc-lane` / `kc-lane-v` | Dashed gradients that animate sideways, like road markings going past |
| Off-ramp arc | `.give-band::before`, overrides ~1010 | A dashed arc sweeping out of the giving band |
| Marker cascade | overrides ~587-596 | Stat tiles arriving one after another on scroll, "like markers going past" |

How much of it is actually trucker-specific, honestly:

- **The Driver's Log is mostly neutral.** It is a timetable panel with a
  monospaced column. Rename it and it reads as a service-times card at any
  church - the label is data (`logbook_title`), and the code fallback is already
  the generic `"Service times"`. **Cost: rename in the seed. Zero code.**
- **The mile plates are half neutral.** The `data-mm` stamp is the trucker part;
  the tile is an ordinary stat tile. And the whole section is already
  `visible = false` for CFT (migration 31). **Cost: leave the section off, or
  drop one `::before` rule. Under an hour.**
- **The lane markings and the off-ramp arc are genuinely trucker-specific.**
  Dashed lines that slide sideways are road markings and read as nothing else.
  **Cost: they are decorative pseudo-elements and keyframes; deleting them
  degrades cleanly to plain rules and a static arc. Half a day including a
  visual pass on every page.**

| Option | Rough size |
|---|---|
| **A. Keep it** - the next church is also trucker-adjacent | zero |
| **B. Strip the motifs** - delete the lane keyframes, the off-ramp arc and the `data-mm` stamp; everything else is already neutral | half a day plus a visual regression pass |
| **C. Make it per-church** - a motif layer selected by a theme value, so CFT keeps its highway and the next church gets something else | 2-3 days, and it needs somebody to decide what the *other* motif is. Do not start this without a second design |

Recommendation: **B for church two.** C is a real product feature and should be
scoped as one, not smuggled into an onboarding.

### 5.3 The copy in the seed

The largest volume of CFT-specific material is not code at all - it is the prose
in `04_cft_sections_seed.sql`. "Three drivers, a thermos, and a tailgate." "Word
travels the CB faster than any church bulletin." "Built to sound right through
truck speakers." "Driver Stories" as a worship filter label. The About timeline
is a truck-stop origin story, start to finish.

**Cost: none, structurally.** It is all data and all replaced at seed time. The
only risk is copying it by reflex. Before you call section 2.5 done:

```
grep -niE "driver|truck|road|mile|highway|rig|cb |dispatch|convoy" <your new seed>.sql
```

Expect zero hits. Any hit is CFT's voice leaking into another church's website.

---

## 6. Verification checklist

Run all of it on the subdomain before DNS moves, then the domain-dependent parts
again on the apex after. Ground rule 4 - verify live, do not trust reports.

### 6.1 All 11 pages render

```
https://{slug}.kingdom-creatives.com/            200
                                     /about      200
                                     /visit      200
                                     /team       200
                                     /groups     200
                                     /events     200
                                     /sermons    200
                                     /worship    200
                                     /bible      200   (a passage renders)
                                     /devotionals 200   (see below)
                                     /give       200   (Give button has a real href)
                                     /nosuchpage 404
```

`/devotionals` is the one page where 200 is not automatically a pass. For a
church that is not meant to serve the devotional corpus, the pass condition is:
**no devotional body text in the served HTML, and no Devotionals link in the
header.** If you see either, stage 0 has not shipped, or it shipped and this
church was not gated. Do not launch past this.

A page returning its empty state is a pass. A page 404ing is not - it means the
slug is missing from `PAGES`, which would be a code problem, not a data one.

### 6.2 Nav resolves

Click every header nav link and every footer link on a phone-width viewport.
Specifically check the "Three ways in" cards on the home page and the buttons in
`about.about_ctas` - those are `get_connected.cards` and `about_ctas`, both
list-shaped, both seeded-only, and FF-46 is the entry for the time two of three
pointed at the wrong place. Check the anchor targets resolve, not just that the
links exist.

### 6.3 The RLS anon probe - ground rule 4a

**This is the check that has failed three times** (FF-27, FF-31, FF-42) and it
failed identically every time: the write succeeded, the portal said saved, and
the public page rendered nothing with no error anywhere. `tsc`, `eslint`,
`next build`, generated types and every page returning 200 all passed on each
occasion. They prove the query is well-formed. **Only an anon read proves it
returns anything.**

For a new church the rows already exist, so a plain anon read is a legitimate
probe - but only if you state the control. Per FF-35: a probe that cannot fail
is not a probe.

```sql
begin;

/* Owner's view - this is the CONTROL. Every count must be > 0, or the
   church was never seeded and the anon numbers below mean nothing. */
select 'owner' as role,
       (select count(*) from public.churches       where slug = 'new-church-slug')          as church,
       (select count(*) from public.church_sections s join public.churches c on c.id = s.church_id
         where c.slug = 'new-church-slug' and s.visible)                                     as sections,
       (select count(*) from public.church_links   l join public.churches c on c.id = l.church_id
         where c.slug = 'new-church-slug')                                                   as links,
       (select count(*) from public.church_theme   t join public.churches c on c.id = t.church_id
         where c.slug = 'new-church-slug')                                                   as theme;

set local role anon;

/* Anon's view - read it the way the public page reads it, through the
   embed on theme, not a bare select. */
select 'anon' as role,
       (select count(*) from public.churches       where slug = 'new-church-slug')          as church,
       (select count(*) from public.church_sections s join public.churches c on c.id = s.church_id
         where c.slug = 'new-church-slug' and s.visible)                                     as sections,
       (select count(*) from public.church_links   l join public.churches c on c.id = l.church_id
         where c.slug = 'new-church-slug')                                                   as links,
       (select count(*) from public.church_theme   t join public.churches c on c.id = t.church_id
         where c.slug = 'new-church-slug')                                                   as theme;

rollback;
```

**What a failing run looks like, stated before you run it:**

- any **owner** count is 0 -> the probe is broken and the anon row means
  nothing. Go back to section 2.
- **anon `church` = 0** -> almost certainly `status` is not `'active'`.
  Section 2.3.
- **anon `sections` = 0** while owner > 0 -> the sections are seeded
  `visible = false`, or the church is not active (the section policy chains
  through it).
- **anon `theme` = 0** while owner = 1 -> same status problem; the theme select
  policy is `church_id in (active churches)`.
- all four anon counts matching the owner counts -> pass.

Then do the same thing from outside the database, which is the part that
actually matters: load the public page and confirm the seeded text is in the
**served HTML**, not just in a query result. FF-46 was verified against the
served production HTML for exactly this reason.

### 6.4 Portal login works

Sign in as the pastor's account at `/portal`. Then:

- confirm you land on the portal home, not `/portal/no-access` (that means the
  `church_members` row is missing or points at the wrong church)
- **save one change** in Church Details and confirm it appears on the public
  site. This exercises the write policy, the column grants and the cache
  invalidation in one action.
- After the domain moves, **sign in again on the apex and save again.** The
  session cookie is domain-scoped; a portal that works on the subdomain and not
  on the apex is a cookie problem, and it is better found by you than by the
  pastor. This was a named step in the CFT cutover.

### 6.5 Prayer submission and moderation round trip

1. On the public site, submit a prayer request as an anonymous visitor.
2. In the portal's Prayer Wall, confirm it appears as pending.
3. Approve it. Confirm it appears on the public prayer wall.
4. Set another one to "Keep private". Confirm it does **not** appear publicly.

Step 4 is the one that matters. `private` is the status a pastor picks for a
request about a diagnosis or a marriage. Migration 27 is the transactional probe
that proved `private` and `archived` are invisible to anon; re-run it against the
new church id if you want the database-level proof as well as the visual one.

### 6.6 Sermon feed pulls

Only if the church gave you YouTube channels.

Load `/sermons`. Expect the channel's uploads, not just any manually-entered
rows. If you see only the manual rows, the `external_id` is a handle rather than
a `UC...` id - section 2.6. Remember the 60-second cache: wait a minute before
concluding anything.

If two or more channels are configured, the channel filter strip appears. Below
two channels it is hidden by design.

### 6.7 Payload sanity

View source on the home page and confirm:

- the 365-devotional array is **not** in the payload (it is server-only; one
  devotional's text should appear, not 365)
- no API key appears anywhere in the HTML or in `_next/static` - ground rule 6
  exists because the old WordPress system leaked a YouTube key client-side
- `x-church-*` headers are ours, and a forged inbound one is ignored

---

## 7. Known gaps that will bite

Do not restate these - read the entry. Listed in the order they are likely to
come up during or shortly after an onboarding.

| Gap | Entry | When it bites |
|---|---|---|
| No password reset, and no change-password screen either | **FF-43** | The first time a pastor forgets their password. Section 3.3 |
| List-shaped section fields cannot be edited in the portal | **FF-45**, **FF-57** | At seed time, and every time the pastor asks to reorder a card. Section 2.5 |
| `updateTag` is a no-op against `unstable_cache`; `revalidatePath` is doing the work | **FF-29**, **FF-49** | Not a live bug. It bites the next person who "tidies up" the redundant-looking `revalidatePath` and silently breaks read-your-own-writes across every tab |
| Legal pages are a template that no lawyer has read | **FF-50** | Before the second paying tenant. And immediately if any of the four verified factual claims stops being true |
| YouTube quota ceiling at roughly 100 tenants on one shared key | **FF-53** | Not now. But note the failure mode: quota exhaustion returns 403, every path returns `[]`, and a platform over quota looks exactly like a church that has not posted anything |
| Built sermons cannot be reopened for editing | **FF-61** | The first time the pastor revises a generated manuscript before Sunday |
| `/devotionals` serves one church's content to every tenant, with no data-level off switch | **FF-30** | **Church number two, as a launch blocker. Stage 0 is the fix and it ships before you seed** |
| Worship songs are one church's content in code | **FF-54** | Church number two. Suppressible per church by omitting `worship_filters`; section 5.1 for the real fix |
| Event times are UTC wall-clock, not real instants | **FF-38** | Any church not in the same offset assumptions as CFT |
| Media library is enumerable with the anon key | **FF-42** | Worth telling a pastor before they upload anything they consider private |

---

## 8. What does not exist yet

Stated plainly so nobody spends an afternoon looking for it:

- **There is no self-serve onboarding flow.** No waitlist, no signup, no
  provisioning wizard. The BUILD_BRIEF's Phase E promise of "waitlist -> new
  tenant in minutes" is unbuilt.
- **There is no admin "create church" UI.** There is no platform-admin surface
  at all. The portal is a single-church surface gated by `church_members`; there
  is nothing above it.
- **There is no church list, no tenant switcher, and no way to see how many
  churches exist** other than querying the database.
- **There is no rename or delete path.** No slug change, no domain change, no
  offboarding.
- **This runbook is the manual process standing in for all of it.**

Two design decisions already made in anticipation, worth knowing because they
are why provisioning is only SQL and not more:

- **Shared storage buckets, path-scoped** (migration 23 decision 1) - chosen
  specifically because a bucket per church is a provisioning step that needs
  elevated privileges and can fail half way, leaving a church that exists but
  cannot upload.
- **Legal pages as platform templates** (FF-50) - chosen so a new tenant has a
  working `/privacy` on day one with no data migration.

### Where the real thing would go

If the platform grows past a handful of churches, the manual process breaks at
roughly this order:

1. **FF-43 first, and on its own.** Password reset is the one self-service flow
   that must exist before churches are provisioned without a person attached to
   each one. It does not require any of the below, and it is the cheapest item
   on this list. Needs the Brevo sender decided first.
2. **A section-seed template.** The single most repetitive part of section 2 is
   34 rows of `church_sections`. That wants to be a `template_id` on `churches`
   (the column already exists and is unused) plus a template table, so a new
   church's sections are copied from a template row rather than hand-written -
   with a neutral, non-trucker default template alongside CFT's.
3. **FF-45 / FF-57, the list-field editor.** A `FieldKind: "list"` in the
   section editor. One build serves all six list-shaped sections and removes the
   "get it right at seed time or write SQL later" constraint that makes section
   2.5 slow.
4. **Section 5.1 option B**, moving devotionals and worship into per-church
   tables, so the seed template above is not lying about what the church serves.
   Stage 0 gates them; this is what actually gives a church its own.
5. **Then, and only then, an admin surface.** A "create church" form that runs
   the same steps this document describes, against the same tables, plus an
   invite that creates the auth user and the `church_members` row together. By
   that point steps 1-4 have removed everything about the process that needs a
   human judgment call, and what is left is a form.

Doing 5 before 1-4 produces a wizard that provisions a church nobody can log
back into, seeded with another church's copy, whose lists cannot be edited. That
is the order this list is in for a reason.

---

## Related documents

| Document | Read it for |
|---|---|
| `CLAUDE.md` | The ground rules. 0.3 (no SQL execution), 0.4a (anon probe), 0.8 (production risk) all apply to this whole runbook |
| `docs/CUTOVER_PLAN.md` | The CFT domain move, step by step. Section 4 here is its generalisation |
| `docs/FAST_FOLLOW.md` | Every FF entry referenced above |
| `docs/PORTAL_SPEC.md` | The settings model, and section 2 records which "missing" tables already exist |
| `docs/PASTOR_HANDOFF.md` | What to give the pastor once section 6 passes |
| `README.md` | Tenant resolution order and the production environment table |
| `supabase/drafts/README.md` | Draft conventions, and what has and has not been run |
