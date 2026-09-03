---
name: onboarding-a-church
description: Use when adding, provisioning, seeding or launching a new church tenant on the Kingdom Creatives platform, or when a newly created church shows symptoms - public site 404s on its own domain, portal login lands on /portal/no-access, a successful save reports as a refusal, /sermons shows only manual rows, or a page renders another church's copy.
---

# Onboarding a church

## Overview

Adding a church to this platform is a **data change, not a deploy**. No code
ships, no environment variable is added, no bucket or RLS policy is created.
Five tables get rows, one Supabase Auth user is created, one domain is pointed.

**The full runbook is `docs/ONBOARDING.md`.** Read it before doing any of this -
it has the SQL, the model files to copy from, and the verification checklist.
This skill is the set of trip-wires that cost the most when missed.

## Stop - there is a code change that comes first

**Before seeding any church other than Church for Truckers, ship the stage 0
devotionals gate.** `/devotionals` renders CFT's 365 devotionals for every
tenant - `page-collection.tsx` gates on `pageSlug === "devotionals"` and nothing
else - and `/devotionals` is a hardcoded entry in the platform-wide public nav
in `site-header.tsx`. There is no section row, flag or portal toggle that turns
it off. A second church launched without this publishes another organisation's
devotional writing under their own name, on a page their own header advertises.

It is a launch blocker, not a design decision. `docs/ONBOARDING.md` stage 0 has
the scope: one conditional in `page-collection.tsx`, one filter in
`site-header.tsx`, roughly half a day with the verification pass.

Contrast the worship playlist, which is genuinely deferrable: it renders inside
the `worship_filters` section, so omitting that row suppresses it with no code
change.

## When to use

- Adding a second (or fifth) church to `cyyxhhwuyeyvewqrhewt`
- A pastor asks "what do you need from me?" - section 1 of the runbook is that list
- Debugging a church that was created but does not behave
- Deciding whether something belongs in a table, in code, or in an env var

Not for: editing an existing church's content (that is the portal), or anything
about Church for Truckers specifically once it is running.

## The five tables, in order

| Table | Model file to copy | Note |
|---|---|---|
| `churches` | `migrations/01` section 5 | `01` and `03` are UPDATEs because CFT's rows pre-existed. A new church needs INSERTs |
| `church_theme` | `migrations/03` | Optional - `lib/theme.ts` falls back to `DEFAULT_THEME` |
| `church_sections` | `migrations/04` | 34 rows, 11 pages. The bulk of the work |
| `church_links` | `migrations/10` | The `giving` row is required to launch |
| `church_members` | `migrations/12` | Auth user must exist first, auto-confirmed |

Ground rule 0.3 is unchanged: draft into `supabase/drafts/`, Jason runs it,
results come back. Block comments, sections run separately, expected before and
after stated. Every one of these is a production change (ground rule 0.8).

## Trip-wires

**`churches.status` must be `'active'`.** Both public select policies are
`using (status = 'active')` (migration 17). Anything else and the public site
404s with nothing in any log, and per FF-28 a successful portal write reads back
zero rows and is reported to the pastor as a refusal. There is no "draft church"
state - pre-launch means `active` with `custom_domain` null.

**`churches.custom_domain` must be populated BEFORE DNS moves.** Tenant
resolution rule 3 is what carries a cutover. A null column means the church 404s
on its own domain the moment DNS points here.

**`church_links.external_id` for a video link is the `UC...` channel ID, not the
`@handle`.** Migration 29 exists because of this. Every failure path in
`lib/youtube.ts` returns `[]`, so a wrong id renders the ordinary empty state and
looks like a church that has not posted anything. Allow 60s of link cache before
concluding anything.

**Auto Confirm User when creating the auth user.** An unconfirmed user cannot
sign in, and the login form deliberately does not distinguish that from a wrong
password.

**List-shaped section fields cannot be edited in the portal** (FF-45, FF-57):
`faq.items`, `timeline.stops`, `beliefs.items`, `expect.items`,
`mile_stats.items`, `other_ways.items`, `get_connected.cards`. Whatever is
seeded is permanent until someone writes more SQL. Get them signed off by the
pastor before seeding.

**Per-church environment variables: there are none, and do not add one.** Every
key is platform-level and already set. Do not repoint `KC_DEFAULT_CHURCH_SLUG` -
it is unset in Production on purpose.

**Never seed invented statistics.** CFT's `mile_stats` were prototype numbers
that were untrue of the church and had to be switched off by migration 31.

## Verify, do not report

Ground rule 4a. `tsc`, `eslint`, `next build` and every page returning 200 have
all passed while the public page rendered nothing (FF-27, FF-31, FF-42). Only an
anon read proves a row comes back. The runbook's section 6.3 has a probe with a
stated control and stated failure output - a probe that cannot fail is not a
probe (FF-35).

## Before calling it done

Grep the new seed for CFT's voice:

```
grep -niE "driver|truck|road|mile|highway|rig |cb |dispatch|convoy" <new seed>.sql
```

Expect zero hits. Any hit is CFT's voice leaking into another church's website.

Then confirm the stage 0 gate held: load `/devotionals` on the new church and
check the **served HTML** has no devotional body text and the header has no
Devotionals link - with CFT still serving both as the control. A blank page on
both means you broke it for everyone, not that the gate works (FF-35).
