-- APPLIED to project cyyxhhwuyeyvewqrhewt. Confirmed present in the live
-- schema on 2026-07-30 (all tables, columns, RLS policies and the
-- increment_prayer_count function verified via supabase gen types).

-- ============================================================
-- KINGDOM CREATIVES — MIGRATION 01
-- Project: cyyxhhwuyeyvewqrhewt
-- Run in: Supabase SQL Editor → New query → paste → Run
-- Jason reviews and runs manually. Never auto-executed.
-- ============================================================

-- ============================================================
-- 1. ALTER EXISTING TABLES — column additions only
--    All use IF NOT EXISTS pattern so safe to re-run
-- ============================================================

-- church_sections: which page this section belongs to
alter table public.church_sections
  add column if not exists page_slug text not null default 'home';

comment on column public.church_sections.page_slug is
  'Page this section belongs to: home | about | visit | give | etc.';

create index if not exists idx_church_sections_page
  on public.church_sections (church_id, page_slug, sort_order);

-- churches: all the fields the portal needs
alter table public.churches
  add column if not exists name              text,
  add column if not exists tagline           text,
  add column if not exists address           text,
  add column if not exists phone             text,
  add column if not exists email             text,
  add column if not exists service_times     jsonb,
  add column if not exists giving_url        text,
  add column if not exists giving_mode       text not null default 'tithely',
  add column if not exists youtube_channel_id text,
  add column if not exists updated_at        timestamp with time zone default now();

comment on column public.churches.giving_mode is 'tithely | stripe';
comment on column public.churches.service_times is
  'jsonb array: [{day, time, tz, label, streaming: bool}]';

-- contacts: type field + message body
alter table public.contacts
  add column if not exists type    text not null default 'general',
  add column if not exists message text,
  add column if not exists subject text;

comment on column public.contacts.type is
  'general | visit | prayer | group | newsletter';

-- events: publish toggle so portal can save drafts
alter table public.events
  add column if not exists published   boolean not null default false,
  add column if not exists image_url   text,
  add column if not exists event_type  text,
  add column if not exists registration_url text,
  add column if not exists updated_at  timestamp with time zone default now();

-- sermons: fields the Sermon Builder and YouTube sync need
alter table public.sermons
  add column if not exists youtube_id   text,
  add column if not exists preached_at  date,
  add column if not exists style        text,
  add column if not exists series       text,
  add column if not exists published_at timestamp with time zone,
  add column if not exists duration_min integer,
  add column if not exists thumbnail_url text,
  add column if not exists social_posts text,
  add column if not exists bulletin_notes text,
  add column if not exists slide_content text,
  add column if not exists updated_at   timestamp with time zone default now();

comment on column public.sermons.status is
  'draft | published | archived';
comment on column public.sermons.youtube_id is
  'YouTube video ID — populated by nightly sync job';

-- gallery: alt text for accessibility
alter table public.gallery
  add column if not exists alt_text   text,
  add column if not exists updated_at timestamp with time zone default now();

-- staff: links column for bio page
alter table public.staff
  add column if not exists email      text,
  add column if not exists phone      text,
  add column if not exists updated_at timestamp with time zone default now();

-- videos: category for worship vs other
alter table public.videos
  add column if not exists category    text not null default 'sermon',
  add column if not exists youtube_id  text,
  add column if not exists description text,
  add column if not exists published   boolean not null default true,
  add column if not exists duration_min integer,
  add column if not exists updated_at  timestamp with time zone default now();

comment on column public.videos.category is
  'sermon | worship | story | announcement | other';


-- ============================================================
-- 2. NEW TABLES
-- ============================================================

-- pastor_notes: private, encrypted content per pastor
create table if not exists public.pastor_notes (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null default 'Untitled note',
  body          text,              -- encrypted client-side before insert
  body_iv       text,              -- AES-GCM IV for client-side decryption
  category      text not null default 'general',
  tags          text[],
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

comment on table public.pastor_notes is
  'Private pastor notes. body is encrypted client-side; body_iv holds the AES-GCM IV.';
comment on column public.pastor_notes.body is
  'AES-GCM encrypted ciphertext. Only the authenticated pastor can decrypt.';

-- announcements: the bulletin board
create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,
  body          text not null,
  visible       boolean not null default true,
  sort_order    integer not null default 0,
  posted_by     uuid references auth.users(id),
  expires_at    timestamp with time zone,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

-- prayer_requests: submitted from public site, moderated by pastor
create table if not exists public.prayer_requests (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,
  display_name  text,              -- first name only, submitted by visitor
  body          text not null,
  status        text not null default 'pending',
  prayed_count  integer not null default 0,
  approved_by   uuid references auth.users(id),
  approved_at   timestamp with time zone,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

comment on column public.prayer_requests.status is
  'pending | approved | private | archived';
comment on column public.prayer_requests.display_name is
  'First name or anonymous — pastor controls what shows publicly';

-- groups: small groups and bible studies
create table if not exists public.groups (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete cascade,
  name            text not null,
  description     text,
  meeting_day     text,
  meeting_time    text,
  meeting_tz      text,
  frequency       text not null default 'weekly',
  location_type   text not null default 'phone',
  location_detail text,
  meeting_link    text,             -- zoom/phone bridge/signup URL
  leader_name     text,
  image_path      text,
  visible         boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamp with time zone default now(),
  updated_at      timestamp with time zone default now()
);

comment on column public.groups.location_type is
  'phone | video | in_person | hybrid';
comment on column public.groups.meeting_link is
  'URL the Join button opens — zoom, phone bridge, signup form, etc.';

-- ministries: ministries the church supports
create table if not exists public.ministries (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,
  name          text not null,
  description   text,
  website_url   text,
  logo_url      text,
  sort_order    integer not null default 0,
  visible       boolean not null default true,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

-- gifts: records Stripe giving completions
create table if not exists public.gifts (
  id                uuid primary key default gen_random_uuid(),
  church_id         uuid not null references public.churches(id) on delete cascade,
  stripe_session_id text unique,
  amount_cents      integer not null,
  currency          text not null default 'usd',
  frequency         text not null default 'one_time',
  donor_name        text,
  donor_email       text,
  fund              text,
  status            text not null default 'pending',
  created_at        timestamp with time zone default now()
);

comment on column public.gifts.frequency is 'one_time | monthly';
comment on column public.gifts.status is 'pending | completed | refunded | failed';

-- email_lists: named contact lists for sending
create table if not exists public.email_lists (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,
  name          text not null,
  description   text,
  created_at    timestamp with time zone default now()
);

-- contact_list_memberships: join between contacts and lists
create table if not exists public.contact_list_memberships (
  contact_id    uuid not null references public.contacts(id) on delete cascade,
  list_id       uuid not null references public.email_lists(id) on delete cascade,
  added_at      timestamp with time zone default now(),
  primary key (contact_id, list_id)
);


-- ============================================================
-- 3. ROW LEVEL SECURITY
--    Pattern mirrors existing tables in this project:
--    - Authenticated church member can read/write own church data
--    - Anon can read public data (visible=true) and insert submissions
--    - Service role bypasses RLS (used only in server-side API routes)
-- ============================================================

-- Enable RLS on all new tables
alter table public.pastor_notes         enable row level security;
alter table public.announcements        enable row level security;
alter table public.prayer_requests      enable row level security;
alter table public.groups               enable row level security;
alter table public.ministries           enable row level security;
alter table public.gifts                enable row level security;
alter table public.email_lists          enable row level security;
alter table public.contact_list_memberships enable row level security;


-- ---- pastor_notes: private to the owning user only ----
drop policy if exists "pastor_notes: owner read"
  on public.pastor_notes;

create policy "pastor_notes: owner read"
  on public.pastor_notes for select
  using (auth.uid() = user_id);

drop policy if exists "pastor_notes: owner insert"
  on public.pastor_notes;

create policy "pastor_notes: owner insert"
  on public.pastor_notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "pastor_notes: owner update"
  on public.pastor_notes;

create policy "pastor_notes: owner update"
  on public.pastor_notes for update
  using (auth.uid() = user_id);

drop policy if exists "pastor_notes: owner delete"
  on public.pastor_notes;

create policy "pastor_notes: owner delete"
  on public.pastor_notes for delete
  using (auth.uid() = user_id);


-- ---- announcements: members write, anon read visible ----
drop policy if exists "announcements: anon read visible"
  on public.announcements;

create policy "announcements: anon read visible"
  on public.announcements for select
  using (visible = true);

drop policy if exists "announcements: member write"
  on public.announcements;

create policy "announcements: member write"
  on public.announcements for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = announcements.church_id
        and cm.user_id = auth.uid()
    )
  );


-- ---- prayer_requests: anon submit, members moderate, anon read approved ----
drop policy if exists "prayer_requests: anon submit"
  on public.prayer_requests;

create policy "prayer_requests: anon submit"
  on public.prayer_requests for insert
  with check (true);

drop policy if exists "prayer_requests: anon read approved"
  on public.prayer_requests;

create policy "prayer_requests: anon read approved"
  on public.prayer_requests for select
  using (status = 'approved');

drop policy if exists "prayer_requests: member full access"
  on public.prayer_requests;

create policy "prayer_requests: member full access"
  on public.prayer_requests for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = prayer_requests.church_id
        and cm.user_id = auth.uid()
    )
  );


-- ---- groups: members write, anon read visible ----
drop policy if exists "groups: anon read visible"
  on public.groups;

create policy "groups: anon read visible"
  on public.groups for select
  using (visible = true);

drop policy if exists "groups: member write"
  on public.groups;

create policy "groups: member write"
  on public.groups for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = groups.church_id
        and cm.user_id = auth.uid()
    )
  );


-- ---- ministries: members write, anon read visible ----
drop policy if exists "ministries: anon read visible"
  on public.ministries;

create policy "ministries: anon read visible"
  on public.ministries for select
  using (visible = true);

drop policy if exists "ministries: member write"
  on public.ministries;

create policy "ministries: member write"
  on public.ministries for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = ministries.church_id
        and cm.user_id = auth.uid()
    )
  );


-- ---- gifts: members read own church gifts, anon cannot read ----
drop policy if exists "gifts: member read"
  on public.gifts;

create policy "gifts: member read"
  on public.gifts for select
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = gifts.church_id
        and cm.user_id = auth.uid()
    )
  );

-- gifts insert handled by service role (Stripe webhook) only


-- ---- email_lists: members only ----
drop policy if exists "email_lists: member full access"
  on public.email_lists;

create policy "email_lists: member full access"
  on public.email_lists for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = email_lists.church_id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "contact_list_memberships: member full access"
  on public.contact_list_memberships;

create policy "contact_list_memberships: member full access"
  on public.contact_list_memberships for all
  using (
    exists (
      select 1 from public.email_lists el
      join public.church_members cm on cm.church_id = el.church_id
      where el.id = contact_list_memberships.list_id
        and cm.user_id = auth.uid()
    )
  );


-- ============================================================
-- 4. SECURITY DEFINER RPC — prayer count increment
--    Anon visitors can increment prayed_count on approved
--    requests only. No direct table write permission needed.
-- ============================================================

create or replace function public.increment_prayer_count(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.prayer_requests
  set prayed_count = prayed_count + 1
  where id = request_id
    and status = 'approved';
end;
$$;

-- Grant anon + authenticated users the ability to call it
grant execute on function public.increment_prayer_count(uuid)
  to anon, authenticated;


-- ============================================================
-- 5. SEED — CFT church data
--    Update the existing church-for-truckers row with
--    real details. Replace placeholder values before running.
-- ============================================================

update public.churches
set
  name      = 'Church for Truckers',
  tagline   = 'Faith on the Road. Hope at Every Mile.',
  address   = '110 Garson Ln, Farmington, MO 63640',
  email     = 'info@churchfortruckers.org',   -- update if different
  phone     = '',                              -- paste real prayer-line number
  status    = 'active',
  giving_mode = 'tithely',
  giving_url  = '',                            -- paste Tithe.ly URL when received
  service_times = '[
    {"day": "Sunday", "time": "9:00 AM", "tz": "CT", "label": "Live service + stream"},
    {"day": "Wednesday", "time": "8:00 PM", "tz": "CT", "label": "Mid-week check-in"},
    {"day": "Any hour", "time": "24/7", "tz": "", "label": "Prayer line"}
  ]'::jsonb
where slug = 'church-for-truckers';

-- Confirm the update hit the right row
select id, slug, name, status, giving_mode
from public.churches
where slug = 'church-for-truckers';


-- ============================================================
-- 6. AFTER RUNNING — next steps
-- ============================================================
-- 1. Paste the SELECT result back to Claude to confirm
-- 2. Go to Supabase Auth > Users > Invite user
--    with the pastor's email address
-- 3. After they accept, find their user_id in Auth > Users
-- 4. Run the church_members insert (Claude will draft it
--    once you have the user_id and church_id from step 5's output)
-- ============================================================
