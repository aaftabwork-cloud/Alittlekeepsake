import {
  AnyObj, Band, GroupObj, ProjectDoc, adjustIsDefault,
} from '../types'
import { PRESET_BY_ID } from '../lib/animPresets'

/** Serialize one object to the exact v1 project schema (extras re-emitted).
 * Verified against studio.html serializeObject():
 * - coordinates int-rounded, opacity/angle 2dp
 * - lines carry x1..y2 (+ base minus x/y/angle/flips)
 * - img omits crop/adjust when default; ids only when the source had one
 * - group children re-emitted in their source coordinate space. */
export function serializeObject(o: AnyObj): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ...(o.extra ?? {}),
    ...(o.hadId ? { id: o.id } : {}),
    type: o.type,
    x: round(o.x),
    y: round(o.y),
    opacity: round2(o.opacity),
    blend: o.blend || 'source-over',
    band: o.band,
    angle: round2(o.angle),
    flipX: o.flipX,
    flipY: o.flipY,
    name: o.name,
    locked: o.locked,
    hidden: o.hidden,
    custom: o.custom,
    field: o.field,
    motion: o.motion,
    anim: o.anim,
    dur: o.dur,
    motionOpts: o.motionOpts,
  }
  switch (o.type) {
    case 'text':
      return {
        ...base,
        text: o.text, w: round(o.w),
        fontSize: o.fontSize, fontFamily: o.fontFamily, fill: o.fill,
        textAlign: o.textAlign, fontStyle: o.fontStyle, fontWeight: o.fontWeight,
        charSpacing: o.charSpacing, underline: o.underline, linethrough: o.linethrough,
        lineHeight: o.lineHeight, textCase: o.textCase,
        textBackgroundColor: o.textBackgroundColor,
        boxFill: o.boxFill, boxFillOpacity: o.boxFillOpacity, boxPad: o.boxPad,
        shadow: o.shadow,
      }
    case 'img':
      return {
        ...base,
        src: o.src, w: round(o.w), h: round(o.h),
        ...(o.crop && o.crop.w > 0 ? { crop: o.crop } : {}),
        shadow: o.shadow,
        ...(adjustIsDefault(o.adjust) ? {} : { adjust: o.adjust }),
      }
    case 'rect':
      return {
        ...base,
        w: round(o.w), h: round(o.h), fill: o.fill, gradient: o.gradient,
        shadow: o.shadow, stroke: o.stroke, strokeWidth: o.strokeWidth, rx: o.rx,
      }
    case 'ellipse':
      return {
        ...base,
        w: round(o.w), h: round(o.h), fill: o.fill, gradient: o.gradient,
        shadow: o.shadow, stroke: o.stroke, strokeWidth: o.strokeWidth,
      }
    case 'line': {
      // v1 lines have no x/y/angle/flips
      const { x, y, angle, flipX, flipY, ...rest } = base
      return {
        ...rest,
        x1: round(o.x1), y1: round(o.y1), x2: round(o.x2), y2: round(o.y2),
        stroke: o.stroke, strokeWidth: o.strokeWidth,
      }
    }
    case 'group': {
      const children = o.childMode === 'center-relative'
        ? o.objects.map(c => {
          const clone = JSON.parse(JSON.stringify(c)) as AnyObj
          translate(clone, -(o.x + o.w / 2), -(o.y + o.h / 2))
          return serializeObject(clone)
        })
        : o.objects.map(serializeObject)
      return {
        ...base,
        scaleX: o.scaleX, scaleY: o.scaleY,
        objects: children,
      }
    }
  }
}

function translate(o: AnyObj, dx: number, dy: number) {
  o.x += dx; o.y += dy
  if (o.type === 'line') { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy }
  if (o.type === 'group') for (const c of o.objects) translate(c, dx, dy)
}

function serializeBand(b: Band): Record<string, unknown> {
  const k = b.keys ?? {}
  const out: Record<string, unknown> = {
    ...(b.extra ?? {}),
    id: b.id,
    [k.name ?? 'name']: b.name,
    [k.height ?? 'height']: round(b.height),
  }
  // v1 semantics: bg = image url, color = solid. v2: bg = solid, bgImage = image.
  if (k.bg === 'color') {
    out.bg = b.bgImage
    if (b.bg) out.color = b.bg
  } else {
    out[k.bg ?? 'bg'] = b.bg
    if (b.bgImage) out[k.bgImage ?? 'bgImage'] = b.bgImage
  }
  return out
}

const round = (n: number) => Math.round(n)
const round2 = (n: number) => Math.round(n * 100) / 100

/** Export in the source file's own shape (project object or bare array). */
export function serializeProject(doc: ProjectDoc): Record<string, unknown> | Record<string, unknown>[] {
  if (doc.io.shape === 'array') return exportEngineLayout(doc)
  return {
    ...(doc.extra ?? {}),
    name: doc.name,
    ...(doc.io.hadWidth || !(doc.extra && 'format' in doc.extra) ? { width: doc.width } : {}),
    [doc.io.bandsKey]: doc.bands.map(serializeBand),
    [doc.io.objectsKey]: doc.objects.map(serializeObject),
  }
}

/**
 * The flattened ENGINE schema — byte-compatible with studio.html's
 * exportLayout(): groups flattened to absolute children, editor-only fields
 * dropped, `anim` collapsed to {name, dur, ...motionOpts}, defaults elided.
 */
export function exportEngineLayout(doc: ProjectDoc): Record<string, unknown>[] {
  const flat: AnyObj[] = []
  for (const o of doc.objects) {
    if (o.type === 'group') {
      // children are stored unscaled-absolute; bake the group scale in
      const g = o as GroupObj
      for (const c of g.objects) {
        const clone = JSON.parse(JSON.stringify(c)) as AnyObj
        scaleFrom(clone, g.x, g.y, g.scaleX, g.scaleY)
        clone.band = c.band || g.band
        flat.push(clone)
      }
    } else {
      flat.push(o)
    }
  }

  return flat.map(o => {
    const d = serializeObject(o) as Record<string, unknown>
    delete d.name; delete d.locked; delete d.hidden
    if (d.custom) { d.editable = true; d.field = d.field || '' } else delete d.field
    delete d.custom
    if (o.motion === 'animated' && o.anim) {
      const anim: Record<string, unknown> = {
        name: o.anim,
        dur: o.dur || (o.motionOpts?.dur as number) || PRESET_BY_ID.get(o.anim)?.dur || 6,
        ...o.motionOpts,
      }
      if (!anim.note) delete anim.note
      d.anim = anim
      delete d.motionOpts
    } else {
      delete d.anim
      delete d.motionOpts
    }
    delete d.motion; delete d.dur
    if (!d.angle) delete d.angle
    if (!d.flipX) delete d.flipX
    if (!d.flipY) delete d.flipY
    if (o.type === 'text') {
      if (!d.underline) delete d.underline
      if (!d.linethrough) delete d.linethrough
      if (!d.textBackgroundColor) delete d.textBackgroundColor
      if (!d.shadow) delete d.shadow
      if (!d.boxFill) { delete d.boxFill; delete d.boxFillOpacity; delete d.boxPad }
      if (d.textCase === 'none') delete d.textCase
      if (d.lineHeight === 1.16) delete d.lineHeight
    }
    if ((o.type === 'rect' || o.type === 'ellipse') && !d.gradient) delete d.gradient
    if ((o.type === 'img' || o.type === 'rect' || o.type === 'ellipse') && !d.shadow) delete d.shadow
    delete d.id
    return d
  })
}

function scaleFrom(o: AnyObj, ox: number, oy: number, sx: number, sy: number) {
  const mapX = (v: number) => ox + (v - ox) * sx
  const mapY = (v: number) => oy + (v - oy) * sy
  o.x = mapX(o.x); o.y = mapY(o.y)
  if (o.type === 'line') {
    o.x1 = mapX(o.x1); o.y1 = mapY(o.y1); o.x2 = mapX(o.x2); o.y2 = mapY(o.y2)
    o.strokeWidth *= Math.max(sx, sy)
  } else if (o.type === 'text') {
    o.w *= sx; o.fontSize *= sy
  } else if (o.type !== 'group') {
    ;(o as { w: number }).w *= sx
    ;(o as { h: number }).h *= sy
  } else {
    o.scaleX *= sx; o.scaleY *= sy
    for (const c of o.objects) scaleFrom(c, ox, oy, sx, sy)
  }
}
