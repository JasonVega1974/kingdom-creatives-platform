# Pastor Portal - settings model and tab spec

Phase C. Companion to `docs/BUILD_BRIEF.md`, `ADDENDUM_01` and
`KC_MASTER_TODO.md`. The visual spec remains `prototypes/cft-pastor-portal.html`.

Network-wide. Every church on the platform uses this. Church for Truckers is
the first tenant, not a special case.

---

## 1. Design principles (from Jason, Aug 2026)

1. **Nothing is a single-value field if a church could plausibly have two.**
   CFT has two YouTube channels on day one. Assume the same for campuses,
   service locations and giving links.
2. **Platform-agnostic integrations.** Store `{platform, url}`, never
   `tithely_form_id`. The next church uses Givelify.
3. **One canonical settings source per church.** The WordPress portal had
   `pp_primary_color`, `pastor_portal_primary_color` and `primary_color` all
   live at once with fallback guessing. One home per fact, defaults resolved
   in code.
4. **Same shape in and out.** Whatever provisioning writes is the exact shape
   the portal edits afterward. This is what broke before: intake data died at
   launch because no editor existed for it.

---

## 2. Schema reconciliation - READ THIS BEFORE ADDING TABLES

The Aug 2026 spec proposed four tables: `church_settings`, `church_links`,
`church_services`, `church_staff`. Checked against the live schema
(`types/database.ts`, generated from project `cyyxhhwuyeyvewqrhewt`), **three
of the four already have a home.** Adding them as proposed would create a
second source of truth for facts that already exist - principle 3 violated by
the very migration meant to enforce it.

| Proposed | Verdict | Lives in today |
|---|---|---|
| `church_settings.identity` | **Already exists** | `churches`: `name`, `tagline`, `address`, `phone`, `email`, `custom_domain`, `slug` |
| `church_settings.branding` | **Already exists** | `church_theme`: `color_primary`, `color_secondary`, `color_accent`, `font_heading`, `font_body`, `logo_url` |
| `church_settings.content` | **Already exists** | `church_sections`: `(page_slug, section_key, content jsonb, visible, sort_order)` |
| `church_settings.features` | **Already exists** | `church_sections.visible` - a feature toggle IS a section toggle |
| `church_settings.seo` | Genuinely missing | nowhere - see 2.1 |
| `church_settings.updated_by` | **Already exists** | `church_sections.updated_by` |
| `church_services` | **Already exists** | `churches.service_times` (jsonb array), typed as `ServiceTime[]` in `lib/church.ts` |
| `church_staff` | **Already exists** | `staff`: `name`, `role_title`, `bio`, `photo_url`, `email`, `phone`, `sort_order`, `visible` |
| `church_links` | **Genuinely missing - build it** | nothing. `churches.youtube_channel_id` and `churches.giving_url` are single-valued and already wrong for CFT |

**Conclusion: one new table, not four.** `supabase/drafts/09_church_links.sql`.

### 2.1 The two real gaps

- **SEO** (`meta_title`, `meta_description`, `og_image_url`). No home today.
  Deferred, not dropped: it is three fields and belongs on `churches`, and no
  portal tab needs it before cutover. Draft the `alter table` when the SEO tab
  is built, not before.
- **Multi-valued links.** Solved by `church_links`.

### 2.2 Why `church_sections` carries both content and feature toggles

The WordPress `site-management.php` tab was 128 flat option keys of the form
`sm_{page}_{section}_{field}` - `sm_visit_expect_col2_title`,
`sm_home_beliefs_show`, and so on. Every one of them decomposes cleanly into
`(page_slug, section_key, content, visible)`. The live schema is already the
right generalisation of the thing being replaced; the intake form's 24 feature
checkboxes are the same fact at page granularity.

So: **a feature toggle is a section toggle.** No separate `features` map, no
defaults map to drift out of sync with the section registry. The registry of
known sections lives in code (`lib/portal/sections.ts`), the per-church on/off
state lives in `church_sections.visible`.

### 2.3 Deprecation path for the single-valued columns

`churches.youtube_channel_id` and `churches.giving_url` stay for now - Phase B
code reads them. Once `church_links` is populated and the public site reads it
instead, they get dropped in a migration. Until then the rule is:

> **`church_links` is the source of truth. The `churches` columns are a derived
> cache of the `is_primary` row and are never edited by hand.**

Tracked so it does not become permanent. Two sources for one fact is the exact
bug this document exists to prevent.

---

## 3. `church_links`

See `supabase/drafts/09_church_links.sql` for the DDL. Shape:

| Column | Notes |
|---|---|
| `kind` | `social` / `video` / `giving` |
| `platform` | `youtube`, `facebook`, `instagram`, `x`, `tiktok`, `tithely`, `givelify`, `pushpay`, ... free text |
| `label` | pastor-facing AND public-facing - "Sunday Preaching", "Bible Study" |
| `url` | |
| `external_id` | channel handle, playlist id, Tithe.ly formId. Nullable |
| `sort_order` | |
| `is_primary` | at most one per `(church_id, kind)`, enforced by a partial unique index |

CFT seed: `supabase/drafts/10_cft_links_seed.sql`.

---

## 4. Tabs

Sidebar groups and labels come from `prototypes/cft-pastor-portal.html` and are
not to be renamed - they are written for a non-technical reader.

| Group | Tab | Writes to |
|---|---|---|
| This week | Home | read-only dashboard |
| Preach | Sermon Builder | `sermons` |
| Preach | Sermon Library | `sermons` |
| Preach | My Notes | `pastor_notes` |
| Your website | Edit My Website | `church_sections` |
| Your website | Church Details | `churches`, `church_theme`, `church_links` |
| Your website | Photos | `gallery` |
| Your website | Videos | `videos`, `church_links` (kind: video) |
| Your website | Announcements | `announcements` |
| Your website | Prayer Wall | `prayer_requests` |
| Your website | Groups & Studies | `groups` |
| Your website | Ministries | `ministries` |
| People | Send Emails | `email_lists`, `contacts`, `contact_list_memberships` |
| People | Events | `events` |
| People | Calendar | `events` (read) |
| People | Our Team | `staff` |
| Church office | Giving | `church_links` (kind: giving), `gifts` |
| Church office | Documents | `documents` |
| Church office | Help & Account | `support_tickets`, auth, `church_members` |

"Church Details" is an addition to the prototype's sidebar: identity, service
times, branding and social links have no tab in the prototype, and they are
exactly the data the WordPress portal stranded at launch.

---

## 5. Simplicity target

A pastor who is not technical changes their service time or swaps a logo
without asking for help.

- Plain labels, never field names. "Big welcome banner", not `page_hero`.
- Live preview where it is cheap.
- Never expose an id or a URL slug the pastor did not type themselves.
- Autosave, ~800ms debounce, with an explicit "Saved and live on the website".
- Every change reversible. The prototype promises "You cannot break anything" -
  that is a product commitment, so destructive actions confirm and soft-delete.

---

## 6. Open questions

Carried from Jason's spec. None of these block the shell or the section editor.

1. ~~**Sermons** - which channel is a sermon from?~~ **Decided 2026-08-27:**
   a nullable `sermons.church_link_id` FK to `church_links`, not a channel enum
   and not a second `youtube_channel_id` column. It reuses the multi-channel
   model, a third channel needs no migration, and the pastor-facing label comes
   free from `church_links.label`. Nullable so a manually added sermon, or one
   predating channel setup, is never blocked.
   SQL: `supabase/drafts/11_sermons_church_link.sql`.
   The FK is composite - `(church_link_id, church_id)` references
   `church_links (id, church_id)` - so a sermon cannot point at another
   church's channel. RLS would not have caught that on its own.
   Still open underneath it: **auto-sync from YouTube or manual entry?** The
   column serves both, so this no longer blocks the table shape.
2. **Media uploads** - one Supabase Storage bucket per church, or one bucket
   with church-scoped paths? Decides the RLS policy shape.
3. **Roles** - pastor-only, or pastor + staff with narrower permissions?
   `church_members.role` exists and is currently unused by any policy: every
   migration 01 policy checks membership, not role. Designing this properly is
   better than porting the WordPress approval state machine, which was broken
   enough to need `kc-admin-bypass.php` as a workaround.
4. **Content editor** - textarea, markdown, or rich text for
   About/Mission/Vision/Beliefs?
