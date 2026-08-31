import io, re

SRC = "prototypes/cft-site-orange.html"
OUT = "app/(public)/site.css"

# Classes the home page (and the shared chrome) actually use.
WANT = set("""
about-grid about-strip amounts amt amt-custom archive-link badge belief
beliefs bible-shell big btn btn-ghost btn-gold btn-sm btn-solid
card card-body card-foot card-kicker card-media cardgrid cbtag centerline
chip chiprow day devo-featured devo-meta disc dot dropdown
event event-list expect expect-item eyebrow faq field formcard
freq give-band give-card give-note giving-grid group-card group-media hero
hero-banner hero-ctas hero-under hint ico initials k lede
live-dot logbook logbook-head logbook-row logo logo-mark logo-tag map-pin-label
map-zone menu-btn mgroup mile mile-stats mm-plate mo mobile-nav
nav nav-links navtop on-dark other-ways page-hero person person-body
person-photo play-ring player portal-btn reader reader-controls role sel
sermon-band sermon-desc sermon-grid sermon-meta side-card split sr-only sub
tag team-grid thumb tick timeline trans tstop two
v verse vtext where wrap wrap-narrow ylcc yr
""".split())

s = io.open(SRC, encoding="utf-8").read()
css = s[s.index("<style>") + len("<style>"): s.index("</style>")]

# Strip CSS comments FIRST. A section banner sitting above a rule otherwise
# lands inside the selector when the block is split, producing
# `.kc-site /* TEAM */ .team-grid`. That happens to scope correctly - comments
# tokenize away and leave a descendant combinator - but it reads as broken and
# would mislead the next person editing this.
css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)

# --- split into top-level blocks, keeping @media/@keyframes intact ---
blocks, depth, buf = [], 0, ""
for ch in css:
    buf += ch
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth == 0:
            blocks.append(buf.strip())
            buf = ""

def selector_wanted(sel: str) -> bool:
    classes = set(re.findall(r"\.([a-zA-Z][\w-]*)", sel))
    return bool(classes & WANT)

def scope_selector(sel: str) -> str:
    """Prefix each comma-separated selector with .kc-site."""
    parts = []
    for one in sel.split(","):
        one = one.strip()
        if not one:
            continue
        if one.startswith("@") or one.startswith(":root") or one in ("*", "html", "body"):
            parts.append(one)
        else:
            parts.append(f".kc-site {one}")
    return ", ".join(parts)

def convert_tokens(text: str) -> str:
    # The prototype's tokens are unprefixed; ours are --kc-*.
    text = re.sub(r"var\(--(?!kc-)([a-z-]+)\)", r"var(--kc-\1)", text)
    # We have no --kc-accent-soft; --kc-brand-soft is the same role.
    text = text.replace("var(--kc-accent-soft)", "var(--kc-brand-soft)")
    return text

kept, keyframes = [], []

for block in blocks:
    head, _, body = block.partition("{")
    head = head.strip()

    if head.startswith("@keyframes"):
        name = head.split()[1]
        if name in ("pulse", "fadeUp", "spin"):
            keyframes.append(convert_tokens(block))
        continue

    if head.startswith("@media"):
        inner_blocks, d, b = [], 0, ""
        inner = block[block.index("{") + 1: block.rindex("}")]
        for ch in inner:
            b += ch
            if ch == "{":
                d += 1
            elif ch == "}":
                d -= 1
                if d == 0:
                    inner_blocks.append(b.strip())
                    b = ""
        keep_inner = []
        for ib in inner_blocks:
            isel, _, ibody = ib.partition("{")
            if selector_wanted(isel):
                keep_inner.append(convert_tokens(f"  {scope_selector(isel.strip())} {{{ibody}"))
        if keep_inner:
            kept.append(f"{head} {{\n" + "\n".join(keep_inner) + "\n}")
        continue

    if selector_wanted(head):
        kept.append(convert_tokens(f"{scope_selector(head)} {{{body}"))

header = """/*
 * ============================================================
 * PUBLIC SITE - prototype styles
 * ============================================================
 *
 * Ported mechanically from prototypes/cft-site-orange.html, which is the
 * design spec. Selectors are scoped under `.kc-site` (the wrapper in
 * app/(public)/layout.tsx) so nothing here can reach the portal, and every
 * every unprefixed token was rewritten to its --kc- equivalent so these rules read the same
 * per-church theme tokens as everything else - change a church's brand colour
 * and this follows it.
 *
 * WHY A STYLESHEET RATHER THAN TAILWIND. The first pass at these sections was
 * written in Tailwind utilities against the tokens. It carried the right
 * content and the right colours and did not look like the prototype: the
 * dashed eyebrow rule, the logbook panel, the mile-marker plates and the
 * dark bands are specific enough that re-deriving them by eye produces
 * something close and wrong. Porting the CSS is both more faithful and less
 * work than approximating it twice.
 *
 * `--accent-soft` is the one token with no `--kc-` equivalent; it maps to
 * `--kc-brand-soft`, which fills the same role.
 *
 * DO NOT hand-edit. Re-porting discards edits - put anything hand-written
 * in app/(public)/site-overrides.css, which is imported after this file.
 */

"""



out = header + "\n\n".join(keyframes + kept) + "\n"
io.open(OUT, "w", encoding="utf-8", newline="\n").write(out)

print("wrote", OUT)
print("rules kept:", len(kept), "keyframes:", len(keyframes))
print("bytes:", len(out))
leftover = sorted(c for c in WANT if f".{c}" not in out)
print("classes with no rule:", leftover)
