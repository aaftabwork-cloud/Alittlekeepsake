/**
 * One-shot migration: pulls every recoverable template out of the v1 studio
 * (heritage/studio.html embedded presets + the exported heritage layouts),
 * copies ONLY the referenced asset files into public/templates/assets/, and
 * writes contract-shaped project JSONs + an index.json for the dashboard
 * Templates gallery.
 *
 *   node scripts/extract-templates.mjs [path-to-heritage-folder]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const HERITAGE = process.argv[2] ?? '/Users/abdullahaftab/Documents/wedding-invite-access-copy/heritage'
const OUT = path.join(ROOT, 'public', 'templates')
const OUT_ASSETS = path.join(OUT, 'assets')

const studio = fs.readFileSync(path.join(HERITAGE, 'studio.html'), 'utf8')

/* ---------------------------------------------- extract JS consts from v1 */

function extractConst(name) {
  const start = studio.indexOf(`const ${name}=`)
  if (start < 0) throw new Error(`const ${name} not found`)
  let i = studio.indexOf('=', start) + 1
  while (/\s/.test(studio[i])) i++
  const open = studio[i]
  const close = open === '[' ? ']' : '}'
  let depth = 0, j = i, inStr = null
  for (; j < studio.length; j++) {
    const c = studio[j]
    if (inStr) {
      if (c === '\\') j++
      else if (c === inStr) inStr = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') inStr = c
    else if (c === open) depth++
    else if (c === close) { depth--; if (depth === 0) break }
  }
  return studio.slice(i, j + 1)
}

function evalConst(name, prefixes = {}) {
  const src = extractConst(name)
  const keys = Object.keys(prefixes)
  return new Function(...keys, `return (${src})`)(...Object.values(prefixes))
}

const PREFIXES = {}
for (const p of ['SBN', 'SBS', 'TG', 'EA', 'LP']) {
  const m = studio.match(new RegExp(`const ${p}='([^']+)'`))
  if (m) PREFIXES[p] = m[1]
}

/* --------------------------------------------------------- the templates */

const EMBEDDED = [
  { slug: 'storybook-night', name: 'Storybook Night', format: 'storybook', bg: '#080a18', sections: 'STORYBOOK_SECTIONS', preset: 'STORYBOOK_PRESET' },
  { slug: 'storybook-sunset', name: 'Storybook Sunset', format: 'storybook', bg: '#2c1f26', sections: 'STORYBOOK_SUNSET_SECTIONS', preset: 'STORYBOOK_SUNSET_PRESET' },
  { slug: 'tangled', name: 'Tangled Lanterns', format: 'storybook', bg: '#160f33', sections: 'TANGLED_SECTIONS', preset: 'TANGLED_PRESET' },
  { slug: 'enchanted-arch', name: 'Enchanted Arch', format: 'storybook', bg: '#1c0a26', sections: 'ENCHANTED_ARCH_SECTIONS', preset: 'ENCHANTED_ARCH_PRESET' },
  { slug: 'moonlit-lotus', name: 'Moonlit Lotus', format: 'mobile', bg: '#0d1b3a', sections: 'LOTUS_SECTIONS', preset: 'LOTUS_PRESET' },
]

/* ------------------------------------------------ asset copy + src rewrite */

const missing = []
let copied = 0
const themeFolders = new Set()

function migrateSrc(src) {
  if (!src || !src.startsWith('assets/')) return src
  const from = path.join(HERITAGE, src)
  const to = path.join(OUT_ASSETS, src.slice('assets/'.length))
  themeFolders.add(src.slice('assets/'.length).split('/')[0])
  if (!fs.existsSync(from)) {
    missing.push(src)
    return src // leave as-is → shows a re-linkable placeholder
  }
  fs.mkdirSync(path.dirname(to), { recursive: true })
  if (!fs.existsSync(to)) { fs.copyFileSync(from, to); copied++ }
  return '/templates/assets/' + src.slice('assets/'.length)
}

/** Copy a referenced theme's FULL working asset set (so operators can reuse
 * every cutout/background of that theme, not just the placed ones).
 * Skips raw/ source folders, non-images, and >5MB outliers. */
const IMG_EXT = /\.(webp|png|jpe?g|gif|svg)$/i
function copyThemeFolder(folder) {
  const rootFrom = path.join(HERITAGE, 'assets', folder)
  if (!fs.existsSync(rootFrom)) return
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'raw' || e.name === 'history') continue
        walk(p)
      } else if (IMG_EXT.test(e.name) && fs.statSync(p).size <= 5 * 1024 * 1024) {
        const rel = path.relative(path.join(HERITAGE, 'assets'), p)
        const to = path.join(OUT_ASSETS, rel)
        fs.mkdirSync(path.dirname(to), { recursive: true })
        if (!fs.existsSync(to)) { fs.copyFileSync(p, to); copied++ }
      }
    }
  }
  walk(rootFrom)
}

function migrateObjects(objs) {
  for (const o of objs) {
    if (o.type === 'img' && o.src) o.src = migrateSrc(o.src)
    if (o.type === 'group' && Array.isArray(o.objects)) migrateObjects(o.objects)
  }
}

function migrateBands(bands, fallbackColor) {
  for (const b of bands) {
    if (b.bg) b.bg = migrateSrc(b.bg)
    if (!b.color && fallbackColor) b.color = fallbackColor
  }
}

/* ------------------------------------------------------------- build all */

fs.rmSync(OUT_ASSETS, { recursive: true, force: true })
fs.mkdirSync(OUT_ASSETS, { recursive: true })
const index = []

for (const t of EMBEDDED) {
  const bands = evalConst(t.sections, PREFIXES).map(s => ({ ...s }))
  const layout = evalConst(t.preset, PREFIXES).map(o => ({ ...o }))
  migrateBands(bands, t.bg)
  migrateObjects(layout)
  const proj = { name: t.name, format: t.format, bg: t.bg, bands, layout }
  fs.writeFileSync(path.join(OUT, `${t.slug}.json`), JSON.stringify(proj, null, 1))
  index.push({
    slug: t.slug, name: t.name, file: `/templates/${t.slug}.json`,
    thumb: bands.find(b => b.bg?.startsWith('/'))?.bg ?? '',
  })
  console.log(`✓ ${t.name}: ${bands.length} sections, ${layout.length} objects`)
}

/* --- the two finished invites exported from v1 (bare engine arrays) --- */

function bandRangesFromLayout(layout) {
  const order = []
  const seen = new Set()
  for (const o of layout) {
    const b = o.band ?? ''
    if (!seen.has(b)) { seen.add(b); order.push(b) }
  }
  const range = new Map(order.map(b => [b, [Infinity, -Infinity]]))
  for (const o of layout) {
    const r = range.get(o.band)
    const y = o.y ?? o.y1 ?? 0
    const h = o.h ?? (o.fontSize ? o.fontSize * 1.3 : 24)
    r[0] = Math.min(r[0], y)
    r[1] = Math.max(r[1], Math.max(o.y2 ?? 0, y + h))
  }
  return { order, range }
}

const FINISHED = [
  {
    slug: 'celestial-abdullah-sarah', name: 'Celestial — Abdullah & Sarah',
    file: 'celestial-layout.json', color: '#0b1026',
    // uniform 900px bands verified against content ranges
    heights: () => 900,
  },
  {
    slug: 'moonlit-lotus-abdullah-sarah', name: 'Moonlit Lotus — Abdullah & Sarah',
    file: 'abdullah-sarah-moonlit-lotus-layout.json', color: '#0d1b3a',
    heights: null, // derive from content midpoints
  },
]

for (const t of FINISHED) {
  const layout = JSON.parse(fs.readFileSync(path.join(HERITAGE, t.file), 'utf8'))
  const { order, range } = bandRangesFromLayout(layout)
  let bands
  if (t.heights) {
    bands = order.map(id => ({ id, label: id, height: t.heights(), bg: '', color: t.color }))
  } else {
    // boundary = midpoint between consecutive bands' content
    const tops = [0]
    for (let i = 1; i < order.length; i++) {
      const prevEnd = range.get(order[i - 1])[1]
      const nextStart = range.get(order[i])[0]
      tops.push(Math.round((prevEnd + nextStart) / 2 / 5) * 5)
    }
    const lastEnd = Math.round((range.get(order[order.length - 1])[1] + 120) / 5) * 5
    bands = order.map((id, i) => ({
      id, label: id,
      height: (i < order.length - 1 ? tops[i + 1] : lastEnd) - tops[i],
      bg: '', color: t.color,
    }))
  }
  migrateObjects(layout)
  const proj = { name: t.name, format: 'mobile', bg: t.color, bands, layout }
  fs.writeFileSync(path.join(OUT, `${t.slug}.json`), JSON.stringify(proj, null, 1))
  const firstImg = layout.find(o => o.type === 'img' && o.src?.startsWith('/'))
  index.push({ slug: t.slug, name: t.name, file: `/templates/${t.slug}.json`, thumb: firstImg?.src ?? '' })
  console.log(`✓ ${t.name}: ${bands.length} sections (${bands.map(b => b.height).join('/')}), ${layout.length} objects`)
}

index.push({ slug: 'sample', name: 'Ayla & Zayan — Nikkah (sample)', file: '/sample-invite.json', thumb: '' })
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1))

// full theme libraries + manifest for the editor's Assets panel
for (const folder of themeFolders) copyThemeFolder(folder)
const manifest = {}
const walkOut = (dir, folder) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkOut(p, folder)
    else {
      const rel = path.relative(OUT_ASSETS, p)
      ;(manifest[folder] ??= []).push({ name: e.name, url: '/templates/assets/' + rel })
    }
  }
}
for (const e of fs.readdirSync(OUT_ASSETS, { withFileTypes: true })) {
  if (e.isDirectory()) walkOut(path.join(OUT_ASSETS, e.name), e.name)
}
for (const k of Object.keys(manifest)) manifest[k].sort((a, b) => a.name.localeCompare(b.name))
fs.writeFileSync(path.join(OUT, 'assets-manifest.json'), JSON.stringify(manifest, null, 1))
console.log(`manifest: ${Object.entries(manifest).map(([k, v]) => `${k}(${v.length})`).join(', ')}`)

console.log(`\n${copied} asset files copied${missing.length ? `; MISSING: ${[...new Set(missing)].join(', ')}` : '; none missing'}`)
