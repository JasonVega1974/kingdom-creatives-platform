/* ============================================================
   DRAFT 24 - church_media public read is too narrow (FF-42)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Requires: draft 23 (applied 2026-08-28).

   >>> RUN THE SECTIONS SEPARATELY. Section 4 is the probe. <<<

   ------------------------------------------------------------
   WHAT IS WRONG
   ------------------------------------------------------------
   Draft 23 gave church_media this public policy:

     using (in_gallery = true and church_id in (active churches))

   That was written for the photo GALLERY and then reused, without checking,
   as the policy for every public read of the table. The media picker made the
   difference matter: a photo chosen for a team member or an event, and not
   ticked into the gallery, is invisible to anon. The PostgREST embed returns
   null, the image does not render, and nothing anywhere reports an error.

   Write succeeds, portal says saved, public page shows nothing. The same shape
   as FF-27 and FF-31, for the third time.

   ------------------------------------------------------------
   THE DECISION - expose the row, keep in_gallery for the gallery
   ------------------------------------------------------------
   The alternative was a policy admitting only rows referenced by something
   already public - four EXISTS subqueries against events, staff, groups and
   church_theme. Rejected, for one reason that outweighs its tightness:

     IT FAILS SILENTLY THE NEXT TIME. Add a fifth table that references
     church_media, forget to widen the policy, and images vanish from the
     public site with no error - the exact failure this file exists to fix,
     re-armed. It would also need an index on each media_id column and would
     run four subqueries per row.

   And it protects little. THE BUCKET IS PUBLIC: the file is served without
   auth to anyone holding the URL, whatever this policy says. The policy
   governs the METADATA ROW, not the image.

   What is genuinely given up: the library becomes enumerable. Someone with the
   anon key can list every photo a church has uploaded, including one uploaded
   and never used. Previously such a photo's URL was guessable-ish rather than
   discoverable. That is a real reduction and is recorded in FF-42 rather than
   waved away - if it ever matters, the fix is a private bucket with signed
   URLs for unreferenced media, which is a bigger change than a policy.

   Section 3 removes the one genuinely sensitive column from anon's reach:
   `uploaded_by` is a user id and has no business being public.

   SAFE TO RUN TWICE.
   ============================================================ */


/* ============================================================
   SECTION 1 - BEFORE (read-only)

   Expect one public policy reading `in_gallery = true AND ...`, and anon
   holding SELECT on every column including uploaded_by.
   ============================================================ */

select polname as policy_name,
       pg_get_expr(polqual, polrelid) as using_expr
  from pg_policy
 where polrelid = 'public.church_media'::regclass
 order by polname;

select privilege_type, string_agg(column_name, ', ' order by column_name) as columns
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name = 'church_media'
   and grantee = 'anon'
 group by privilege_type
 order by privilege_type;


/* ============================================================
   SECTION 2 - THE POLICY

   Every media row of an active church is readable. `in_gallery` stops being a
   read gate and goes back to meaning only what it was named for: whether this
   photo also appears in the public photo gallery. The gallery query filters on
   it; nothing else needs to.
   ============================================================ */

begin;

drop policy if exists "church_media: public gallery" on public.church_media;
drop policy if exists "church_media: public read"    on public.church_media;

create policy "church_media: public read"
  on public.church_media for select
  using (
    church_id in (
      select c.id from public.churches c where c.status = 'active'
    )
  );

commit;


/* ============================================================
   SECTION 3 - NARROW WHAT ANON CAN SEE

   The row is public; the uploader's identity is not. `uploaded_by` is an
   auth.users id and nothing on the public site reads it.

   Revoking a column from anon means a `select *` as anon now FAILS rather
   than silently omitting it. That is the right direction - loud beats quiet -
   and no public query uses `*`: lib/church.ts and lib/collections.ts embed
   named columns only.
   ============================================================ */

begin;

revoke select (uploaded_by) on public.church_media from anon;

commit;


/* ============================================================
   SECTION 4 - PROBE (rolls back)

   Written per FF-35: seed BOTH states, read as the role under test, and state
   in advance what a failing run looks like.

   Expect:
     anon_sees_gallery = 1    a gallery photo is readable
     anon_sees_plain   = 1    <-- THE FIX. Was 0 before this draft.
     anon_sees_uploader errors or is null, per section 3

   If anon_sees_plain comes back 0, section 2 did not take and the picker is
   still broken on the public site.
   ============================================================ */

begin;

insert into public.church_media
  (church_id, storage_path, title, in_gallery)
values
  ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'probe/gallery.jpg', 'Probe gallery', true),
  ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'probe/plain.jpg',   'Probe plain',   false);

set local role anon;

select
  (select count(*) from public.church_media where storage_path = 'probe/gallery.jpg')
    as anon_sees_gallery,
  (select count(*) from public.church_media where storage_path = 'probe/plain.jpg')
    as anon_sees_plain;

rollback;


/* ---- 4b. The embed the public site actually performs. ----

   Reads through staff exactly as lib/collections.ts does. This is the query
   that was returning null, and the one that has to come back non-null.

   Expect: one row, media_path = 'probe/embed.jpg'. A null media_path means the
   embed still cannot see the media row. */

begin;

insert into public.church_media (church_id, storage_path, title, in_gallery)
values ('36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'probe/embed.jpg', 'Probe embed', false);

/* The id is looked up by storage_path rather than captured with \gset - that
   is a psql meta-command and does nothing in the Supabase SQL editor, the same
   trap noted in draft 12. */
insert into public.staff (church_id, name, visible, sort_order, media_id)
select '36cb9fdf-4ca1-414f-a206-c3885e07ed5a', 'Probe Person', true, 997, m.id
  from public.church_media m
 where m.storage_path = 'probe/embed.jpg';

set local role anon;

select s.name,
       m.storage_path as media_path
  from public.staff s
  left join public.church_media m on m.id = s.media_id and m.church_id = s.church_id
 where s.name = 'Probe Person';

rollback;


/* ============================================================
   SECTION 5 - VERIFY
   ============================================================ */

select polname as policy_name,
       pg_get_expr(polqual, polrelid) as using_expr
  from pg_policy
 where polrelid = 'public.church_media'::regclass
 order by polname;

select privilege_type, string_agg(column_name, ', ' order by column_name) as columns
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name = 'church_media'
   and grantee = 'anon'
 group by privilege_type
 order by privilege_type;
