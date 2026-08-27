/* ============================================================
   DRAFT 17 - let a pastor edit their own church (FF-27)
   Project: cyyxhhwuyeyvewqrhewt
   Status:  NOT RUN. Jason reviews and runs manually.
   Required for: the Church Details tab saving anything at all.
   Requires: nothing. Safe to run now.

   >>> RUN THE SECTIONS SEPARATELY. Section 4 is the verify. <<<

   WHAT DRAFT 16 FOUND
   churches and church_theme have RLS on and exactly ONE policy each, both
   for select:

     churches      "public can view active churches"     using (status = active)
     church_theme  "public can view theme of active..."  using (church_id in active)

   No insert, no update, no delete policy on either. So every write from the
   Church Details tab has been refused since the tab was built. An UPDATE with
   no matching policy is not an error - the row is filtered out of scope,
   Postgres reports 0 rows changed, and PostgREST answers 204. That is the
   silent success the tab was reporting.

   WHY THIS IS NOT COPIED VERBATIM FROM THE OTHER NINE
   The nine "pastor+ can edit" policies are `for all`, which includes DELETE.
   That is fine for sermons and events. It is not fine for churches: a pastor
   could delete the row that defines their own tenant, and the on-delete-cascade
   on church_members, church_links and the rest would take everything with it.
   So churches gets `for update` only, and church_theme gets insert + update
   (the branding form upserts, and an upsert needs both paths open).

   WHY COLUMN GRANTS AS WELL - SECTION 3
   RLS sees the row, never which columns changed. There is no OLD/NEW in a
   policy, so "may edit name but not slug" cannot be expressed as a policy at
   all. Without column privileges, an UPDATE policy on churches lets a pastor
   change:

     slug, custom_domain - re-points tenant resolution; takes the site down
     status              - a suspended church could re-activate itself
     template_id, giving_mode, giving_url, youtube_channel_id

   Postgres column-level GRANTs are the mechanism for this, and PostgREST
   honours them. Section 3 narrows `authenticated` to exactly the columns the
   portal writes today.

   CAVEAT worth knowing: both select policies require status = active. The
   actions now read their rows back with .select(), so on a church whose status
   is not active a successful write would still report a refusal. Such a church
   cannot load the portal at all today for the same reason, so this is recorded
   rather than fixed here. See FF-28.

   SAFE TO RUN TWICE. Every statement is drop-if-exists / revoke-then-grant.
   ============================================================ */


/* ============================================================
   SECTION 1 - churches: update only
   ============================================================ */

begin;

drop policy if exists "pastor+ can edit church" on public.churches;

create policy "pastor+ can edit church"
  on public.churches for update
  using (
    id in (
      select cm.church_id from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  )
  with check (
    id in (
      select cm.church_id from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  );

commit;


/* ============================================================
   SECTION 2 - church_theme: insert + update, no delete

   Two policies rather than one `for all`. The branding form upserts, which is
   INSERT ... ON CONFLICT DO UPDATE and needs both paths open. DELETE stays
   closed: dropping the theme row silently strips a church of its branding.
   ============================================================ */

begin;

drop policy if exists "pastor+ can add theme"  on public.church_theme;
drop policy if exists "pastor+ can edit theme" on public.church_theme;

create policy "pastor+ can add theme"
  on public.church_theme for insert
  with check (
    church_id in (
      select cm.church_id from public.church_members cm
       where cm.user_id = auth.uid()
         and cm.role = any (array['pastor'::text, 'admin'::text])
    )
  );

create policy "pastor+ can edit theme"
  on public.church_theme for update
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
   SECTION 3 - column privileges

   Supabase grants ALL on public tables to anon and authenticated by default,
   so without this the policy above would expose every column. Revoke the
   blanket write privilege, then grant back exactly what the portal writes.

   churches:      saveIdentity writes name, tagline, address, phone, email
                  saveServiceTimes writes service_times
                  both write updated_at
   church_theme:  saveBranding writes the three colours, the two fonts it
                  carries across, logo_url and updated_at - plus church_id on
                  the insert path

   giving_url and youtube_channel_id are deliberately NOT granted: they are
   superseded by church_links (migrations 09/10) and no form writes them. Add
   them here if a later tab needs them - do not widen the policy instead.

   anon is revoked too. It has no write policy so RLS already refuses, but a
   privilege nothing needs is one that cannot be misused later.
   service_role is untouched: it bypasses RLS and owns the sync jobs.
   ============================================================ */

begin;

revoke update on public.churches     from anon, authenticated;
revoke insert on public.church_theme from anon, authenticated;
revoke update on public.church_theme from anon, authenticated;

grant update (name, tagline, address, phone, email, service_times, updated_at)
  on public.churches to authenticated;

grant insert (church_id, color_primary, color_secondary, color_accent,
              font_heading, font_body, logo_url, updated_at)
  on public.church_theme to authenticated;

grant update (color_primary, color_secondary, color_accent,
              font_heading, font_body, logo_url, updated_at)
  on public.church_theme to authenticated;

commit;


/* ============================================================
   SECTION 4 - VERIFY

   First query - expect five rows:
     church_theme  public can view theme of active churches  select  using only
     church_theme  pastor+ can add theme                     insert  check only
     church_theme  pastor+ can edit theme                    update  both
     churches      public can view active churches           select  using only
     churches      pastor+ can edit church                   update  both

   Second query - expect exactly the column lists from section 3, and NO row
   for slug, custom_domain, status, id or template_id.
   ============================================================ */

select c.relname as table_name,
       p.polname as policy_name,
       case p.polcmd
         when '*' then 'ALL' when 'r' then 'select' when 'a' then 'insert'
         when 'w' then 'update' when 'd' then 'delete'
       end as cmd,
       case when p.polqual      is null then 'no' else 'yes' end as has_using,
       case when p.polwithcheck is null then 'no' else 'yes' end as has_with_check
  from pg_policy p
  join pg_class c     on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('churches', 'church_theme')
 order by c.relname, p.polcmd, p.polname;

select table_name, privilege_type, string_agg(column_name, ', ' order by column_name) as columns
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name in ('churches', 'church_theme')
   and grantee = 'authenticated'
   and privilege_type in ('INSERT', 'UPDATE')
 group by table_name, privilege_type
 order by table_name, privilege_type;
