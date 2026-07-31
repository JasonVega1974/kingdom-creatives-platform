# BUILD BRIEF ADDENDUM 01 — Multi-Page Sitemap & Schema Expansion

Extends BUILD_BRIEF.md. Where this conflicts with the original, this wins.
Ground rules in §0 of the main brief still apply — especially §0.3: every schema
change below ships as draft SQL for Jason to run in the Supabase SQL editor first.
Nothing here assumes any SQL has been executed.

---

## A. Architectural change: pages, not a page

The public site becomes multi-page. `church_sections` gains a page dimension so
every page is built from the same section-renderer + autosave + live-preview
machinery — one editor pattern, N pages.

**Schema change (draft SQL required):** add `page_slug text not null default 'home'`
to `church_sections`, plus an index on `(church_id, page_slug, sort_order)`.
Alternative considered and rejected for v1: a separate `church_pages` table —
adds a join and a portal concept without buying much until churches can create
arbitrary pages. Revisit in v2.

Routing: `(public)/[[...page]]/page.tsx` — resolves tenant from hostname (as
before), then page from the path. Unknown page slug → themed 404.

## B. Public sitemap (v1)

| Route | Page | Data source | Status |
|---|---|---|---|
| `/` | Home | church_sections (page_slug='home') | prototype done |
| `/about` | About Us | church_sections ('about') | sections only |
| `/visit` | Plan a Visit | church_sections ('visit') + form → contacts | needs `contacts.type` column |
| `/team` | Our Team | staff | existing table |
| `/groups` | Groups | **new `groups` table** | SQL needed |
| `/groups` signup | — | form → contacts (type='group') or group_signups | decide; contacts is simpler v1 |
| `/events` | Events index | events | existing table |
| `/events/[id]` | Event detail | events | existing table |
| `/sermons` | Sermons index | sermons (search + series filter) | existing table |
| `/sermons/[id]` | Sermon detail | sermons | existing table |
| `/worship` | Worship Library | videos | existing table |
| `/bible` | Bible | external reader embed (API.Bible or similar) + YourLife CC bridge | decision B1 |
| `/devotionals` | Devotionals index | **new `devotionals` table** (or YourLife CC feed — decision B2) | SQL needed |
| `/devotionals/[id]` | Devotional | same | — |
| `/give` | Give | existing giving spec, full page | as specced |

Header nav condenses into groups: **Visit · Watch (sermons/worship) · Connect
(groups/events/team) · Grow (bible/devotionals) · Give** — 12 pages can't be 12
nav links.

## C. New tables — draft SQL checklist (Jason runs, pastes results back)

1. `groups` — id, church_id (FK), name, description, meeting_day, meeting_time,
   frequency, location_type (in_person|phone|video), location_detail, leader_name,
   image_path (gallery ref), visible, sort_order, timestamps. RLS: public read
   where visible; church_members write, scoped by church_id (mirror existing
   table policies).
2. `devotionals` — id, church_id, title, body (rich text/markdown), scripture_ref,
   author_name, published_at, visible, timestamps. Same RLS pattern.
   ⚠ Only if decision B2 = "pastor-authored". If B2 = "YourLife CC syndication",
   this table is deferred and /devotionals reads from a feed instead.
3. `contacts` — ALTER: add `type text not null default 'general'`
   (general | visit | prayer | group). Powers Plan-a-Visit and group signups
   with zero new tables.
4. Confirm `videos` columns fit Worship Library needs (title, youtube_id/url,
   category, date, visible, sort_order). If category is missing, one ALTER.

## D. Decisions needed before building these pages

- **B1 — Bible page:** clean reader embed (API.Bible free tier or bible-api.com)
  vs. link-out vs. YourLife CC scripture surface. Recommendation: embed reader
  for v1 + a "Go deeper" module linking YourLife CC — the funnel play.
- **B2 — Devotionals source:** pastor-authored per church (new table + portal
  tab) vs. syndicated from YourLife CC content (platform-level differentiator,
  less pastor workload) vs. both (church can override). Recommendation: start
  pastor-authored (simple, RLS-clean), design the schema so a `source` column
  can mark syndicated rows later.
- **B3 — Group signups:** contacts-with-type (recommended v1) vs. dedicated
  group_signups join table (needed only when capacity/rosters matter).

## E. Portal changes

Sidebar becomes: **Pages** (page picker → section editor with autosave + live
preview, same component for every page), **Theme, Sermons, Worship, AI builder,
Events, Groups, Devotionals, Staff, Gallery, Contacts, Giving, Documents.**

- "Pages" replaces "Site editor" — same editor, plus a page dropdown.
- Contacts tab gains a type filter (Visit requests surfaced first — those are
  the hot leads for a church).
- Groups + Devotionals tabs are standard CRUD using the shared Autosave/
  UploadZone components; no new patterns.
- Every image anywhere = gallery-bucket UploadZone; every text block =
  autosave field. No page has a "call the developer" zone.

## F. Phase impact

- Phase 2 (public site) splits: **2a** Home (done as prototype → componentize),
  **2b** content pages (about/visit/team/give), **2c** collection pages
  (sermons/worship/events/groups/devotionals + details), **2d** Bible page.
- Phase 3–4 absorb the portal additions (Pages picker, Groups, Devotionals,
  Worship tabs).
- New tables land at the start of 2c as draft SQL.

## G. Open questions (append to §9)

6. B1/B2/B3 above.
7. Does `videos` have a category/type column for worship vs. other content?
8. Plan-a-Visit: does CFT want a scheduling element ("I'm coming Aug 9") or
   just a contact form? v1 recommendation: form only.
