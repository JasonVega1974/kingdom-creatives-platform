# KINGDOM CREATIVES — MASTER TO-DO & CLAUDE CODE HANDOFF
Updated Jul 29, 2026. Companion to BUILD_BRIEF.md + ADDENDUM_01.
Prototypes are the spec: cft-site-orange.html (public site), cft-pastor-portal.html (portal).

=====================================================================
## A. JASON DOES (nobody else can)
=====================================================================

**A1. Repo setup (30 min)**
- [ ] Create private repo `kingdom-creatives-platform`
- [ ] Add: BUILD_BRIEF.md, ADDENDUM_01, this file, /prototypes/ (all 3 HTML files)
- [ ] Extract brief §0 ground rules into CLAUDE.md at repo root
- [ ] Put WP pulls (PHP/plugins from FileZilla) in separate folder `wp-legacy-reference/`
      marked READ-ONLY REFERENCE in its own README — never deployed, never imported

**A2. Supabase (project cyyxhhwuyeyvewqrhewt) — SQL editor, paste & run**
- [x] Run the schema inventory query (Claude drafts) → paste results back to Claude
- [x] Migration 01 APPLIED 2026-07-30 (new tables: pastor_notes, announcements,
      prayer_requests, groups, ministries, gifts, email_lists,
      contact_list_memberships; column adds: church_sections.page_slug,
      churches.giving_url + giving_mode + youtube_channel_id, contacts.type;
      plus RLS policies and increment_prayer_count) — verified live via
      `supabase gen types`, see supabase/migrations/01_kc_migration_01.sql
      - NOTE: `devotionals` was in the original list and is DEFERRED, not
        missing. ADDENDUM_01 decision B2 (pastor-authored table vs YourLife CC
        feed) is still open, so no table was created. `sermons.devotional`
        (text) exists in the meantime. B2 must be answered before the Phase B
        /devotionals route can be built.
- [x] CFT theme seed APPLIED 2026-07-30 — supabase/migrations/03_cft_theme_seed.sql
- [x] Decided 2026-09-01: no encryption. My Notes is church-shared (any portal
      member reads/writes any note), which is incompatible with content
      encrypted to one owner. `body`/`body_iv` are dropped in favor of
      `body_json` (TipTap JSON, sanitized by a closed extension allowlist
      rather than by encryption). See `supabase/drafts/33_notes.sql`.
- [ ] Decide B2: devotionals source (see note above) — blocks Phase B /devotionals

**A3. API keys → Vercel env vars (server-side only, never client)**
- [ ] ANTHROPIC_API_KEY or OPENAI_API_KEY — platform-level, powers Sermon Builder
      for ALL churches (churches never bring their own; sponsors fund this)
- [ ] YOUTUBE_API_KEY — platform-level; per-church channel ID lives in DB
- [x] Bible API — ESV key obtained (api.esv.org) → env var ESV_API_KEY
      - [ ] Store in password manager until Vercel project exists
      - [ ] ⚠ Verify Crossway license for commercial/multi-church platform use;
            request written permission before scaling beyond CFT
      - [ ] "ESV®" attribution notice required wherever text displays
      - [ ] Build Bible provider pluggable: ESV primary, WEB/KJV (public domain)
            fallback so licensing never blocks a launch
- [ ] BREVO_API_KEY (transactional email), STRIPE_SECRET_KEY + WEBHOOK_SECRET
      (platform account), SUPABASE_SERVICE_ROLE_KEY
- [ ] ⚠ The OpenAI key currently pasted into the WP portal: ROTATE IT after cutover
      (it lived in WordPress; treat as exposed — same lesson as the YouTube key leak)

**A4. Accounts/DNS (later, at cutover)**
- [ ] Vercel: add churchfortruckers.org when Phase C ships → flip DNS from Cloudways
- [ ] WP stays live until then; execute post-cutover WP security list before archiving

**A5. Kingdom Creatives business layer (not code)**
- [ ] KC waitlist landing page content: church waitlist + sponsor interest copy
- [ ] Sponsor one-pager: tiers, cost-per-church/year, what impact reporting looks like

=====================================================================
## B. CLAUDE CODE BUILDS (hand over in this order)
=====================================================================

**Phase A — Foundation** (prompt: "Read CLAUDE.md + BUILD_BRIEF.md + this file.
Build Phase A only, stop at acceptance criteria.")
- [ ] Next.js App Router + TS + Tailwind + shadcn/ui scaffold
- [ ] Middleware tenant resolution (hostname → church_id), Supabase clients,
      generated types from live schema
- [ ] Theme system: church_theme row → CSS variables
✅ Accept: preview URL renders CFT-branded page from live Supabase data

**Phase B — Public site** (spec = cft-site-orange.html, section by section)
- [ ] Componentize all pages incl. bulletin board (announcements + prayer wall with
      "I prayed" counts + request form → moderation queue), Get Connected strip,
      groups w/ meeting links, ministries on About, Bible page (API.Bible reader +
      YourLife CC bridge), full-bleed hero w/ desktop+mobile image pair
✅ Accept: churchfortruckers content renders 100% from DB; edit a row → site updates

**Phase C — Pastor Portal** (spec = cft-pastor-portal.html; THE product)
- [ ] Auth + church_members gate; sidebar shell exactly per prototype groups/labels
- [ ] Site editor: section toggles, drag reorder, autosave (~800ms debounce),
      LIVE preview, on-demand ISR revalidation
- [ ] Sermon Builder: streaming AI route (server-side key), output checkboxes,
      add-on builders, save to sermons, PDF export
- [ ] Library (+ nightly YouTube sync via Vercel Cron), Notes (encrypted),
      Announcements, Prayer Wall moderation (approve/keep-private, prayed counts),
      Groups & Studies (meeting_link), Ministries, Photos/Videos (drag-drop, resize),
      Send Emails (lists, CSV import, Brevo), Events + Calendar, Staff, Giving
      (Tithe.ly-link mode default / Stripe mode), Documents (private bucket),
      Help & Account (tickets → support_tickets, Connections card, sponsored-plan card)
✅ Accept: a non-technical pastor does the weekly loop (sermon → announce → event →
   email) with zero help; every change visible on the live site in seconds

**Phase D — Cutover:** content parity vs live WP → DNS flip → churches.status active
→ monitor 2 wks → archive WP → run A3 key rotation + WP security list

**Phase E — KC platform layer:** kingdom-creatives.com marketing + waitlist
(churches & sponsors), provisioning flow (waitlist → new tenant in minutes),
sponsor portal v1 (churches funded, impact stats), platform admin (all-church view,
global messaging per business plan §28)

=====================================================================
## C. PASTOR / BOARD PROVIDES (send whenever ready)
=====================================================================
- [ ] Team photos + real bios/roles  ·  real church history for About timeline
- [ ] Real ministries list (names, one-liners, links)  ·  real groups + meeting links
- [ ] Tithe.ly giving URL  ·  YouTube channel URL  ·  real prayer-line number
- [ ] Service times confirmation (times/zone)  ·  logo files (transparent PNG/SVG)
- [ ] Permission confirmed for any names on the public prayer wall

=====================================================================
## D. STANDING RULES (repeat in every Claude Code session)
=====================================================================
No force push · diffs before commit · no push without approval · schema changes as
SQL drafts for Jason to run manually · verify live, never trust reports · all API
keys server-side · wp-legacy-reference is read-only · straight ASCII quotes.
