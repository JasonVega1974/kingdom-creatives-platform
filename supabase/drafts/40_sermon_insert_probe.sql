/*
 * ============================================================
 * DRAFT 40 - prove the Sermon Builder's insert, without
 *            spending a generation
 * Project: cyyxhhwuyeyvewqrhewt
 * Status:  NOT RUN.
 * Required for: isolating the save failure
 * ============================================================
 *
 * >>> RUN AS ONE SCRIPT. Rolls back; nothing persists. <<<
 *
 * WHY THIS EXISTS. The save step fails and the error is opaque. I audited
 * every field the insert sends against the generated column types and
 * found no mismatch - but an audit is reading, not proof, and the audit
 * itself had a bug on its first pass (it missed `title` because ES6
 * shorthand has no colon). This runs the actual write, as a real church
 * member, with the same eight fields and a real TipTap-shaped jsonb
 * document in body_json.
 *
 * It costs nothing: no API call, no generation slot, and the rollback
 * leaves no row. Running it BEFORE the one live attempt means that
 * attempt is spent testing something still unknown, rather than
 * re-testing this.
 *
 * EXPECTED: one row.
 *
 *   inserted_id   a uuid      the insert works under real RLS with real
 *                             column types, and the save failure is
 *                             somewhere AFTER it - the add-on calls, the
 *                             update, or the return trip to the browser
 *   title         the literal below
 *   body_ok       true        body_json survived the round trip as jsonb
 *                             and its structure is readable back
 *
 * AN ERROR INSTEAD OF A ROW is the informative outcome: whatever Postgres
 * says - a type, a constraint, a policy - is the thing the application
 * cannot say clearly. Paste it back verbatim.
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

/* The same eight fields app/(portal)/portal/sermon-builder/actions.ts
   sends, with a body_json shaped exactly as markdownToDoc() produces:
   a doc containing a heading, a paragraph with a bold mark, a bullet
   list and a blockquote - every node type SERMON_EXTENSIONS allows. */
with member as (
  select cm.church_id, cm.user_id
  from public.church_members cm
  join public.churches c on c.id = cm.church_id
  where c.slug = 'church-for-truckers'
    and cm.user_id = auth.uid()
  limit 1
)
insert into public.sermons (
  church_id, created_by, title, body_json,
  scripture_ref, style, preached_at, status
)
select
  m.church_id,
  m.user_id,
  'Insert probe - safe to ignore, rolled back',
  '{"type":"doc","content":[
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Title + Big Idea"}]},
      {"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Faith holds."}]},
      {"type":"bulletList","content":[{"type":"listItem","content":[
        {"type":"paragraph","content":[{"type":"text","text":"An application step"}]}]}]},
      {"type":"blockquote","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Be still, and know that I am God."}]}]}
    ]}'::jsonb,
  'John 3:16',
  'expository',
  current_date,
  'draft'
from member m;

select
  id                                                   as inserted_id,
  title,
  (body_json -> 'content' -> 0 ->> 'type') = 'heading' as body_ok
from public.sermons
where title = 'Insert probe - safe to ignore, rolled back';

rollback;
