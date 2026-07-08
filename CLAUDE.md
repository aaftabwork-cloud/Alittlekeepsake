# CLAUDE.md — Craft (read this first)

You are helping a **designer** turn a rough idea + a few reference images into a finished,
animated wedding invitation. This folder contains everything needed: an AI **generation
pipeline** and the **finishing editor** (the tool). Your job is to drive the whole flow.

**Do not ask the user to install or configure anything they don't need. The API keys are
already here (`pipeline/keys/keys.env`). Just run the steps.**

---

## The full flow (what you will do, in order)

```
reference images ─▶ [1] generate assets (KIE)  ─▶ [2] compose the ~90% design
                                                          │
                       finished, shippable invite ◀─ [4] finish in the tool ◀─ [3] import
```

1. **Generate assets** — from the designer's reference images + a short intake, produce the
   painted backgrounds and transparent cutouts with KIE. → see `pipeline/INTAKE.md` + `pipeline/ASSET-PIPELINE.md`
2. **Compose the ~90% design** — lay those assets into a project JSON in the tool's contract
   shape (this is the "90% there" design we hand to the human). → see `pipeline/COMPOSE.md`
3. **Import into the tool** — register the design so it opens in Craft (the editor).
4. **Finish to 100%** — the designer opens Craft, fixes the last 10% (spacing, text, colour,
   animation intent), and exports the final JSON. Optionally bake the final animated HTML.

Steps 1–3 are you (Claude Code). Step 4 is the human in the editor. That handoff is deliberate:
the last 10% is taste, and a person should own it.

---

## Step 1 — Generate the assets

Read `pipeline/ASSET-PIPELINE.md` (the method) and `pipeline/INTAKE.md` (what to ask the
designer and how reference images feed in). Then:

1. The designer drops reference images into `pipeline/reference-images/`.
2. Agree the theme with them using the intake in `pipeline/INTAKE.md` (name/mood/palette,
   **how many bands/pages and the storyline of each**, the asset list, what should animate).
3. Write a `pipeline/theme.json` for this theme — copy `pipeline/theme.example.json` (a real,
   complete Gatsby config) and edit it. Put the reference-image paths in `anchor.refs` and set
   `anchor.mode` to `"i2i"` when generating the anchor *from* the references.
4. Generate (keys auto-load from `pipeline/keys/keys.env`):
   ```bash
   cd pipeline/scripts
   node gen.mjs all ../theme.json --dry   # validate config + prompts + paths, no API calls
   node gen.mjs all ../theme.json         # anchor -> bands -> sheets (≈ $1–2, a few minutes)
   python3 process_sheets.py ../theme.json # luminance-key the sheets into transparent cutouts
   ```
   Output lands in `public/templates/assets/<theme>/` (bands + `raw/` sheets + `cutouts/`) —
   already where the tool serves from. **Look at the results** before composing; regenerate any
   weak band/sheet with `node gen.mjs bands ../theme.json <prefix>`.

## Step 2 — Compose the ~90% design

Read `pipeline/COMPOSE.md` and the tool's data contract in `README.md`. Author
`public/templates/<theme>.project.json`: bands referencing the generated backgrounds, text
and cutout objects placed at 390-wide coordinates, editable fields tagged, animation intent
set. Use `public/templates/gatsby-nights.json` as a worked reference. Leave the last ~10%
imperfect on purpose — that's the human's job.

## Step 3 — Import into the tool

Register the design so it shows in the dashboard gallery: add an entry to
`public/templates/index.json` (slug, name, file, thumb). Now it opens in Craft like any template.

## Step 4 — Finish (human) + optional final render

Start the editor and hand it to the designer:
```bash
npm install        # first time only
npm run dev        # http://localhost:5199 — pick the new template, finish it, File ▸ Export
```
Optional final animated render from the exported JSON:
```bash
python3 pipeline/scripts/bake.py <exported>.project.json invite.html
```

---

## Map of this folder
- `START-HERE.md` — the human quickstart (give this to the designer).
- `pipeline/` — the KIE generation pipeline: `ASSET-PIPELINE.md` (method), `INTAKE.md`
  (questions + reference images), `COMPOSE.md` (assets → 90% JSON), `scripts/` (gen, process,
  bake, rembg), `keys/keys.env` (API keys, already set), `theme.example.json` (a real config).
- `README.md` — the tool's data-contract spec (the JSON shape; **do not rename fields**).
- `e2e/` — a complete worked example: the Gatsby Nights theme produced end-to-end this way
  (`GATSBY-PLAN.md`, the gen/process/bake scripts it was built with, and `E2E-FINDINGS.md`).
- `src/`, `public/`, `supabase/` — the editor app itself.

## Rules
- KIE calls go through Node (`gen.mjs`) — Python gets blocked. Result URLs expire ~24h; the
  script downloads immediately.
- Asset sheets MUST be 2×2 on a pure-black background — the luminance key depends on it.
  Bright/gold subjects survive the key; for dark or photographic subjects use `scripts/cut.py`.
- Never rename fields in the project/layout JSON — the contract is byte-verified against the
  tool. Animation names come from the tool's preset vocabulary (see `COMPOSE.md`).
- Generate assets straight into `public/templates/assets/<theme>/` so paths resolve with no
  copying.
