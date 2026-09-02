/*
 * APPLIED 2026-09-01 against project cyyxhhwuyeyvewqrhewt. Moved from
 * supabase/drafts/ after the run. History, not a to-do. Confirmed clean:
 * section 1 read 0 rows, section 4 showed the new column list and exactly
 * one policy ("pastor_notes: member full access", cmd ALL).
 *
 * ============================================================
 * DRAFT 33 - repurpose pastor_notes into the shared Notes table
 * Project: cyyxhhwuyeyvewqrhewt
 * Status:  APPLIED 2026-09-01.
 * Required for: Phase C "Notes" tab (lib/portal/nav.ts)
 * ============================================================
 *
 * >>> RUN THE FOUR SECTIONS SEPARATELY. <<<
 * The Supabase SQL editor shows only the last statement's result. Run
 * section 1, paste the row count back. Only if it reads 0 (expected - the
 * table has never been written to; My Notes has no UI yet and no app code
 * references pastor_notes anywhere), continue to section 2. Then 3, then 4,
 * pasting each result back before the next.
 *
 *
 * WHAT THIS TABLE WAS, AND WHY IT IS CHANGING
 * pastor_notes (migration 01, applied 2026-07-30) is PORTAL_SPEC's own table
 * for My Notes - it was created up front, RLS'd, and never wired to any page
 * or Server Action. Two things about its original design no longer hold:
 *
 *   1. RLS was owner-only: `using (auth.uid() = user_id)` on select, insert,
 *      update and delete. Jason decided 2026-09-01 that My Notes is
 *      church-shared - any portal member at a church can see and edit any
 *      note there, same as Team, Sermon Library, Events, Groups and Prayer.
 *      Section 3 below replaces the four owner-only policies with the
 *      standard church_members "for all" pattern those tables use.
 *
 *   2. `body` was designed to hold ciphertext, with `body_iv` alongside it
 *      for client-side AES-GCM decryption. KC_MASTER_TODO.md has carried an
 *      unchecked line since 2026-07-30: "Decide: pastor_notes encryption =
 *      client-side (recommended) or at-rest only." That decision is made
 *      HERE, as a consequence of decision 1, not a separate choice: content
 *      encrypted to one owner cannot also be shared-readable by every portal
 *      member at the church. Church-shared means plaintext-to-the-church, so
 *      section 2 drops `body` and `body_iv` and adds `body_json` - a TipTap
 *      JSON document, sanitized by construction (the editor's extension set
 *      is closed to Bold/Italic/Underline/TextStyle/Color/Highlight/
 *      FontFamily, so no HTML string carrying markup outside that allowlist
 *      is ever produced or stored).
 *
 * `category` is kept and reused as the note-type field (sermon prep,
 * general, reminder, church admin, event planning) rather than adding a
 * second column for the same fact - it already exists, already defaults to
 * 'general', and this only adds a CHECK so a typo is refused by the database
 * instead of silently creating a sixth type nothing filters for.
 *
 * `user_id` is kept as-is: not renamed, not dropped. Visibility is now
 * church-wide, but authorship still matters (an audit trail: "who wrote
 * this"), so it stays and the My Notes UI shows a byline built from it - the
 * same role `approved_by` plays on prayer_requests.
 *
 * The table is NOT renamed. PORTAL_SPEC still calls the feature "My Notes"
 * and the table "pastor_notes" together; renaming would touch this file's
 * every reference plus any future code, for a cosmetic mismatch (the table
 * name says "pastor", the access model is now "church"). Flagging it, not
 * deciding it - say the word if you want a rename drafted as its own file.
 *
 *
 * SCOPE PER GROUND RULE 8's RISK TABLE
 * Schema changes plus an RLS rewrite - High. One section at a time, results
 * pasted back between sections, exactly as the rule requires. This table has
 * no public read path (it is portal-only, gated behind requirePortalUser()),
 * so the rule 4a anon probe does not apply here - there is no public side to
 * probe.
 */


/*
 * ============================================================
 * SECTION 1 of 4 - safety check before dropping columns (read-only)
 * ============================================================
 *
 * EXPECTED: 0. My Notes has no UI or Server Action anywhere in the app
 * (grep confirms pastor_notes is referenced only in docs, migrations, and
 * generated types - never in app/, components/, or lib/), so nothing has
 * ever written a row. If this reads anything other than 0, STOP and paste
 * the count back before running section 2 - dropping body/body_iv on a
 * nonzero table would discard real ciphertext with no way to decrypt it
 * afterward, since the AES key never lived in the database.
 */

select count(*) as existing_note_rows
from public.pastor_notes;


/*
 * ============================================================
 * SECTION 2 of 4 - ALTER TABLE: add the new columns, drop the encrypted pair
 * ============================================================
 *
 * EXPECTED: "ALTER TABLE" success, no rows returned. Section 4 confirms the
 * resulting column list.
 */

alter table public.pastor_notes
  add column if not exists body_json jsonb,
  add column if not exists scripture_book text,
  add column if not exists scripture_chapter integer,
  add column if not exists scripture_verse_start integer,
  add column if not exists scripture_verse_end integer,
  add column if not exists sermon_id uuid references public.sermons(id) on delete set null,
  add column if not exists reminder_at timestamp with time zone;

alter table public.pastor_notes
  drop column if exists body,
  drop column if exists body_iv;

/* category becomes the note-type field. Existing default ('general') and
   existing values are still valid under this list, so no backfill is
   needed - the CHECK only starts refusing NEW bad values. */
alter table public.pastor_notes
  add constraint pastor_notes_category_check
  check (category in ('sermon_prep', 'general', 'reminder', 'church_admin', 'event_planning', 'other'));

comment on table public.pastor_notes is
  'Church-shared portal notes ("My Notes" tab). Any portal member at the church may read and write any note; user_id records who wrote it, not who may see it. Superseded the owner-private/encrypted design 2026-09-01 - see this file''s header.';
comment on column public.pastor_notes.body_json is
  'TipTap JSON document. Never store raw HTML here - the closed extension allowlist (Bold/Italic/Underline/TextStyle/Color/Highlight/FontFamily) is what keeps this safe to render back, and that only holds if every write goes through the same editor config.';
comment on column public.pastor_notes.category is
  'Note type: sermon_prep | general | reminder | church_admin | event_planning | other. Column kept from the original design and reused rather than duplicated - see CHECK constraint pastor_notes_category_check.';
comment on column public.pastor_notes.user_id is
  'Author - who wrote the note. Visibility is church-wide (see RLS in section 3); this is attribution, not an access boundary.';
comment on column public.pastor_notes.sermon_id is
  'Optional link to a curated sermon (public.sermons.id only - a note cannot attach to a YouTube-feed entry that has no curated row yet). ON DELETE SET NULL: removing the sermon record does not delete the note.';
comment on column public.pastor_notes.reminder_at is
  'UTC instant, same convention as every other portal timestamp (see FF-38). Display-only in this phase - FF-56 tracks the notification gap.';


/*
 * ============================================================
 * SECTION 3 of 4 - RLS: owner-only -> church-member "for all"
 * ============================================================
 *
 * EXPECTED: four "DROP POLICY" (the last one may say "does not exist,
 * skipping" if section 3 is ever re-run - that is fine) and one
 * "CREATE POLICY", no rows returned. This is the same shape as
 * `prayer_requests: member full access` (migration 01) with the `with
 * check` explicit from the start, so it does not reintroduce the gap
 * draft 13 / FF-23 had to close on the older policies.
 */

drop policy if exists "pastor_notes: owner read" on public.pastor_notes;
drop policy if exists "pastor_notes: owner insert" on public.pastor_notes;
drop policy if exists "pastor_notes: owner update" on public.pastor_notes;
drop policy if exists "pastor_notes: owner delete" on public.pastor_notes;

create policy "pastor_notes: member full access"
  on public.pastor_notes for all
  using (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = pastor_notes.church_id
        and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.church_members cm
      where cm.church_id = pastor_notes.church_id
        and cm.user_id = auth.uid()
    )
  );


/*
 * ============================================================
 * SECTION 4 of 4 - verify (read-only)
 * ============================================================
 *
 * EXPECTED, first query: body and body_iv absent; body_json, category
 * (with the new CHECK), scripture_book, scripture_chapter,
 * scripture_verse_start, scripture_verse_end, sermon_id, reminder_at all
 * present alongside the original id/church_id/user_id/title/tags/
 * created_at/updated_at.
 *
 * EXPECTED, second query: exactly one row - "pastor_notes: member full
 * access", cmd = ALL - and none of the four "owner ..." policies remaining.
 */

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'pastor_notes'
order by ordinal_position;

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'pastor_notes'
order by policyname;
