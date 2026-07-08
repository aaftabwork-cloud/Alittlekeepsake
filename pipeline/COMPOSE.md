# COMPOSE — turn generated assets into the ~90% design JSON

After the assets exist in `public/templates/assets/<theme>/`, author a **project JSON** in the
tool's contract shape. This is the "90% there" design the human finishes in the editor. Full
spec is in the repo `README.md`; the fastest path is to copy a worked example
(`public/templates/gatsby-nights.json`) and adapt it.

## The shape
```jsonc
{
  "name": "<Theme> — <Couple>",
  "format": "mobile",              // mobile=390 wide · tablet=768 · desktop=1920 · storybook=941
  "bg": "",
  "bands": [                       // one per page, stacked top→bottom
    { "id": "hero", "label": "The Marquee", "height": 690,
      "bg": "/templates/assets/<theme>/c-marquee.webp", "color": "#0a0a0f" }
  ],
  "layout": [ /* objects, see below */ ]
}
```

## Objects — the two you need
Coordinates are **document-absolute** (x from the left of the 390-wide artboard; y from the top
of the WHOLE document, not the band). `band` is just which page it belongs to.

```jsonc
// text
{ "type":"text", "text":"ABDULLAH", "x":35, "y":920, "w":320, "band":"names",
  "fontSize":34, "fontFamily":"Cinzel Decorative, Georgia, serif", "fill":"#e9c97c",
  "textAlign":"center", "fontWeight":"400", "charSpacing":0,      // charSpacing = thousandths of em
  "opacity":1, "blend":"source-over",
  "custom":true, "field":"groom_name",                            // tag editable fields (see below)
  "anim":{ "name":"reveal-up", "dur":1.2 } }                      // animation intent (optional)

// image (a generated cutout)
{ "type":"img", "src":"/templates/assets/<theme>/cutouts/fx-stars.png",
  "x":255, "y":270, "w":100, "h":105, "band":"hero",
  "opacity":1, "blend":"screen",                                  // "screen" makes gold pop on dark bg
  "anim":{ "name":"twinkle", "dur":3 } }
```

## Rules that keep it valid (don't break these)
- **Never rename fields.** The contract is byte-verified against the editor.
- `fontFamily` is a full CSS stack (`"Cinzel Decorative, Georgia, serif"`). Use fonts from the
  editor's set (Cinzel/Cinzel Decorative, Cormorant Garamond, Great Vibes, Playfair Display,
  Marcellus, Prata, Jost, …).
- `blend` holds canvas composite names; default `source-over`. Use `screen` for gold-on-dark
  cutouts so they glow instead of sitting in a box.
- Compute each band's y-range as the running sum of heights, and place objects within it.
  e.g. bands [690,690,690,690] → band 2 ("names") spans y 690–1380.

## Animation vocabulary (the `anim.name` values)
Entrance: `reveal-up`, `reveal-soft`. Ambient: `twinkle`, `breathe`, `bob`, `float-drift`,
`drift-x`, `glide`, `flicker`, `ripple`, `streak`, `swim`, `dart`, `bloom-pulse`, `bob-rotate`.
Keep motion restrained. Add a free-text `note` on an object to describe intent the presets
don't capture — the editor and the human read it.

## Editable fields (`field`) — makes reskins fast
Tag the couple's names, date, venue, phone with a `field` key (`groom_name`, `bride_name`,
`date`, `venue`, `rsvp_phone`, or a custom string) and `"custom": true`. These surface in the
editor's **Fields** tab so the design can be retexted for a new couple in seconds.

## Leave it at ~90%
Deliberately leave small imperfections (a slightly off position, one placeholder text, an
approximate colour). The editor exists for exactly that last 10% — don't over-polish here.

## Register it so it opens in the tool
Add an entry to `public/templates/index.json`:
```json
{ "slug":"<theme>", "name":"<Theme>", "file":"/templates/<theme>.project.json",
  "thumb":"/templates/assets/<theme>/c-<first-band>.webp" }
```
It now appears in the dashboard gallery. Then: `npm run dev` → open it → finish → File ▸ Export.
