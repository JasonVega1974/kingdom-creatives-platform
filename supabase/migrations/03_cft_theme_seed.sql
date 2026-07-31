-- ============================================================
-- 03 - Church for Truckers theme seed (DATA ONLY, no schema change)
-- Project: cyyxhhwuyeyvewqrhewt
-- Status: APPLIED 2026-07-30. Run manually by Jason in the SQL editor.
-- ============================================================
--
-- Why: church_theme held placeholder values (navy #1e3a5f / gold #c9a24b /
-- white). The pilot's spec is prototypes/cft-site-orange.html, whose palette is
-- orange. Phase A renders whatever is in this row, so the site went orange the
-- moment this ran - no code change needed. That is the theme system working,
-- not a bug.
--
-- Verified live 2026-07-30: the rendered page reports color_primary #EC5D1B,
-- color_secondary #161311, color_accent #FDFBF5, Fraunces / Source Sans 3 -
-- matching the update below. Re-running is idempotent.
--
-- Mapping (see lib/theme.ts - church_theme has only three colour columns,
-- the rest of the token set is derived):
--
--   color_primary   -> --kc-brand           prototype --brand      #EC5D1B
--   color_secondary -> --kc-accent          prototype --accent     #161311
--   color_accent    -> --kc-brand-contrast  text on orange fills   #FDFBF5
--
-- Derived, for reference - these are NOT stored:
--   --kc-brand-deep  = color-mix(brand 80%, black)  ~ #BD4A16  (prototype #C2440C)
--   --kc-brand-night = color-mix(brand 26%, #100A06) ~ #3E1D0A (prototype #241004)
--   --kc-brand-soft  = color-mix(brand 45%, white)  ~ #F5AE8D  (prototype #FFB27E)
--
-- The derived values are close but not identical to the prototype's
-- hand-picked ones. If exact fidelity matters, run 02_theme_tokens.sql first
-- and store them explicitly.

update public.church_theme ct
set
  color_primary   = '#EC5D1B',
  color_secondary = '#161311',
  color_accent    = '#FDFBF5',
  font_heading    = 'Fraunces',
  font_body       = 'Source Sans 3',
  updated_at      = now()
from public.churches c
where c.id = ct.church_id
  and c.slug = 'church-for-truckers';

-- Confirm - paste this result back to Claude.
select c.slug,
       ct.color_primary,
       ct.color_secondary,
       ct.color_accent,
       ct.font_heading,
       ct.font_body
from public.church_theme ct
join public.churches c on c.id = ct.church_id
where c.slug = 'church-for-truckers';

-- ============================================================
-- Note on font names: font_heading / font_body must match a key in
-- FONT_STACKS (lib/theme.ts). Currently supported:
--   Fraunces, Lora, Inter, Source Sans 3, IBM Plex Mono
-- Anything else silently falls back to the platform default rather than
-- breaking the page. Adding a font needs a code change in app/layout.tsx
-- AND lib/theme.ts - next/font is build-time.
-- ============================================================
