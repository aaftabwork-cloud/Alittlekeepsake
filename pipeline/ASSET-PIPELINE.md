# Asset Generation Pipeline — the method

How Craft themes are generated. This is the proven recipe behind every shipped theme
(Celestial, Moonlit Lotus, Gatsby Nights). Follow it; don't reinvent it.

## Principles
- **Minimise KIE calls.** Each call costs money and time. Batch: 4 assets per sheet, never 1.
- **Style lock via an anchor.** ONE image (the anchor) fixes the palette, lighting, and art
  style. Every other image is generated *image-to-image off the anchor*, so the whole theme
  looks like one hand. If the designer gives reference images, the anchor is generated *from*
  them (i2i); otherwise the anchor is text-to-image from a rich prompt.
- **Pure-black sheets.** Asset sheets render on solid #000000 so a deterministic luminance key
  replaces background removal — cleaner edges on bright/gold art, no ML model needed.
- **Backgrounds are a story.** One background per band/page, told top to bottom; each band
  continues the mood of the one above it (the continuity "chain").

## Stages (all driven by `scripts/gen.mjs` + a `theme.json`)

### 1 — Anchor (1 call)
Locks the style. `gen.mjs anchor`. `t2i` from a prompt, or `i2i` off the designer's reference
images (`anchor.mode:"i2i"`, `anchor.refs:[...]`). Saved as the theme's first band (e.g.
`c-<first>.png`) and reused as the style reference for everything else.

### 2 — Backgrounds / bands (1 call each, 9:16, 1K)
`gen.mjs bands`. Each band is i2i off the anchor (+ the previous band, when `chain:true`, for
an invisible seam). One per page, narrated in scroll order. Keep a calm, open zone where text
will sit. No text, people, logos, or watermarks in the image.

### 3 — Asset sheets (1 call per 4 assets, 1:1, 1K, PURE BLACK)
`gen.mjs sheets`. Four subjects in a strict 2×2 grid on solid black, i2i off the anchor. Each
subject centred in its quadrant with clear margin, not touching edges or each other. Group
logically: ornaments, objects, ambient FX, structural (arches/frames).

### 4 — Process into cutouts (no API calls)
`process_sheets.py <theme.json>` quadrant-splits each sheet and luminance-keys it:
```
luma  = max(r,g,b)                              # brightness
alpha = clip((luma - 10) / 245, 0, 1) * 255     # 10 = noise floor, kills black-bg speckle
rgb   = pixel * (255 / max(luma,1))             # un-premultiply against black
```
→ trimmed transparent PNGs in `cutouts/`. Bright/gold subjects survive; dark subjects vanish
(that's why everything is rendered luminous on black). For photographic or dark-silhouette
subjects use `cut.py` (rembg) instead of the luminance key.

### 5 — Animation intent
Not an image step — a decision. For each cutout, note whether it animates and how, using the
tool's preset vocabulary (`twinkle`, `bob`, `breathe`, `float-drift`, `reveal-up`,
`reveal-soft`, …). This gets written into the project JSON in `COMPOSE.md`, so the editor and
the final bake know what to build.

## KIE reference (already wired into `gen.mjs`)
- Create: `POST https://api.kie.ai/api/v1/jobs/createTask`, header `Authorization: Bearer <KIE_API_KEY>`
- Poll:  `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>` every 8s (max ~10 min)
- Body: `{ model, input:{ prompt, input_urls?, aspect_ratio, resolution } }`
- Models: `gpt-image-2-text-to-image` (anchor t2i), `gpt-image-2-image-to-image` (everything else)
- Aspect: `9:16` bands, `1:1` sheets. Resolution: `1K` (use `2K` only for print).
- Reference images / anchor are hosted on imgbb so KIE can fetch them — `gen.mjs` handles this.
- **Node only.** Python is blocked by KIE. Result URLs expire ~24h — `gen.mjs` downloads at once.

## Budget
A typical mobile theme = 1 anchor + 3 bands + 4 sheets = **8 calls, ≈ $1–2**, ~16 cutouts.
