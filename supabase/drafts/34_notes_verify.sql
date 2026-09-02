/*
 * ============================================================
 * DRAFT 34 - verify Notes create/edit/read-back through real RLS
 * Project: cyyxhhwuyeyvewqrhewt
 * Status:  NOT RUN.
 * Required for: closing out the Notes tab per rule 4a
 * ============================================================
 *
 * >>> RUN AS ONE SCRIPT, ONE EXECUTION. <<<
 * Unlike draft 33, this is meant to run as a single paste - not sectioned -
 * because it all has to happen inside one transaction for the ROLLBACK at
 * the end to undo it. The SQL editor only shows the LAST statement's result
 * when several run together, which is fine here: the final SELECT is the
 * only thing that needs reading.
 *
 * WHAT THIS PROVES, AND WHY A SERVICE-ROLE QUERY COULD NOT
 * I have no portal login for church-for-truckers and should not ask for
 * one - rule 4a's actual requirement is that the WRITE PATH a pastor uses
 * works, not that an admin connection can reach the table. A service-role
 * client bypasses RLS entirely, so it would prove nothing about whether
 * "pastor_notes: member full access" (from draft 33) actually authorizes a
 * real member's session the way app/(portal)/portal/notes/actions.ts
 * depends on.
 *
 * Instead this mocks a real CFT church member's JWT the way PostgREST
 * builds one for a signed-in request - `request.jwt.claims` plus
 * `set local role authenticated` is Supabase's own documented way to make
 * auth.uid() resolve inside the SQL editor - then runs the same shape of
 * insert, update and select the three Server Actions run. No UUID needs to
 * be pasted by hand: the church and a member are looked up inline, so this
 * is copy-paste-and-run.
 *
 * EXPECTED, from the final SELECT: exactly one row. title reads
 * "Notes verification - edited" (proving the UPDATE step, not just the
 * INSERT, took effect under RLS). category reads 'reminder'. scripture_book
 * /chapter/verse_start/verse_end read 'John'/3/16/16. sermon_id is whatever
 * a real CFT sermon's id is, or null if CFT has none yet - either is fine,
 * it only proves the FK accepted a real id when one exists. reminder_at is
 * roughly 24 hours from whenever this runs.
 *
 * Getting 0 rows back means either the INSERT or the UPDATE was silently
 * refused by RLS - the exact failure judgeWrite() exists to catch in the
 * real app, invisible here without this probe.
 *
 * ROLLBACK at the end means none of this persists - safe to run against
 * production, and safe to run again later if the shape of these columns
 * ever changes.
 */

begin;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (
      select cm.user_id::text
      from public.church_members cm
      join public.churches c on c.id = cm.church_id
      where c.slug = 'church-for-truckers'
      limit 1
    ),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

/* 1. CREATE - same columns createNote() writes in
      app/(portal)/portal/notes/actions.ts. */
insert into public.pastor_notes (
  church_id, user_id, title, body_json, category,
  scripture_book, scripture_chapter, scripture_verse_start, scripture_verse_end,
  sermon_id, reminder_at
)
select
  c.id,
  cm.user_id,
  'Notes verification - safe to ignore',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Verification note."}]}]}'::jsonb,
  'general',
  'John', 3, 16, 16,
  (select id from public.sermons where church_id = c.id limit 1),
  now() + interval '1 day'
from public.churches c
join public.church_members cm on cm.church_id = c.id
where c.slug = 'church-for-truckers'
limit 1;

/* 2. EDIT - same columns updateNote() writes, on the row just created. */
update public.pastor_notes
set title = 'Notes verification - edited',
    category = 'reminder',
    updated_at = now()
where title = 'Notes verification - safe to ignore';

/* 3. READ BACK - same select list as app/(portal)/portal/notes/page.tsx. */
select
  id, title, body_json, category,
  scripture_book, scripture_chapter, scripture_verse_start, scripture_verse_end,
  sermon_id, reminder_at, user_id, created_at, updated_at
from public.pastor_notes
where title = 'Notes verification - edited';

rollback;
