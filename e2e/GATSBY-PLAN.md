# Gatsby Nights — Art Deco theme plan (E2E pipeline test)

Retro 1920s Art Deco wedding invite. Luminous champagne-gold geometry on deep noir —
chosen because gold-on-black is the exact regime the luminance key was built for, and
it's stylistically distinct from all 7 existing themes (all organic/painterly).

## Palette
- Noir night: `#0a0a0f`
- Deep emerald tint: `#0f2b26` (sparingly, interior shadows)
- Champagne gold: `#e9c97c`
- Brass: `#b9862f`
- Ivory: `#f3ecd8`

Fonts (bake stage): Poiret One / Limelight (deco display), Cormorant Garamond (body),
Jost letterspaced overlines — all already in the editor's 46-font set or Google Fonts.

## Story — 4 scroll bands (390px wide, ~880px tall each)
| band | file | beat |
|---|---|---|
| 1 hero | `c-marquee` (ANCHOR, t2i) | Grand deco theatre facade at night, sunburst marquee, gold rays — "the evening begins" |
| 2 names | `c-ballroom` | Inside the gold ballroom, geometric arches + chandelier glow, calm open centre for the couple's names |
| 3 events | `c-skyline` | Deco skyline with searchlight beams, open dark zones for event cards |
| 4 rsvp | `c-finale` | Fireworks + gold confetti over the rooftops, calm centre for RSVP |

Chain: anchor = band 1; bands 2–4 i2i off [anchor + previous band] for edge continuity
(the Lotus chain trick).

## Asset sheets — 4 i2i calls, 1:1 1K, pure #000 bg, strict 2×2 = 16 cutouts
| sheet | TL | TR | BL | BR |
|---|---|---|---|---|
| sheet-ornaments | sunburst fan | geometric divider | corner flourish | medallion frame |
| sheet-objects | champagne coupes | deco chandelier | gramophone | vintage clock face |
| sheet-ambient | confetti cluster | firework burst | deco star cluster | gold feather |
| sheet-arch | deco archway | skyline silhouette | ornate frame | fan palm leaf |

Animation intent (v1 preset vocabulary):
- confetti / stars → `twinkle`; chandelier → `bob`; coupes → `breathe`;
  firework → `reveal-soft` + `twinkle`; feather → `float-drift`;
  text blocks → `reveal-up` / `reveal-soft`.

## Budget: 8 KIE calls (1 t2i + 3 band i2i + 4 sheet i2i) ≈ $1–2.
