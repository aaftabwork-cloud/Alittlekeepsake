import { familyName } from './filters'

/** Font library = the v1 studio's 101 Google fonts (so every existing project
 * renders) + wedding-market additions (Urdu/Arabic/Hindi scripts etc),
 * grouped for the picker. */

export interface FontDef { family: string; weights?: number[]; italic?: boolean; tail?: string }
export interface FontGroup { label: string; fonts: FontDef[] }

const W = (family: string, weights?: number[], italic = false, tail = 'serif'): FontDef =>
  ({ family, weights, italic, tail })

export const FONT_GROUPS: FontGroup[] = [
  {
    label: 'Script & Calligraphy',
    fonts: [
      W('Great Vibes', undefined, false, 'cursive'), W('Tangerine', [400, 700], false, 'cursive'),
      W('Alex Brush', undefined, false, 'cursive'), W('Allura', undefined, false, 'cursive'),
      W('Parisienne', undefined, false, 'cursive'), W('Sacramento', undefined, false, 'cursive'),
      W('Dancing Script', [400, 700], false, 'cursive'), W('Pinyon Script', undefined, false, 'cursive'),
      W('Mrs Saint Delafield', undefined, false, 'cursive'), W('Monsieur La Doulaise', undefined, false, 'cursive'),
      W('Italianno', undefined, false, 'cursive'), W('Rouge Script', undefined, false, 'cursive'),
      W('Mr De Haviland', undefined, false, 'cursive'), W('Herr Von Muellerhoff', undefined, false, 'cursive'),
      W('Marck Script', undefined, false, 'cursive'), W('Bilbo', undefined, false, 'cursive'),
      W('Birthstone', undefined, false, 'cursive'), W('Imperial Script', undefined, false, 'cursive'),
      W('Ephesis', undefined, false, 'cursive'), W('Estonia', undefined, false, 'cursive'),
      W('Lavishly Yours', undefined, false, 'cursive'), W('Mea Culpa', undefined, false, 'cursive'),
      W('Style Script', undefined, false, 'cursive'), W('Carattere', undefined, false, 'cursive'),
      W('Niconne', undefined, false, 'cursive'), W('Kaushan Script', undefined, false, 'cursive'),
      W('Yellowtail', undefined, false, 'cursive'), W('Satisfy', undefined, false, 'cursive'),
      W('Cookie', undefined, false, 'cursive'), W('Pacifico', undefined, false, 'cursive'),
      W('Sail', undefined, false, 'cursive'), W('Petit Formal Script', undefined, false, 'cursive'),
      W('Berkshire Swash', undefined, false, 'cursive'), W('Caveat', [400, 700], false, 'cursive'),
      W('Lobster', undefined, false, 'cursive'), W('Lobster Two', [400, 700], true, 'cursive'),
    ],
  },
  {
    label: 'Serif & Display',
    fonts: [
      W('Cormorant Garamond', [300, 400, 500, 600, 700], true), W('Cormorant', [300, 400, 500, 600, 700], true),
      W('Cormorant SC', [300, 400, 500, 600, 700]), W('Cormorant Infant', [300, 400, 500, 600, 700], true),
      W('Cormorant Unicase', [300, 400, 500, 600, 700]), W('Cormorant Upright', [300, 400, 500, 600, 700]),
      W('Playfair Display', [400, 500, 600, 700, 800], true), W('Playfair Display SC', [400, 700], true),
      W('Cinzel', [400, 500, 600, 700]), W('Cinzel Decorative', [400, 700]),
      W('EB Garamond', [400, 500, 600], true), W('Lora', [400, 500, 600, 700], true),
      W('Merriweather', [300, 400, 700], true), W('Crimson Text', [400, 600, 700], true),
      W('Crimson Pro', [300, 400, 500, 600], true), W('Libre Baskerville', [400, 700], true),
      W('Spectral', [300, 400, 500, 600], true), W('Bodoni Moda', [400, 500, 600, 700], true),
      W('DM Serif Display', [400], true), W('DM Serif Text', [400], true),
      W('Marcellus'), W('Marcellus SC'), W('Forum'), W('Italiana'), W('Cardo', [400, 700], true),
      W('Prata'), W('Gilda Display'), W('Abril Fatface'), W('Yeseva One'),
      W('Sorts Mill Goudy', [400], true), W('Old Standard TT', [400, 700], true),
      W('Vollkorn', [400, 500, 600, 700], true), W('Source Serif Pro', [400, 600, 700], true),
      W('PT Serif', [400, 700], true), W('Noto Serif', [400, 700], true),
      W('Bitter', [400, 500, 600, 700], true), W('Arvo', [400, 700], true),
      W('Domine', [400, 500, 600, 700]), W('Alegreya', [400, 500, 600, 700], true),
      W('Neuton', [300, 400, 700]), W('Rufina', [400, 700]),
      W('Frank Ruhl Libre', [300, 400, 500, 700]), W('Fraunces', [300, 400, 500, 600, 700], true),
      W('Newsreader', [300, 400, 500, 600], true), W('Della Respira'), W('Unna', [400, 700], true),
      W('Marko One'),
    ],
  },
  {
    label: 'Sans & Modern',
    fonts: [
      W('Montserrat', [300, 400, 500, 600, 700], true, 'sans-serif'),
      W('Jost', [300, 400, 500, 600], true, 'sans-serif'),
      W('Josefin Sans', [300, 400, 500, 600, 700], true, 'sans-serif'),
      W('Tenor Sans', undefined, false, 'sans-serif'),
      W('Raleway', [300, 400, 500, 600, 700], true, 'sans-serif'),
      W('Poppins', [300, 400, 500, 600, 700], true, 'sans-serif'),
      W('Roboto', [300, 400, 500, 700], true, 'sans-serif'),
      W('Open Sans', [300, 400, 600, 700], true, 'sans-serif'),
      W('Lato', [300, 400, 700], true, 'sans-serif'),
      W('Oswald', [300, 400, 500, 600], false, 'sans-serif'),
      W('Nunito', [300, 400, 600, 700], true, 'sans-serif'),
      W('Quicksand', [300, 400, 500, 600, 700], false, 'sans-serif'),
      W('DM Sans', [400, 500, 700], true, 'sans-serif'),
      W('PT Sans', [400, 700], true, 'sans-serif'),
      W('Noto Sans', [400, 700], true, 'sans-serif'),
      W('Alegreya Sans', [300, 400, 500, 700], true, 'sans-serif'),
      W('Philosopher', [400, 700], true, 'sans-serif'),
    ],
  },
  {
    label: 'Urdu · Arabic · Hindi',
    fonts: [
      W('Noto Nastaliq Urdu', [400, 500, 600, 700]), W('Gulzar'),
      W('Amiri', [400, 700], true), W('Aref Ruqaa', [400, 700]),
      W('Scheherazade New', [400, 500, 600, 700]), W('Tiro Devanagari Hindi', undefined, true),
      W('Rozha One'), W('Yatra One'),
    ],
  },
]

export const ALL_FONTS: FontDef[] = FONT_GROUPS.flatMap(g => g.fonts)

const loaded = new Set<string>()

/** Inject a Google Fonts stylesheet for a family or stack (idempotent). */
export function ensureFont(familyOrStack: string) {
  const family = familyName(familyOrStack)
  if (!family || loaded.has(family)) return
  loaded.add(family)
  const def = ALL_FONTS.find(f => f.family === family)
  const weights = def?.weights ?? [400, 500, 600, 700]
  const axes = def?.italic
    ? `ital,wght@${weights.map(w => `0,${w}`).join(';')};${weights.map(w => `1,${w}`).join(';')}`
    : `wght@${weights.join(';')}`
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:${axes}&display=swap`
  document.head.appendChild(link)
}

export function ensureFonts(familiesOrStacks: Iterable<string>) {
  for (const f of familiesOrStacks) ensureFont(f)
}

/** Google Fonts URL covering the given families/stacks (for the HTML export). */
export function fontsHref(familiesOrStacks: string[]): string {
  const fams = [...new Set(familiesOrStacks.map(familyName).filter(Boolean))]
  const parts = fams.map(fam => {
    const def = ALL_FONTS.find(f => f.family === fam)
    const weights = def?.weights ?? [400, 500, 600, 700]
    const axes = def?.italic
      ? `ital,wght@${weights.map(w => `0,${w}`).join(';')};${weights.map(w => `1,${w}`).join(';')}`
      : `wght@${weights.join(';')}`
    return `family=${encodeURIComponent(fam).replace(/%20/g, '+')}:${axes}`
  })
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`
}

/** Build a sensible stack when the picker changes the family:
 * keep the old stack's fallback tail if it had one, else use the font's generic. */
export function buildStack(newFamily: string, previousStack: string): string {
  const prevTail = previousStack.includes(',')
    ? previousStack.split(',').slice(1).join(',').trim()
    : ''
  const def = ALL_FONTS.find(f => f.family === newFamily)
  const tail = prevTail || def?.tail || 'serif'
  return `${newFamily}, ${tail}`
}
