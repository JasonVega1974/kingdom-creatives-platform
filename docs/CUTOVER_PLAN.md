# Phase D cutover plan

Moving `churchfortruckers.org` from the static launch site to this platform.

**Decided 2026-08-28:** go live before the content is complete. The pastor
manages the site through the portal anyway, and the empty states are his own
seeded words rather than errors. Waiting for a full site means waiting on a
person who has nothing to log into.

---

## What is true before we start

| Thing | State | Verified |
|---|---|---|
| `churchfortruckers.org` | Served by the **separate** Vercel project `kingdom-creatives` - the static launch site | CLAUDE.md rule 8 |
| `church-for-truckers.kingdom-creatives.com` | Serves this platform. Public site and portal both live | 2026-08-28, all 11 pages 200 |
| `churches.custom_domain` | `churchfortruckers.org` | Confirmed 2026-08-28 |
| `churches.status` | `active` | Confirmed 2026-08-28 |
| Production env | `KC_ROOT_DOMAIN` set; `KC_DEFAULT_CHURCH_SLUG` and `KC_ALLOW_CHURCH_QUERY_OVERRIDE` unset | Confirmed 2026-08-28 |

Rule 3 of the resolution order is what carries the cutover:
`churches.custom_domain` exact match, with and without `www.`. It is populated,
so the moment DNS points here the tenant resolves. That was the single largest
risk and it is closed.

---

## Preconditions - do not start until every one is true

1. **The pastor has signed in and changed something.** Not a formality. It
   proves his account works, the session survives, and a save reaches the
   database - before his own domain depends on it.
2. **The Give button points somewhere real.** `church_links` `kind = 'giving'`
   resolves to the Tithe.ly form. Currently seeded by draft 10; check it is
   still right.
3. **The Give page no longer says "Handled by Stripe."** Pastor-editable text,
   wrong since FF-32. Cutting over with a page naming the wrong payment
   processor is a small thing that looks careless.
4. **`npm run build` passes and the deploy is green.** The live subdomain is
   serving the same commit that is about to serve the apex.
5. **A recent Supabase backup exists.** Rule 8 stops being true at this point -
   see below.

---

## THE RULE THAT CHANGES

CLAUDE.md rule 8 currently says: *"running a draft in `supabase/drafts/` is not
a production change. No maintenance window, no cutover risk. That stops being
true at Phase D."*

**At cutover it stops being true.** After DNS moves, every draft is a
production change against a live church website. Update rule 8 in the same
commit as the cutover, not afterwards - a stale rule that says "this is safe"
is worse than no rule.

---

## Steps

### 1. Add the domain to this Vercel project

Add `churchfortruckers.org` **and** `www.churchfortruckers.org` to the
`kingdom-creatives-platform` project. Vercel will report a conflict: both are
currently attached to the `kingdom-creatives` static project. Remove them there
first.

Both forms matter. `normalizeHost()` strips a leading `www.` before rule 3
runs, and rule 3 checks the bare and `www.` forms of `custom_domain`, so either
resolves - but only if Vercel is serving the hostname at all.

### 2. Point DNS

Follow whatever Vercel shows for the apex - usually an A record, or ALIAS/ANAME
if the registrar supports it. `www` becomes a CNAME.

TTL: lower it to 300s **at least a day before**, so a rollback propagates in
minutes rather than hours. Restore it afterwards.

### 3. Wait for certificates

Vercel issues them automatically once DNS resolves. Do not test until the
padlock is real - a certificate warning during the window looks identical to a
broken cutover and will send you chasing the wrong thing.

### 4. Verify - before telling anyone

Every one of these, on the apex, not the subdomain:

```
https://churchfortruckers.org/            200, CFT content
https://www.churchfortruckers.org/        200, same
https://churchfortruckers.org/about       200, "Three drivers, a thermos..."
https://churchfortruckers.org/give        200, Give button to Tithe.ly
https://churchfortruckers.org/bible       200, a passage renders
https://churchfortruckers.org/portal      307 -> /portal/login
https://churchfortruckers.org/nosuchpage  404
```

Then **sign in to the portal on the apex** and save one change. The session
cookie is domain-scoped; a portal that works on the subdomain and not on the
apex is a cookie problem, and it is better found now than by the pastor.

### 5. The redirect (FF-37)

**Only after step 4 passes.** 308, subdomain to apex, `/portal` exempt.

- 308 not 302: permanent, and it preserves the method.
- Direction is the church's own domain - the subdomain is platform plumbing.
- The subdomain keeps working as a redirect forever, so links shared during the
  trial survive.
- **`/portal` is exempt.** It is `noindex` already, and the pastor may be signed
  in on the subdomain; redirecting would bounce him mid-session.

There is no `vercel.json` or `vercel.ts` in this repo yet, so this is the first
thing that needs one. A `vercel.ts` with a `has: [{ type: "host", value:
"church-for-truckers.kingdom-creatives.com" }]` redirect, skipping `/portal`.

Verify after: the subdomain 308s to the apex, `/portal` on the subdomain still
200s or 307s to login, and a signed-in portal session there survives.

---

## Rollback

Repoint DNS back to the `kingdom-creatives` static project. With a 300s TTL
that is minutes.

Nothing in the database needs undoing - the platform served the same content
before the cutover as after, on a different hostname. **That is the property
that makes this low-risk:** the cutover changes which hostname reaches the
platform, not what the platform does.

Do not remove the domain from the static project until a week has passed.
Re-adding it is fast, but not while under pressure.

---

## After

- **Update CLAUDE.md rule 8** - drafts are now production changes.
- **Restore the DNS TTL.**
- **Watch for a week.** The specific thing to watch is not errors, it is the
  tenant resolving: a request that reaches Vercel but matches no church renders
  a 404, and it would look like a broken page rather than a misconfiguration.
- **Archive the static site's source** if it is not already outside this repo.

---

## Known limitations at go-live

Stated so nobody discovers them under pressure:

| | Entry |
|---|---|
| Event times are UTC wall-clock, not real instants | FF-38 |
| No password reset - a locked-out pastor needs a dashboard reset | FF-43 |
| Devotionals page is deliberately contentless | FF-30 |
| Giving is Tithe.ly only; the seeded amount picker is not rendered | FF-32 |
| Media library is enumerable via the anon key | FF-42 |
| Orphaned storage objects have no sweeper | FF-41 |

None blocks the cutover. All are worth knowing before the phone rings.
