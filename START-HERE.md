# Craft — the invite finishing studio

Craft is our in-house editor for finishing AI-generated animated wedding invitations.
The AI pipeline gets a design ~90% of the way; Craft is where a person takes it to 100%
(fix spacing, text, colours, crops, and declare the animation intent) and exports clean
JSON the pipeline reads back to bake the final invite.

This folder is the whole thing: the editor, all 8 built-in templates, and every asset
they use. It runs entirely on your machine — no login, no server, nothing to set up
beyond Node.

---

## Run it (2 commands)

You need **Node.js 18+** (get it from https://nodejs.org if you don't have it).

```bash
npm install      # first time only — downloads dependencies (~1 min)
npm run dev      # starts the editor at http://localhost:5199
```

Open **http://localhost:5199** in your browser. That's it.

Everything you make is saved in your browser (local mode). Nothing leaves your machine.

---

## What you'll see

- **Templates gallery** — 8 themes to start from: Storybook Night, Storybook Sunset,
  Tangled Lanterns, Enchanted Arch, Moonlit Lotus, Celestial, Moonlit Lotus (Abdullah &
  Sarah), and **Gatsby Nights** (the newest — 1920s Art Deco). Click one to make a project.
- **Import layout JSON** — bring in a design straight from the AI pipeline.
- **The editor** — sections stacked vertically, layers panel, a fields tab for fast
  retexting, drag-and-drop assets, animation intent per object, and a Preview mode that
  plays every animation.

## How the loop works

1. Pipeline exports a layout JSON → **Import layout JSON** on the dashboard.
2. Fix the last 10%: text, positions, colours, crops; tag editable fields; set animation
   intent (there's a free-text note per animation so the pipeline knows what to build).
3. **File → Export project JSON** (and Export engine layout JSON) → hand back to the pipeline.

## If an image shows as "missing"

Assets are referenced by path. If you open a design whose images can't be found, a banner
appears at the top: **Re-link from folder…** — point it at the folder of images and Craft
matches them by filename and fixes every reference at once.

---

## Generating a brand-new theme with AI (for designers)

Craft ships with the full generation pipeline too, so you can go from a few reference images
to a finished invite in one sitting. Open this folder in **Claude Code** and it reads
`CLAUDE.md`, which drives the whole flow:

1. Drop 1–4 reference images into `pipeline/reference-images/`.
2. Claude asks a short intake (theme, how many pages, the assets, what animates), then
   generates the backgrounds + cutouts with KIE — the API key is already set up in
   `pipeline/keys/keys.env`, nothing to configure.
3. Claude composes the design to ~90% and drops it into the gallery.
4. You open it here in the editor and finish the last 10%.

The whole method is written out in `pipeline/` (`ASSET-PIPELINE.md`, `INTAKE.md`,
`COMPOSE.md`) with a complete worked example config in `pipeline/theme.example.json`.

## For the technically curious

- Stack: Vite + React + TypeScript + Tailwind + Zustand. DOM renderer (what you see is the
  markup that ships).
- `README.md` — the full data-contract spec (the JSON shape shared with the pipeline; do
  not rename fields).
- `e2e/` — how the newest theme (Gatsby Nights) was produced end-to-end: the plan, the
  KIE generation script, the asset processor, the HTML baker, and `E2E-FINDINGS.md`.
- `supabase/schema.sql` + `.env.example` — optional team deployment (shared library,
  logins, live presence via Supabase + Vercel). Not needed to run locally.

## Regenerate the template gallery (rarely needed)

```bash
node scripts/extract-templates.mjs [path-to-heritage-folder]
```
