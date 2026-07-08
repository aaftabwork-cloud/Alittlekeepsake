# Invite Studio

The in-house finishing editor for AI-generated animated invitations — the human-in-the-loop
bridge between the Claude Code pipeline (which gets a design ~90% there) and a shippable invite.

**The loop:** pipeline exports layout JSON → import here → operator fixes spacing, positions,
text, colors, crops, and declares animation intent → export clean JSON (+ HTML preview) →
pipeline reads it back and bakes the final animations.

Built with Vite + React + TypeScript + Tailwind + Zustand. DOM-based renderer (no canvas
library): text stays crisp at every zoom and the editor's render is the same markup the HTML
export produces, so what you see is what ships.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5199
```

With no environment variables the app runs in **local mode**: no login, projects and assets
persist in the browser (IndexedDB). Full editor, import/export — everything works. This is
also the fastest way to evaluate it.

## Team deployment (Supabase + Vercel + GitHub)

1. **Supabase** — create a project, open the SQL editor, run `supabase/schema.sql`.
   It creates `projects` + `assets` tables, RLS policies (all signed-in users share
   everything — it's an internal tool), and a public `assets` storage bucket.
   In *Auth → URL Configuration*, add your Vercel URL as a redirect URL.
   Sign-in is passwordless magic links; to keep outsiders out, disable public sign-ups
   and invite teammates from the dashboard, or tighten the RLS policies to your domain
   (commented example in the SQL).
2. **GitHub** — push this repo.
3. **Vercel** — import the repo (framework: Vite). Set env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

With those set the app switches to **cloud mode**: magic-link login, shared projects,
shared asset library, live presence (avatars of teammates in the same project), and
conflict detection on save (last-writer is warned before overwriting).

## The data contract (do not break) — verified against v1

`src/contract/` is the only place that reads/writes pipeline JSON. Everything below was
**verified against the real v1 tool (`heritage/studio.html`) and its actual exports**;
round-trips of the real heritage files (`celestial-layout.json`,
`abdullah-sarah-moonlit-lotus-layout.json`) and a full v1-style project deep-diff to
**zero differences**.

There are TWO shapes, and the editor imports and exports both:

1. **Project JSON** (`.project.json`, the full contract):
   `{ name, format?, bands: [...], layout: [...] }` — the section list key may also be
   `sections`/`pages` and the objects key may be `objects`; whatever came in is echoed
   back. Bands are `{ id, label, height, bg: <image url>, color?: <solid> }`.
   `format` (`mobile` 390 / `tablet` 768 / `desktop` 1920 / `storybook` 941) determines
   artboard width when there is no `width` key.
2. **Engine layout JSON** (`-layout.json`): a flat array, groups flattened to absolute
   children, editor-only fields dropped, `custom` → `editable: true`, animation collapsed
   to `anim: { name, dur, ...opts }`, defaults elided — byte-compatible with
   studio.html's `exportLayout()`.

Verified details baked into the code:

- `blend` holds canvas composite names, default `source-over` (rendered via
  `mix-blend-mode`); the v1 palette is source-over/screen/multiply/overlay/soft-light/
  color-dodge/color-burn/lighten/darken/luminosity.
- `fontFamily` is a full CSS stack (`"Cormorant Garamond, Georgia, serif"`); the picker
  swaps the first family and keeps the fallback tail. `charSpacing` is thousandths-of-em.
  `lineHeight` default 1.16. `boxFillOpacity` is 0–100.
- `adjust` is 100-neutral for exposure/contrast/saturation/vibrance, 0-neutral for
  warmth/hue/fade/glow/sharpness/blur, and is omitted entirely when all-default.
- `crop` is a source rect `{x, y, w, h, nw, nh}` in natural image pixels, omitted when
  full-frame. Lines carry only `x1,y1,x2,y2` (+ shared fields minus x/y/angle/flips).
  Objects have no `id` (internal ids are stripped unless the source had one).
- Group children serialize **center-relative** (Fabric convention) in project files;
  internally the editor edits them in absolute coords and converts on the way in/out.
- Animation presets are the v1 vocabulary (`float-drift`, `bob`, `reveal-up`,
  `reveal-soft`, `twinkle`, `breathe`, …21 total) with `motionOpts` overrides
  `{trigger, dur, delay, x, y, rotate, scale, opacity, loop, yoyo, ease}` plus our
  additive free-text `note` for animation intent.
- Unknown keys at any level are preserved in `extra` bags and re-emitted verbatim.

## Templates (migrated from the v1 studio)

The dashboard opens with a gallery of every template recoverable from the old tool:
the five presets embedded in `studio.html` (Storybook Night, Storybook Sunset, Tangled
Lanterns, Enchanted Arch, Moonlit Lotus) and the two finished exported invites
(Celestial and Moonlit Lotus — Abdullah & Sarah), plus the built-in sample. Clicking one
creates a fresh project from it. Their 79 referenced asset files live under
`public/templates/assets/` (copied verbatim from `heritage/assets/`, srcs rewritten to
app-served paths). Regenerate everything with:

```bash
node scripts/extract-templates.mjs [path-to-heritage-folder]
```

Note: v1 stored *working projects* in the browser's IndexedDB, so anything never
exported to disk is only recoverable from the browser profile that made it.

## What the editor does

- **Canvas**: sections (bands) stacked vertically with labels; pan (space / hand / wheel),
  zoom to cursor (⌘-wheel), zoom-to-fit; marquee, shift-multi-select, alt-drag duplicate;
  smart snapping to object edges/centers, section edges/midlines and the artboard
  centerline with gold guides; drag between sections re-assigns `band` automatically.
- **Transforms**: 8-handle resize (rotation-aware), corner-proportional text scaling,
  rotate handle with 15° shift-snapping, line endpoint editing, numeric inspector with
  scrubbable labels, align/distribute bar (to section for single, to each other for multi).
- **Text**: double-click inline editing, 46 curated fonts (script/serif/sans/Urdu·Arabic·Hindi/
  decorative) with previews and search, weight/style/case/spacing/line-height, highlight,
  box fill + padding, shadow.
- **Images**: replace, crop dialog (source-rect), 10 adjustment sliders (approximate CSS
  preview — exact values live in the JSON for the pipeline), shadows; broken/relative
  `src` paths render as a visible "missing" placeholder so operators can re-link them.
- **Shapes**: fills, 2-stop gradients (linear/radial), stroke, corner radius; lines.
- **Layers**: grouped by section, drag to reorder/re-band, rename, lock, hide,
  field badges, select-all-in-section.
- **Animation intent**: static/animated, 19 presets (entrance/emphasis/ambient) with live
  canvas preview, duration/delay/distance, and a free-text intent note — all stored in the
  contract's `motion/anim/dur/motionOpts` so the pipeline knows exactly what to build.
- **Editable fields**: tag any object with a `field` key (coupleNames, date, venue… or
  custom) for the downstream publish site.
- **Preview mode**: chrome collapses, every animation plays.
- **Assets**: shared library (upload, folders, search) — cloud mode stores in Supabase
  Storage so the whole team reuses the same cutouts across templates.
- **Projects**: dashboard with live thumbnails, duplicate template, rename, delete,
  import JSON, blank start, sample invite.
- **History**: full undo/redo (⌘Z/⌘⇧Z), gesture-coalesced (a drag or slider sweep is one
  undo step). Autosave every 30 s + ⌘S.

## Keyboard

`V` select · `H` hand · `T` text · `R` rect · `O` ellipse · `L` line · space = pan ·
⌘Z/⌘⇧Z undo/redo · ⌘D duplicate · ⌘C/⌘X/⌘V copy/cut/paste · ⌘G/⌘⇧G group/ungroup ·
`[` `]` z-order (⌘ for to-back/front) · arrows nudge (shift ×10) · ⌘A select all ·
⌘0 fit · ⌘1 100% · ⌘+/− zoom · Enter edit text · Esc closes/escapes anything.

## Known limits (deliberate v2 scope)

- Multi-selection shows combined bounds and supports move/align/distribute, not group-resize.
- Group children are moved with the group; to edit a child, ungroup (⌘⇧G) and regroup (⌘G).
- Image adjustments preview via CSS filter approximations; the pipeline applies the exact
  stored values at bake time.
- Conflict handling is save-time warning + overwrite choice, not live co-editing. Presence
  avatars show who's in the file so you can coordinate.
