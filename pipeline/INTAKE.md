# INTAKE — reference images + the questions that shape a theme

Before generating anything, agree the theme with the designer. This is where the pipeline
"decides how many pages" and what gets made. Keep it to one short conversation.

## Reference images (the starting point)
The designer drops 1–4 images into `pipeline/reference-images/` — a mood, a palette, a card
they like, a scene. Use them one of two ways:
- **Anchor from references (preferred when they have strong refs):** set `anchor.mode:"i2i"`
  and list the file paths in `anchor.refs`. The anchor is generated *in that style*, and every
  band/sheet inherits it. Write the `style` line to describe the palette/aesthetic you see in
  the references (KIE reads the images as a strict style guide, not a composition to copy).
- **Anchor from a prompt (when refs are only loose inspiration):** set `anchor.mode:"t2i"` and
  write a rich `anchor.prompt`; fold the references' palette into the `style` line.

Either way, look at the refs and name the palette in hex where you can — it makes the whole
theme cohere.

## The four questions
Ask these, then fill in `theme.json`:

1. **Theme name, mood, palette?** → `theme`, `style` (the aesthetic + exact hex colours).
2. **How many bands (pages), and the story of each — top to bottom?** → the `bands` array.
   A mobile invite is usually **4–6 bands**. Each band is one scene/beat. Typical shape:
   `hero/opening → couple's names → event details → RSVP/closing`. The first band is the anchor.
   Keep a calm, open zone in each band where text will sit.
3. **What assets (cutouts) are needed?** → the `sheets` array, 4 per sheet, grouped logically
   (ornaments / objects / ambient FX / structural). Name each cutout in the sheet's `names`
   array (this is the output filename and how you'll reference it when composing).
4. **What should move, and how?** → note the animation preset per cutout (used in `COMPOSE.md`).
   Restrained is better: a few `twinkle`/`breathe`/`float-drift` ambients, `reveal-up` on text.

## Turning answers into `theme.json`
Copy `theme.example.json` (a complete, real Gatsby config) and replace: `theme`, `style`,
`anchor` (mode/prompt/refs), the per-band `prompt`s, and the per-sheet quadrant descriptions +
`names`. Keep `bandCommon`/`sheetCommon`/`chainNote` unless the format changes — they carry the
"full-bleed, blend at edges, pure-black sheet" rules that make the pipeline work.

Do not generate until the designer has agreed the band list and asset list — regenerating is
the expensive part.
