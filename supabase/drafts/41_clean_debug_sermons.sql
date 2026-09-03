/*
 * ============================================================
 * DRAFT 41 - remove the sermons left over from debugging
 * Project: cyyxhhwuyeyvewqrhewt
 * Status:  NOT RUN.
 * Required for: tidying Sermon Library after the builder shakedown
 * ============================================================
 *
 * >>> RUN THE TWO SECTIONS SEPARATELY. Section 2 deletes for real. <<<
 *
 * This is the only draft in this feature's chain that destroys data and
 * does not roll back. Rows are gone when it finishes - there is no undo,
 * and the manuscripts in body_json go with them.
 *
 * WHAT IT REMOVES, and nothing else:
 *   - every sermon titled 'Genesis for Beginners' EXCEPT the newest one,
 *     ranked by created_at
 *   - every sermon titled 'Test Sermon'
 * Both scoped to Church for Truckers. A real sermon that happens to share
 * one of those titles would be caught by this, which is exactly why
 * section 1 exists: read the list before deleting it.
 *
 * RISK per ground rule 8: a scoped, non-idempotent DELETE against live
 * data. Medium - inspect first, then run.
 */


/*
 * ============================================================
 * SECTION 1 of 2 - look first. Read-only.
 * ============================================================
 *
 * Lists every row section 2 would touch, and what it would do with it.
 *
 * EXPECTED: the newest 'Genesis for Beginners' marked KEEP, every older
 * one and every 'Test Sermon' marked DELETE. Check the KEEP row is the one
 * you actually want - it is chosen by created_at, so if the best draft was
 * not the last one written, say so and this gets re-pointed at its id
 * instead of its timestamp.
 *
 * If anything marked DELETE is a sermon you want, STOP. Do not run
 * section 2.
 */

select
  s.id,
  s.title,
  s.status,
  s.created_at,
  length(s.body_json::text)                as manuscript_chars,
  case
    when s.title = 'Genesis for Beginners'
     and s.created_at = (
       select max(s2.created_at)
       from public.sermons s2
       join public.churches c2 on c2.id = s2.church_id
       where c2.slug = 'church-for-truckers'
         and s2.title = 'Genesis for Beginners'
     )
    then 'KEEP - newest Genesis for Beginners'
    else 'DELETE'
  end                                       as action
from public.sermons s
join public.churches c on c.id = s.church_id
where c.slug = 'church-for-truckers'
  and s.title in ('Genesis for Beginners', 'Test Sermon')
order by s.title, s.created_at desc;


/*
 * ============================================================
 * SECTION 2 of 2 - the delete. Only after section 1 looked right.
 * ============================================================
 *
 * EXPECTED: "DELETE n", where n is exactly the number of rows section 1
 * marked DELETE. If the number differs, something changed between the two
 * runs - re-run section 1 before doing anything else.
 *
 * The `is distinct from` guard is deliberate: if the max(created_at)
 * subquery ever returned NULL (no Genesis rows at all), a plain `<>`
 * comparison would be NULL, the row would not match, and nothing would be
 * deleted. Failing safe rather than deleting everything is the right
 * behaviour for a statement with no undo.
 */

delete from public.sermons s
using public.churches c
where c.id = s.church_id
  and c.slug = 'church-for-truckers'
  and (
    s.title = 'Test Sermon'
    or (
      s.title = 'Genesis for Beginners'
      and s.created_at is distinct from (
        select max(s2.created_at)
        from public.sermons s2
        join public.churches c2 on c2.id = s2.church_id
        where c2.slug = 'church-for-truckers'
          and s2.title = 'Genesis for Beginners'
      )
    )
  );
