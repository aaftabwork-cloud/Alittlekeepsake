/**
 * The layout data contract. Field names here are consumed verbatim by the
 * downstream pipeline (Claude Code reads the exported JSON to build the final
 * animated invite) — never rename them. Unknown keys encountered on import are
 * preserved in `extra` and re-emitted on export so round-trips stay lossless.
 */

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light'
  | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'

export interface Shadow {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

/** v1 gradient: two colors, linear = top-left→bottom-right diagonal. */
export interface Gradient {
  type: 'linear' | 'radial'
  from: string
  to: string
  [k: string]: unknown
}

/** v1 adjust block: exposure/contrast/saturation/vibrance are 100-neutral,
 * the rest are 0-neutral. Omitted from exports entirely when all-default. */
export interface ImageAdjust {
  exposure: number
  contrast: number
  saturation: number
  vibrance: number
  warmth: number
  hue: number
  fade: number
  glow: number
  sharpness: number
  blur: number
}

export const DEFAULT_ADJUST: ImageAdjust = {
  exposure: 100, contrast: 100, saturation: 100, vibrance: 100,
  warmth: 0, hue: 0, fade: 0, glow: 0, sharpness: 0, blur: 0,
}

export const adjustIsDefault = (a: Partial<ImageAdjust> | null | undefined): boolean =>
  !a || (Object.keys(DEFAULT_ADJUST) as (keyof ImageAdjust)[]).every(
    k => (a[k] ?? DEFAULT_ADJUST[k]) === DEFAULT_ADJUST[k])

/** Source-rect crop in natural image pixels; nw/nh = natural size. */
export interface Crop { x: number; y: number; w: number; h: number; nw?: number; nh?: number }

/** v1 motion option vocabulary (per-object overrides of the preset),
 * plus our additive free-text `note` describing intent for the pipeline. */
export interface MotionOpts {
  trigger?: string
  dur?: number
  delay?: number
  x?: number
  y?: number
  rotate?: number
  scale?: number
  opacity?: number
  loop?: boolean
  yoyo?: boolean
  ease?: string
  note?: string
  [k: string]: unknown
}

export interface BaseObj {
  /** internal editor id — only exported when the imported file had one */
  id: string
  /** true when the source file carried an id (v1 files don't) */
  hadId?: boolean
  type: 'text' | 'img' | 'rect' | 'ellipse' | 'line' | 'group'
  x: number
  y: number
  opacity: number
  blend: BlendMode | string
  /** id of the page/section this object belongs to */
  band: string
  angle: number
  flipX: boolean
  flipY: boolean
  name: string
  locked: boolean
  hidden: boolean
  /** true if added by an operator (vs seeded by the AI layout) */
  custom: boolean
  /** editable-field key exposed to end users later (e.g. coupleNames), '' if none */
  field: string
  motion: 'static' | 'animated'
  /** animation preset id, '' if none */
  anim: string
  /** duration in seconds */
  dur: number
  motionOpts: MotionOpts
  /** unknown keys from imported JSON, preserved for lossless export */
  extra?: Record<string, unknown>
}

export interface TextObj extends BaseObj {
  type: 'text'
  text: string
  w: number
  fontSize: number
  fontFamily: string
  fill: string
  textAlign: 'left' | 'center' | 'right' | 'justify'
  fontStyle: 'normal' | 'italic'
  fontWeight: number | string
  charSpacing: number
  underline: boolean
  linethrough: boolean
  lineHeight: number
  textCase: 'none' | 'upper' | 'lower' | 'title'
  textBackgroundColor: string
  boxFill: string
  boxFillOpacity: number
  boxPad: number
  shadow: Shadow | null
}

export interface ImgObj extends BaseObj {
  type: 'img'
  src: string
  w: number
  h: number
  crop: Crop | null
  shadow: Shadow | null
  adjust: ImageAdjust
}

export interface RectObj extends BaseObj {
  type: 'rect'
  w: number
  h: number
  fill: string
  gradient: Gradient | null
  shadow: Shadow | null
  stroke: string
  strokeWidth: number
  rx: number
}

export interface EllipseObj extends BaseObj {
  type: 'ellipse'
  w: number
  h: number
  fill: string
  gradient: Gradient | null
  shadow: Shadow | null
  stroke: string
  strokeWidth: number
}

export interface LineObj extends BaseObj {
  type: 'line'
  x1: number; y1: number; x2: number; y2: number
  stroke: string
  strokeWidth: number
}

export interface GroupObj extends BaseObj {
  type: 'group'
  /** unscaled extent of the children */
  w: number
  h: number
  scaleX: number
  scaleY: number
  /** children held in ABSOLUTE artboard coords internally; `childMode`
   * records the source serialization space so exports round-trip
   * (v1 project files store children center-relative, Fabric-style) */
  childMode: 'center-relative' | 'absolute'
  objects: AnyObj[]
}

export type AnyObj = TextObj | ImgObj | RectObj | EllipseObj | LineObj | GroupObj

/** A page/section of the invite. Stacked vertically; each has its own background. */
export interface Band {
  id: string
  name: string
  height: number
  /** solid color background */
  bg: string
  /** optional background image (covers the band) */
  bgImage: string
  /** original key names/semantics from the imported file, echoed on export.
   * v1 sections are { id, label, height, bg:<image url>, color:<solid> }. */
  keys?: { name?: string; bg?: string; height?: string; bgImage?: string }
  extra?: Record<string, unknown>
}

/** v1 artboard formats — width comes from `format` when there is no width key. */
export const FORMATS: Record<string, { w: number; secH: number }> = {
  mobile: { w: 390, secH: 900 },
  tablet: { w: 768, secH: 1024 },
  desktop: { w: 1920, secH: 1080 },
  storybook: { w: 941, secH: 1520 },
}

export interface ProjectDoc {
  name: string
  width: number
  bands: Band[]
  objects: AnyObj[]
  /** serialization facts about the source file, so exports mirror it */
  io: {
    /** 'project' = {name, bands, layout/objects, …}; 'array' = bare object list */
    shape: 'project' | 'array'
    bandsKey: string
    objectsKey: string
    hadWidth: boolean
  }
  extra?: Record<string, unknown>
}

/* ---------------------------------------------------------------- helpers */

let counter = 0
export function uid(prefix = 'o'): string {
  counter = (counter + 1) % 1679616
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`
}

/** Band id at absolute artboard y. */
export function bandAtY(bands: Band[], y: number): string {
  let acc = 0
  for (const b of bands) {
    acc += b.height
    if (y < acc) return b.id
  }
  return bands[bands.length - 1]?.id ?? ''
}

export function bandOffsets(bands: Band[]): Map<string, number> {
  const m = new Map<string, number>()
  let y = 0
  for (const b of bands) {
    m.set(b.id, y)
    y += b.height
  }
  return m
}

export function docHeight(doc: ProjectDoc): number {
  return doc.bands.reduce((s, b) => s + b.height, 0)
}

export interface ObjBounds { x: number; y: number; w: number; h: number }

/** Axis-aligned unrotated bounds of an object (lines/text use derived size). */
export function objSize(o: AnyObj, textH?: number): { w: number; h: number } {
  switch (o.type) {
    case 'line': {
      return { w: Math.max(Math.abs(o.x2 - o.x1), 1), h: Math.max(Math.abs(o.y2 - o.y1), 1) }
    }
    case 'text':
      return { w: o.w, h: textH ?? o.fontSize * o.lineHeight * 1.2 }
    default:
      return { w: (o as ImgObj).w, h: (o as ImgObj).h }
  }
}
