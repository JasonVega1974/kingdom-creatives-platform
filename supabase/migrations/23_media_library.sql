/* APPLIED 2026-08-28 against project cyyxhhwuyeyvewqrhewt.
   Moved from supabase/drafts/ after the run. History, not a to-do.
   Section 7 verified: both buckets with the right public flags, seven
   storage policies, church_media with RLS on and two policies, and all
   four composite FKs present - the do block matched every target, so
   there is no single-column FK and no cross-tenant hole. */

/* ============================================================
   DRAFT 23 - media library: storage buckets, church_media, links
   Project: cyyxhhwuyeyvewqrhewt
   Status:  APPLIED 2026-08-28.
   Requires: nothing. Safe to run now.

   >>> RUN THE SECTIONS SEPARATELY. Section 1 is an audit. <<<

   Upload once in the Photos tab, use anywhere. Every other tab that needs an
   image gets a picker over what is already uploaded, never its own uploader.

   ------------------------------------------------------------
   DECISION 1 - ONE BUCKET PER SENSITIVITY, NOT PER CHURCH
   (answers PORTAL_SPEC open question 2)
   ------------------------------------------------------------
   Two buckets, both shared by every church, with the church id as the first
   path segment:

     church-media      public   {church_id}/{uuid}.{ext}
     church-documents  private  {church_id}/{uuid}.{ext}   (Church Office, later)

   Why not a bucket per church:

     - Phase E promises "waitlist -> new tenant in minutes". A bucket per church
       is a provisioning step that needs elevated privileges and can fail
       half-way, leaving a church that exists but cannot upload. Path-scoped RLS
       gives identical isolation with no provisioning at all.
     - Bucket settings - size cap, MIME allow-list, public flag - are per
       bucket. One bucket is one place to set them. N buckets is N places to
       drift, and the drift is silent.
     - Supabase's own guidance is buckets for POLICY differences, not tenancy.

   Why sensitivity IS the right axis: a public bucket serves files with no auth
   at a stable URL; a private one needs a signed URL per request. That is a
   property of what the file is for, not of who owns it. next.config.ts already
   assumes this split - it allow-lists /storage/v1/object/public/** and its
   comment says the documents bucket is served through signed URLs.

   Isolation is enforced by policy on storage.objects, keyed on
   (storage.foldername(name))[1] - the first path segment - matching a church
   the user pastors. Section 3.

   ------------------------------------------------------------
   DECISION 2 - A NEW TABLE, NOT `gallery`
   ------------------------------------------------------------
   `gallery` is a DISPLAY COLLECTION: it has caption and sort_order and answers
   "what appears in the photo gallery on the website". An asset store answers
   "what has been uploaded". Those are different questions, and conflating them
   is exactly the failure to avoid - an event photo would appear in the public
   gallery because it had to be stored somewhere.

   So: `church_media` is the asset store, with `in_gallery boolean` marking the
   subset that also appears publicly. One row per file, one place to look.

   `gallery` currently has ZERO rows, no section in the seed, no renderer and no
   fetch in lib/collections.ts. It is dead weight today, so nothing migrates.
   This draft does NOT drop it - dropping a table with a live RLS policy is a
   separate, reversible-only-from-backup decision. It should be retired once
   church_media is proven. See FF-39.

   ------------------------------------------------------------
   DECISION 3 - LINK BY FK, NOT BY URL
   ------------------------------------------------------------
   Every table that needs an image ALREADY has a text column: events.image_url,
   staff.photo_url, groups.image_path, church_theme.logo_url. Storing the
   library's public URL in those would work, and would answer "what happens when
   an in-use image is deleted" with "nothing, the page breaks".

   So each gains a `media_id` instead, as a COMPOSITE foreign key to
   (id, church_id) - the same trick as draft 11's sermons.church_link_id. A
   single-column FK would let church A's event point at church B's photo, and
   RLS would not catch it: both rows pass their own church's policy and the only
   symptom is one church's event showing another church's picture.

   ON DELETE SET NULL, naming the column, so removing a photo leaves the event
   without an image rather than deleting the event. Postgres 15+ only, guarded
   in section 0.

   The old *_url columns are NOT dropped. They stay as a fallback for a
   hand-pasted link - the Our Team form already accepts one - with a defined
   precedence: media_id wins, url is used only when media_id is null. Same
   retirement shape as churches.giving_url. Documented so it does not become a
   second source of truth by accident.

   ------------------------------------------------------------
   WHAT THIS DOES NOT SOLVE - resizing
   ------------------------------------------------------------
   Not a SQL problem, but it is the one that decides whether the site is usable
   at a truck stop. Two separate problems, commonly confused:

     DELIVERY - already solved. next/image transforms remote images at request
       time and next.config.ts already allow-lists the Supabase public path.
       A 4MB original is served as a resized WebP/AVIF at the size actually
       displayed. Supabase Image Transformations would duplicate this and is a
       paid add-on; skip it.

     UPLOAD AND STORAGE - not solved, and the real cost. A phone photo is 3-5MB
       over truck-stop cell service, and it is stored at that size forever. The
       fix is a client-side downscale before upload: longest edge to 2000px,
       JPEG quality ~0.82, which takes a typical phone photo to 200-400KB with
       no visible loss at display sizes. That is portal code, not SQL.

   The bucket cap below is 10MB - generous on purpose, because it is a backstop
   against a mistake, not the mechanism. The client resize is the mechanism.
   ============================================================ */


/* ============================================================
   SECTION 0 - PRECONDITIONS
   ============================================================ */

do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception
      'Postgres 15+ required for ON DELETE SET NULL (col). Server is %.',
      current_setting('server_version');
  end if;
end
$$;


/* ============================================================
   SECTION 1 - AUDIT (read-only). Run alone, keep the output.

   Confirms the premise: the four target tables already have a text image
   column, gallery is empty, and neither bucket exists yet.
   ============================================================ */

select table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and column_name in ('image_url', 'photo_url', 'logo_url', 'image_path', 'media_id')
 order by table_name, column_name;

select 'gallery rows' as what, count(*)::text as value from public.gallery
union all
select 'church_media exists',
       coalesce(to_regclass('public.church_media')::text, 'no');

/* Buckets that already exist. Expect zero rows on a first run. */
select id, name, public, file_size_limit, allowed_mime_types
  from storage.buckets
 order by id;


/* ============================================================
   SECTION 2 - THE BUCKETS

   file_size_limit is a backstop, not the mechanism - the portal downscales
   before upload. 10MB leaves room for a legitimate large image without
   allowing a video by accident.

   allowed_mime_types excludes SVG deliberately. An SVG is a script container,
   and one served from our own origin in a public bucket is a stored-XSS
   vector. A church logo is a PNG.
   ============================================================ */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('church-media', 'church-media', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('church-documents', 'church-documents', false, 26214400,
   array['application/pdf', 'image/jpeg', 'image/png',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


/* ============================================================
   SECTION 3 - STORAGE POLICIES

   Isolation is by path: the first folder must be a church id the user pastors.
   (storage.foldername(name))[1] returns that segment.

   church-media is a PUBLIC bucket, so anonymous READ of an object by its URL
   does not consult these policies at all - that is what public means, and it is
   what lets next/image fetch it. The select policy below governs LISTING, which
   the Photos tab needs and a visitor does not.
   ============================================================ */

begin;

/* ---- church-media ---- */

drop policy if exists "church media: pastor list"   on storage.objects;
drop policy if exists "church media: pastor upload" on storage.objects;
drop policy if exists "church media: pastor update" on storage.objects;
drop policy if exists "church media: pastor delete" on storage.objects;

create policy "church media: pastor list"
  on storage.objects for select
  using (
    bucket_id = 'church-media'
    and (storage.foldername(name))[1] in (
      select cm.church_id::text from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  );

create policy "church media: pastor upload"
  on storage.objects for insert
  with check (
    bucket_id = 'church-media'
    and (storage.foldername(name))[1] in (
      select cm.church_id::text from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  );

create policy "church media: pastor update"
  on storage.objects for update
  using (
    bucket_id = 'church-media'
    and (storage.foldername(name))[1] in (
      select cm.church_id::text from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  )
  with check (
    bucket_id = 'church-media'
    and (storage.foldername(name))[1] in (
      select cm.church_id::text from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  );

create policy "church media: pastor delete"
  on storage.objects for delete
  using (
    bucket_id = 'church-media'
    and (storage.foldername(name))[1] in (
      select cm.church_id::text from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  );

/* ---- church-documents ----
   PRIVATE bucket, so the select policy is the only way in. Same predicate;
   read is restricted because there is no public URL to bypass it. */

drop policy if exists "church documents: pastor read"   on storage.objects;
drop policy if exists "church documents: pastor upload" on storage.objects;
drop policy if exists "church documents: pastor delete" on storage.objects;

create policy "church documents: pastor read"
  on storage.objects for select
  using (
    bucket_id = 'church-documents'
    and (storage.foldername(name))[1] in (
      select cm.church_id::text from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  );

create policy "church documents: pastor upload"
  on storage.objects for insert
  with check (
    bucket_id = 'church-documents'
    and (storage.foldername(name))[1] in (
      select cm.church_id::text from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  );

create policy "church documents: pastor delete"
  on storage.objects for delete
  using (
    bucket_id = 'church-documents'
    and (storage.foldername(name))[1] in (
      select cm.church_id::text from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  );

commit;


/* ============================================================
   SECTION 4 - church_media

   `storage_path` is the key, not a URL. A URL embeds the project ref and the
   public path shape, both of which are deployment details - storing the path
   means the URL is derived at render time and a project move is a config
   change rather than a data migration.
   ============================================================ */

begin;

create table if not exists public.church_media (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,

  /* Path inside the church-media bucket: {church_id}/{uuid}.{ext} */
  storage_path  text not null,

  /* What the pastor typed, so a picker can be searched. */
  title         text,
  /* Required for anything shown publicly. Empty string means decorative. */
  alt_text      text,

  /* Set at upload from the resized file, so a picker can show dimensions and
     a renderer can avoid layout shift without measuring. */
  width         int,
  height        int,
  byte_size     int,
  mime_type     text,

  /* Marks the subset that also appears in the public photo gallery. This is
     what keeps "uploaded" and "on display" separate - an event photo is in the
     library without being in the gallery. */
  in_gallery    boolean not null default false,
  gallery_order int not null default 0,

  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint church_media_path_unique unique (storage_path)
);

/* The picker's query: this church's library, newest first. */
create index if not exists church_media_church_idx
  on public.church_media (church_id, created_at desc);

/* The public gallery's query. Partial - most rows are not in the gallery. */
create index if not exists church_media_gallery_idx
  on public.church_media (church_id, gallery_order)
  where in_gallery;

/* Referenced by the composite FKs in section 6. Redundant against the primary
   key by definition, which is exactly why it is cheap. */
create unique index if not exists church_media_id_church_uidx
  on public.church_media (id, church_id);

alter table public.church_media enable row level security;

/* Public read is limited to gallery images of active churches. The library
   itself is not public: a pastor's unused uploads are not the church's photo
   gallery, and listing them anonymously would expose drafts. */
drop policy if exists "church_media: public gallery" on public.church_media;
create policy "church_media: public gallery"
  on public.church_media for select
  using (
    in_gallery = true
    and church_id in (
      select c.id from public.churches c where c.status = 'active'
    )
  );

drop policy if exists "church_media: pastor+ full" on public.church_media;
create policy "church_media: pastor+ full"
  on public.church_media for all
  using (
    church_id in (
      select cm.church_id from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  )
  with check (
    church_id in (
      select cm.church_id from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  );

commit;


/* ============================================================
   SECTION 5 - COLUMN GRANTS

   Supabase grants ALL on new public tables to anon and authenticated by
   default. anon needs SELECT only - it can never write here. Narrowing
   authenticated to the columns the portal writes follows draft 17's pattern:
   church_id and storage_path are set once at upload and must not be editable
   afterwards, or a pastor could re-point a row at another church's file.
   ============================================================ */

begin;

revoke insert, update, delete on public.church_media from anon;
revoke update on public.church_media from authenticated;

grant update (title, alt_text, in_gallery, gallery_order, updated_at)
  on public.church_media to authenticated;

commit;


/* ============================================================
   SECTION 6 - LINK THE FOUR TABLES

   Composite FK on (media_id, church_id) so the tenant is part of the key and
   a cross-church reference is refused by the database rather than merely
   discouraged. ON DELETE SET NULL names the column: the plain form would try
   to null church_id too, and that column is NOT NULL on every one of these.
   ============================================================ */

begin;

alter table public.events        add column if not exists media_id uuid;
alter table public.staff         add column if not exists media_id uuid;
alter table public.groups        add column if not exists media_id uuid;
alter table public.church_theme  add column if not exists logo_media_id uuid;

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('events',       'media_id',      'events_media_fkey'),
      ('staff',        'media_id',      'staff_media_fkey'),
      ('groups',       'media_id',      'groups_media_fkey'),
      ('church_theme', 'logo_media_id', 'church_theme_logo_media_fkey')
    ) as t(tbl, col, conname)
  loop
    if not exists (
      select 1 from pg_constraint
       where conrelid = format('public.%I', spec.tbl)::regclass
         and conname  = spec.conname
    ) then
      execute format(
        'alter table public.%I add constraint %I
           foreign key (%I, church_id)
           references public.church_media (id, church_id)
           on delete set null (%I)',
        spec.tbl, spec.conname, spec.col, spec.col
      );
    end if;
  end loop;
end
$$;

commit;


/* ============================================================
   SECTION 7 - VERIFY

   Expect:
     - two buckets, church-media public = true, church-documents public = false
     - seven storage policies
     - church_media with 2 policies and RLS on
     - four composite FKs, each ON DELETE SET NULL on its own column
     - authenticated UPDATE on church_media limited to 5 columns
   ============================================================ */

select id, public, file_size_limit, array_length(allowed_mime_types, 1) as mime_count
  from storage.buckets
 where id in ('church-media', 'church-documents')
 order by id;

select polname as policy_name,
       case polcmd when 'r' then 'select' when 'a' then 'insert'
                   when 'w' then 'update' when 'd' then 'delete' else polcmd::text end as cmd
  from pg_policy
 where polrelid = 'storage.objects'::regclass
   and polname like 'church %'
 order by polname;

select c.relname as table_name,
       case when c.relrowsecurity then 'on' else 'OFF' end as rls,
       p.polname as policy_name
  from pg_class c
  left join pg_policy p on p.polrelid = c.oid
 where c.oid = 'public.church_media'::regclass
 order by p.polname;

select conname as constraint_name, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conname in ('events_media_fkey', 'staff_media_fkey', 'groups_media_fkey',
                   'church_theme_logo_media_fkey')
 order by conname;

select privilege_type, string_agg(column_name, ', ' order by column_name) as columns
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name = 'church_media'
   and grantee = 'authenticated'
   and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
 group by privilege_type
 order by privilege_type;
