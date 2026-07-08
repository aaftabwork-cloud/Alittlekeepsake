# E2E Pipeline Test — Findings (Gatsby Nights, 2026-07-03)

Full production loop executed: KIE generation → local processing → hand-composed
contract JSON (6 planted flaws) → Invite Studio import → all flaws fixed via the
editor UI → export both JSONs → deep-diff verified → GSAP HTML baked from the
exports → Playwright-verified at 390×844 (0 JS errors, 0 failed requests).

**Verdict: the loop works end-to-end.** 8/8 KIE calls succeeded first try; the
recipe docs (ASSET-PIPELINE.md) were followable verbatim; import/export was
lossless (only the 6 intended edits + v1-default materialization in the diff).

## Artifacts
- Theme plan: `e2e/GATSBY-PLAN.md` · generator: `e2e/gen_gatsby.mjs` · keyer: `e2e/process_gatsby.py`
- Assets: `e2e/assets/gatsby/` (4 bands PNG+WebP, 4 raw sheets, 16 cutouts) — staged copy in `public/templates/assets/gatsby/`
- Draft (with flaws): `e2e/gatsby-draft.project.json`
- Finished exports: `e2e/exports/gatsby-final.project.json` + `gatsby-final-layout.json`
- Baker: `e2e/bake_gatsby.py` → `public/e2e-bake/gatsby.html` (served at /e2e-bake/gatsby.html)

## What was smooth
1. **KIE recipe verbatim** — anchor t2i + chained band i2i (Lotus continuity trick) + 2×2 black
   sheets: zero retries, style lock held across all 8 images. Gold-on-black Art Deco is an ideal
   regime for the luminance key: 16/16 cutouts clean, no halos.
2. **Sparse draft JSON imports perfectly** — hand-authored contract JSON with defaults omitted,
   engine-style `anim:{name,dur}` inside a project file, field tags, notes: all accepted.
   Sections, layers grouping, field badges, missing-src placeholder all correct on first open.
3. **Editor affordances are automatable and operator-friendly** — layer-row select, Enter-to-edit
   text, arrow-key nudges (shift ×10), colour input, Replace… dialog: all 6 flaws fixable without
   touching JSON.
4. **Exports are v1-canonical** — project JSON uses v1's `motion`/`anim`-string/`motionOpts` shape,
   engine layout uses `{name,dur}`; verified against `heritage/studio.html` source. Animation
   intent + free-text `note`s survive the full loop into the engine layout the pipeline reads.
5. **Bake step is mechanical** — engine layout (absolute coords, band list from project JSON)
   → GSAP page in ~150 lines; preset vocabulary mapped 1:1 to tweens.

## Friction found (ranked)
| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Re-linked image inlines a **base64 data URL** into the doc (~275 KB for one small PNG; a real session would balloon the export to MBs). Local-mode `uploadAsset` has no host, so this is structural. | **P1** | Part B #1 (batch re-link matching by filename → path srcs) + Supabase deploy (#14) are the real fixes |
| 2 | Re-linked layer showed **base64 garbage as its name** (src tail fallback). | **P0** | **FIXED**: Replace… now stamps `name` with the filename; data-URL srcs fall back to "Image" (`Inspector.tsx`, `LayersPanel.tsx`) |
| 3 | New-theme assets need a **manual `cp` into `public/templates/assets/`** before srcs resolve — fine for us, invisible to a non-dev operator. | P2 | fold into Part B #1/#2 (import folder → library) |
| 4 | Multiple identical layer labels (3× `orn-divider.png`) — human-distinguishable only by section grouping. | P3 | rename exists; auto-suffix could help |
| 5 | Playwright-only: text locators match both canvas text and layer rows (caused one mis-edit mid-test, repaired via reimport). Needs `data-testid` on layer rows if we keep automating the editor. | P3 | note for the test harness |

## Contract confirmations (for the record)
- Object coords are **document-absolute**; `band` is membership only. Band heights vary freely.
- Importer accepts both anim forms; each export re-canonicalizes. Round-trip through
  import→edit→export→reimport→export was stable.
- `charSpacing` thousandths-em, full font stacks, `blend` composite names: all held.

## Part B reprioritization (by these findings)
1. **#1 Batch asset re-link** — confirmed as the top real friction (and now also the data-URL fix).
2. **#14 Deploy (Supabase/Vercel)** — promoted: it's the structural fix for data-URL srcs (shared
   library gives real URLs), not just a team nicety.
3. **#4 Field quick-fill panel** — the reskin motion worked but touching each field via layers is slow.
4. **#2 Drag-and-drop**, **#3 duplicate/reorder sections**, then the rest as planned.
