/*
 * ============================================================
 * DRAFT 39 - clear today's generation-cap rows for CFT
 * Project: cyyxhhwuyeyvewqrhewt
 * Status:  NOT RUN.
 * Required for: unblocking Sermon Builder debugging
 * ============================================================
 *
 * >>> ONE STATEMENT. Run it whenever the cap is in the way. <<<
 *
 * WHY THIS IS NEEDED. generate/route.ts logs a row BEFORE calling
 * Anthropic, so a generation that fails still burns one of the ten daily
 * slots. That is deliberate - counting only successes would let a retry
 * storm bypass the cap entirely - but it means a debugging session can
 * exhaust the day's allowance without ever producing a sermon. This gives
 * the slots back.
 *
 * SCOPE. Church for Truckers only, today (UTC) only. It deletes meter
 * rows - no sermon, no manuscript, no pastor's words. The only thing lost
 * is the record of how many generations were attempted today, which is
 * exactly the intent.
 *
 * RISK, per ground rule 8's table: data-only and effectively idempotent -
 * running it twice deletes nothing the second time. Low. No begin/rollback
 * wrapper because the point is for it to persist.
 *
 * RUN IT AS THE SQL EDITOR'S OWN ROLE, not as authenticated. The editor
 * connects as the table owner and bypasses RLS, which is what makes this
 * possible at all: FF-60 records that no delete policy exists, so a church
 * member genuinely cannot do this - proven by draft 38 section 2. That is
 * the append-only guarantee working, not something to route around in the
 * app.
 *
 * EXPECTED: "DELETE n" where n is the number of attempts made today. The
 * builder's counter reads 10 of 10 again on the next page load.
 */

delete from public.sermon_generations sg
using public.churches c
where c.id = sg.church_id
  and c.slug = 'church-for-truckers'
  and sg.created_at >= date_trunc('day', (now() at time zone 'utc')) at time zone 'utc';


/*
 * To check before or after without deleting anything:
 *
 *   select count(*)
 *   from public.sermon_generations sg
 *   join public.churches c on c.id = sg.church_id
 *   where c.slug = 'church-for-truckers'
 *     and sg.created_at >= date_trunc('day', (now() at time zone 'utc'))
 *                          at time zone 'utc';
 */
