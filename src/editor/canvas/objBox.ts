import { AnyObj } from '../../types'
import { Box, aabb, corners } from '../../lib/geometry'

/** Unrotated box of an object (x/y top-left). Text height comes from the
 * live-measured DOM size when available. */
export function objBox(o: AnyObj, sizes: Record<string, { w: number; h: number }>): Box {
  switch (o.type) {
    case 'line':
      return {
        x: Math.min(o.x1, o.x2),
        y: Math.min(o.y1, o.y2),
        w: Math.max(Math.abs(o.x2 - o.x1), 1),
        h: Math.max(Math.abs(o.y2 - o.y1), 1),
      }
    case 'text': {
      const m = sizes[o.id]
      return { x: o.x, y: o.y, w: m?.w ?? o.w, h: m?.h ?? o.fontSize * o.lineHeight * 1.4 }
    }
    case 'group':
      return { x: o.x, y: o.y, w: o.w * o.scaleX, h: o.h * o.scaleY }
    default:
      return { x: o.x, y: o.y, w: o.w, h: o.h }
  }
}

/** World-space axis-aligned bounds including rotation. */
export function objAabb(o: AnyObj, sizes: Record<string, { w: number; h: number }>): Box {
  const b = objBox(o, sizes)
  const angle = o.type === 'line' ? 0 : o.angle
  if (!angle) return b
  return aabb(corners(b, angle))
}

/** Translate an object (and nested lines/group children) by dx/dy. */
export function translateObj(o: AnyObj, dx: number, dy: number) {
  o.x += dx; o.y += dy
  if (o.type === 'line') { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy }
  if (o.type === 'group') for (const c of o.objects) translateObj(c, dx, dy)
}

/** Combined world bounds for several objects. */
export function combinedAabb(objs: AnyObj[], sizes: Record<string, { w: number; h: number }>): Box | null {
  if (!objs.length) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const o of objs) {
    const b = objAabb(o, sizes)
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
