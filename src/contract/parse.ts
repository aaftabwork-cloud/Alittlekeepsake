import {
  AnyObj, Band, DEFAULT_ADJUST, FORMATS, GroupObj, ProjectDoc, bandAtY, uid,
} from '../types'

/**
 * Tolerant importer for both real pipeline shapes (verified against
 * heritage/studio.html and its exports):
 *
 * 1. PROJECT shape — { name, format?, bands|sections|pages: [...],
 *    layout|objects: [...], ... }. Sections are
 *    { id, label, height, bg:<image url>, color:<solid> } in v1;
 *    we also accept { name, bg:<color>, bgImage } (v2 style).
 * 2. ENGINE/bare-array shape — a flat list of objects (studio.html's
 *    exportLayout / the old heritage *-layout.json files). Objects there may
 *    carry `anim: {name, dur, ...opts}` and `editable` instead of the flat
 *    motion block; bands are derived from the objects' `band` ids.
 *
 * Unknown keys anywhere are preserved in `extra` bags and re-emitted on
 * export, so round-trips stay lossless.
 */

const num = (v: unknown, d = 0): number => (typeof v === 'number' && isFinite(v) ? v : d)
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d = false): boolean => (typeof v === 'boolean' ? v : d)

const BASE_KEYS = new Set([
  'id', 'type', 'x', 'y', 'opacity', 'blend', 'band', 'angle', 'flipX', 'flipY',
  'name', 'locked', 'hidden', 'custom', 'field', 'motion', 'anim', 'dur', 'motionOpts',
  'editable', // engine-schema marker for custom fields
])
const TYPE_KEYS: Record<string, string[]> = {
  text: ['text', 'w', 'fontSize', 'fontFamily', 'fill', 'textAlign', 'fontStyle',
    'fontWeight', 'charSpacing', 'underline', 'linethrough', 'lineHeight', 'textCase',
    'textBackgroundColor', 'boxFill', 'boxFillOpacity', 'boxPad', 'shadow'],
  img: ['src', 'w', 'h', 'crop', 'shadow', 'adjust'],
  rect: ['w', 'h', 'fill', 'gradient', 'shadow', 'stroke', 'strokeWidth', 'rx'],
  ellipse: ['w', 'h', 'fill', 'gradient', 'shadow', 'stroke', 'strokeWidth'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'strokeWidth'],
  group: ['w', 'h', 'scaleX', 'scaleY', 'objects'],
}

function collectExtra(raw: Record<string, unknown>, type: string): Record<string, unknown> | undefined {
  const known = new Set([...BASE_KEYS, ...(TYPE_KEYS[type] ?? [])])
  const extra: Record<string, unknown> = {}
  let has = false
  for (const k of Object.keys(raw)) {
    if (!known.has(k)) { extra[k] = raw[k]; has = true }
  }
  return has ? extra : undefined
}

/** Width of an object for extent math (children of groups etc). */
function rawWidth(o: AnyObj): number {
  if (o.type === 'line') return Math.abs(o.x2 - o.x1)
  if (o.type === 'text') return o.w
  if (o.type === 'group') return o.w * o.scaleX
  return (o as { w: number }).w
}
function rawHeight(o: AnyObj): number {
  if (o.type === 'line') return Math.abs(o.y2 - o.y1)
  if (o.type === 'text') return o.fontSize * o.lineHeight * 1.3
  if (o.type === 'group') return o.h * o.scaleY
  return (o as { h: number }).h
}

function translate(o: AnyObj, dx: number, dy: number) {
  o.x += dx; o.y += dy
  if (o.type === 'line') { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy }
  if (o.type === 'group') for (const c of o.objects) translate(c, dx, dy)
}

export function parseObject(raw: Record<string, unknown>, fallbackBand: string): AnyObj | null {
  const type = str(raw.type)
  if (!TYPE_KEYS[type]) return null

  // engine schema: anim may be an object {name, dur, ...opts}
  const animObj = raw.anim && typeof raw.anim === 'object' ? raw.anim as Record<string, unknown> : null
  const motionOpts: Record<string, unknown> = {
    ...(animObj ?? {}),
    ...(raw.motionOpts && typeof raw.motionOpts === 'object' ? raw.motionOpts as object : {}),
  }
  delete motionOpts.name

  const base = {
    id: str(raw.id) || uid(),
    hadId: typeof raw.id === 'string' && raw.id !== '' || undefined,
    x: num(raw.x),
    y: num(raw.y),
    opacity: raw.opacity === undefined ? 1 : num(raw.opacity, 1),
    blend: str(raw.blend, 'source-over') || 'source-over',
    band: str(raw.band, fallbackBand),
    angle: num(raw.angle),
    flipX: bool(raw.flipX),
    flipY: bool(raw.flipY),
    name: str(raw.name),
    locked: bool(raw.locked),
    hidden: bool(raw.hidden),
    custom: bool(raw.custom) || bool(raw.editable),
    field: str(raw.field),
    motion: (str(raw.motion) === 'animated' || animObj ? 'animated' : 'static') as 'animated' | 'static',
    anim: animObj ? str(animObj.name) : str(raw.anim),
    dur: num(raw.dur, num(animObj?.dur, 0)),
    motionOpts,
    extra: collectExtra(raw, type),
  }

  switch (type) {
    case 'text':
      return {
        ...base, type,
        text: str(raw.text),
        w: num(raw.w, 320),
        fontSize: num(raw.fontSize, 14),
        fontFamily: str(raw.fontFamily, 'Cormorant Garamond, Georgia, serif'),
        fill: str(raw.fill, '#f0e6c0'),
        textAlign: (['left', 'center', 'right', 'justify'].includes(str(raw.textAlign)) ? raw.textAlign : 'left') as 'left',
        fontStyle: str(raw.fontStyle) === 'italic' ? 'italic' : 'normal',
        fontWeight: (typeof raw.fontWeight === 'number' ? raw.fontWeight : str(raw.fontWeight, 'normal')),
        charSpacing: num(raw.charSpacing),
        underline: bool(raw.underline),
        linethrough: bool(raw.linethrough),
        lineHeight: num(raw.lineHeight, 1.16),
        textCase: (['upper', 'lower', 'title'].includes(str(raw.textCase)) ? raw.textCase : 'none') as 'none',
        textBackgroundColor: str(raw.textBackgroundColor),
        boxFill: str(raw.boxFill),
        boxFillOpacity: raw.boxFillOpacity === undefined ? 100 : num(raw.boxFillOpacity, 100),
        boxPad: num(raw.boxPad),
        shadow: (raw.shadow ?? null) as any,
      }
    case 'img':
      return {
        ...base, type,
        src: str(raw.src),
        w: num(raw.w, 100),
        h: num(raw.h, 100),
        crop: (raw.crop ?? null) as any,
        shadow: (raw.shadow ?? null) as any,
        adjust: { ...DEFAULT_ADJUST, ...(raw.adjust && typeof raw.adjust === 'object' ? raw.adjust as object : {}) },
      }
    case 'rect':
      return {
        ...base, type,
        w: num(raw.w, 100), h: num(raw.h, 100),
        fill: str(raw.fill, '#c9a84c'),
        gradient: (raw.gradient ?? null) as any,
        shadow: (raw.shadow ?? null) as any,
        stroke: str(raw.stroke),
        strokeWidth: num(raw.strokeWidth),
        rx: num(raw.rx),
      }
    case 'ellipse':
      return {
        ...base, type,
        w: num(raw.w, 100), h: num(raw.h, 100),
        fill: str(raw.fill, '#c9a84c'),
        gradient: (raw.gradient ?? null) as any,
        shadow: (raw.shadow ?? null) as any,
        stroke: str(raw.stroke),
        strokeWidth: num(raw.strokeWidth),
      }
    case 'line': {
      const x1 = num(raw.x1), y1 = num(raw.y1)
      const x2 = num(raw.x2, x1 + 100), y2 = num(raw.y2, y1)
      return {
        ...base, type,
        x: Math.min(x1, x2), y: Math.min(y1, y2),
        x1, y1, x2, y2,
        stroke: str(raw.stroke, '#c9a84c'),
        strokeWidth: num(raw.strokeWidth, 1),
      }
    }
    case 'group': {
      const children = Array.isArray(raw.objects)
        ? (raw.objects as Record<string, unknown>[]).map(c => parseObject(c, base.band)).filter(Boolean) as AnyObj[]
        : []
      const scaleX = num(raw.scaleX, 1), scaleY = num(raw.scaleY, 1)
      const g: GroupObj = {
        ...base, type,
        w: num(raw.w, 100), h: num(raw.h, 100),
        scaleX, scaleY,
        childMode: 'absolute',
        objects: children,
      }
      if (children.length) {
        const minX = Math.min(...children.map(c => c.x))
        const maxX = Math.max(...children.map(c => c.x + rawWidth(c)))
        const minY = Math.min(...children.map(c => c.y))
        const maxY = Math.max(...children.map(c => c.y + rawHeight(c)))
        const extW = Math.max(1, maxX - minX)
        const extH = Math.max(1, maxY - minY)
        // Fabric (v1 project files) serializes group children center-relative:
        // their bounds are centered on 0. Detect and convert to unscaled
        // absolute for editing — the renderer applies the group scale, so the
        // conversion is a pure translate: abs = group.xy + (rel - min).
        const centered =
          Math.abs(minX + maxX) < extW * 0.5 + 4 && Math.abs(minY + maxY) < extH * 0.5 + 4
        if (centered) {
          g.childMode = 'center-relative'
          for (const c of g.objects) translate(c, g.x - minX, g.y - minY)
        }
        g.w = extW
        g.h = extH
      }
      return g
    }
  }
  return null
}

/* ------------------------------------------------------------------ bands */

const BAND_KEYS = new Set(['id', 'name', 'label', 'height', 'h', 'bg', 'background', 'color', 'bgImage', 'bgSrc'])

const looksLikeColor = (v: string) =>
  v === '' || /^#|^rgb|^hsl|^transparent$/i.test(v.trim())

function parseBand(raw: Record<string, unknown>, i: number): Band {
  const extra: Record<string, unknown> = {}
  let has = false
  for (const k of Object.keys(raw)) {
    if (!BAND_KEYS.has(k)) { extra[k] = raw[k]; has = true }
  }

  // v1: bg = image url, color = solid. v2: bg = solid, bgImage = image.
  const rawBg = str(raw.bg)
  const bgIsImage = 'bg' in raw && !looksLikeColor(rawBg)
  // bg-image-only v1 bands get no solid color — don't invent one on export
  const color = str(raw.color) || (!bgIsImage ? rawBg : '') || str(raw.background)
    || (bgIsImage ? '' : '#ffffff')
  const image = bgIsImage ? rawBg : (str(raw.bgImage) || str(raw.bgSrc))

  return {
    id: str(raw.id) || str(raw.name) || str(raw.label) || `band-${i + 1}`,
    name: str(raw.name) || str(raw.label) || str(raw.id) || `Section ${i + 1}`,
    height: num(raw.height, num(raw.h, 900)),
    bg: color,
    bgImage: image,
    keys: {
      name: 'label' in raw && !('name' in raw) ? 'label' : 'name',
      height: 'h' in raw && !('height' in raw) ? 'h' : 'height',
      bg: bgIsImage || ('color' in raw) ? 'color' : ('background' in raw && !('bg' in raw) ? 'background' : 'bg'),
      bgImage: bgIsImage || ('color' in raw) ? 'bg' : ('bgSrc' in raw ? 'bgSrc' : 'bgImage'),
    },
    extra: has ? extra : undefined,
  }
}

/* ---------------------------------------------------------------- project */

export interface ParsedProject { doc: ProjectDoc; bandsKey: string }

export function parseProject(json: unknown): ParsedProject {
  if (!json || typeof json !== 'object') throw new Error('Not a JSON object')

  // shape 2: bare array of objects (engine layout export)
  if (Array.isArray(json)) {
    const objects = (json as Record<string, unknown>[]).map(o => parseObject(o, '')).filter(Boolean) as AnyObj[]
    const bandIds = [...new Set(objects.map(o => o.band).filter(Boolean))]
    if (!bandIds.length) bandIds.push('band-1')
    const bands: Band[] = bandIds.map((id, i) => ({
      id, name: id || `Section ${i + 1}`, height: 900, bg: '#ffffff', bgImage: '',
    }))
    for (const o of objects) if (!o.band) o.band = bands[0].id
    const doc: ProjectDoc = {
      name: 'Imported layout',
      width: 390,
      bands,
      objects,
      io: { shape: 'array', bandsKey: 'bands', objectsKey: 'objects', hadWidth: false },
    }
    return { doc, bandsKey: 'bands' }
  }

  const raw = json as Record<string, unknown>
  const bandsKey = (['bands', 'sections', 'pages'] as const).find(k => Array.isArray(raw[k])) ?? 'bands'
  const objectsKey = (['layout', 'objects'] as const).find(k => Array.isArray(raw[k])) ?? 'layout'

  const rawBands = (raw[bandsKey] as Record<string, unknown>[] | undefined) ?? []
  const bands = rawBands.map(parseBand)
  if (bands.length === 0) bands.push({ id: 'band-1', name: 'Section 1', height: 900, bg: '#ffffff', bgImage: '' })

  const rawObjects = Array.isArray(raw[objectsKey]) ? (raw[objectsKey] as Record<string, unknown>[]) : []
  // parse with NO fallback band, then place band-less objects (v1 embedded
  // presets never carried `band`) by their vertical position — like v1 did.
  const objects = rawObjects.map(o => parseObject(o, '')).filter(Boolean) as AnyObj[]

  const bandIds = new Set(bands.map(b => b.id))
  for (const o of objects) {
    if (!bandIds.has(o.band)) {
      o.band = bandAtY(bands, (o.y ?? 0) + rawHeight(o) / 2)
    }
  }

  const hadWidth = typeof raw.width === 'number'
  const width = hadWidth
    ? num(raw.width, 390)
    : FORMATS[str(raw.format)]?.w ?? 390

  const KNOWN = new Set(['name', 'width', bandsKey, objectsKey])
  const extra: Record<string, unknown> = {}
  let has = false
  for (const k of Object.keys(raw)) if (!KNOWN.has(k)) { extra[k] = raw[k]; has = true }

  return {
    doc: {
      name: str(raw.name, 'Untitled invite'),
      width,
      bands,
      objects,
      io: { shape: 'project', bandsKey, objectsKey, hadWidth },
      extra: has ? extra : undefined,
    },
    bandsKey,
  }
}
