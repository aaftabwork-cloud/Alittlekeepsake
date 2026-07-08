export interface Pt { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

const RAD = Math.PI / 180

export function rotatePt(p: Pt, c: Pt, deg: number): Pt {
  if (!deg) return { ...p }
  const a = deg * RAD
  const cos = Math.cos(a), sin = Math.sin(a)
  const dx = p.x - c.x, dy = p.y - c.y
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos }
}

/** Corners of a box rotated `deg` about its TOP-LEFT (matches the contract's
 * x/y = top-left + angle convention). Order: tl, tr, br, bl. */
export function corners(b: Box, deg: number): [Pt, Pt, Pt, Pt] {
  const o = { x: b.x, y: b.y }
  return [
    { ...o },
    rotatePt({ x: b.x + b.w, y: b.y }, o, deg),
    rotatePt({ x: b.x + b.w, y: b.y + b.h }, o, deg),
    rotatePt({ x: b.x, y: b.y + b.h }, o, deg),
  ]
}

export function aabb(pts: Pt[]): Box {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function boxContains(outer: Box, inner: Box): boolean {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
}

export function pointInBox(p: Pt, b: Box): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
}

/** Point-in-rotated-box (rotation about box top-left). */
export function pointInRotBox(p: Pt, b: Box, deg: number): boolean {
  const local = rotatePt(p, { x: b.x, y: b.y }, -deg)
  return pointInBox(local, b)
}

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const HANDLES: { id: HandleId; ux: number; uy: number }[] = [
  { id: 'nw', ux: 0, uy: 0 }, { id: 'n', ux: 0.5, uy: 0 }, { id: 'ne', ux: 1, uy: 0 },
  { id: 'e', ux: 1, uy: 0.5 }, { id: 'se', ux: 1, uy: 1 }, { id: 's', ux: 0.5, uy: 1 },
  { id: 'sw', ux: 0, uy: 1 }, { id: 'w', ux: 0, uy: 0.5 },
]

/**
 * Resize a rotated box by dragging handle `h` to world point `mouse`.
 * The handle diagonally/axially opposite stays pinned in world space.
 * Returns the new box (x/y = top-left, same angle).
 */
export function resizeRotated(
  start: Box, deg: number, h: HandleId, mouse: Pt,
  opts: { uniform?: boolean; minSize?: number } = {},
): Box {
  const min = opts.minSize ?? 4
  const def = HANDLES.find(d => d.id === h)!
  const anchorU = { ux: 1 - def.ux, uy: 1 - def.uy }
  const origin = { x: start.x, y: start.y }
  // anchor in world space
  const anchorLocal = { x: start.x + anchorU.ux * start.w, y: start.y + anchorU.uy * start.h }
  const anchorWorld = rotatePt(anchorLocal, origin, deg)
  // mouse in the box's local (unrotated) frame, relative to origin
  const mouseLocal = rotatePt(mouse, origin, -deg)

  let newW = start.w, newH = start.h
  const isCornerOrH = def.ux !== 0.5
  const isCornerOrV = def.uy !== 0.5
  if (isCornerOrH) newW = Math.max(min, (mouseLocal.x - anchorLocal.x) * (def.ux === 1 ? 1 : -1))
  if (isCornerOrV) newH = Math.max(min, (mouseLocal.y - anchorLocal.y) * (def.uy === 1 ? 1 : -1))

  if (opts.uniform && isCornerOrH && isCornerOrV) {
    const s = Math.max(newW / start.w, newH / start.h)
    newW = Math.max(min, start.w * s)
    newH = Math.max(min, start.h * s)
  }

  // Recompute top-left so the anchor stays fixed in world space.
  // In local frame the anchor sits at (anchorU.ux*newW, anchorU.uy*newH) from
  // the new top-left. The new top-left (= new rotation origin) in world space:
  const a = deg * RAD
  const cos = Math.cos(a), sin = Math.sin(a)
  const lx = anchorU.ux * newW, ly = anchorU.uy * newH
  const x = anchorWorld.x - (lx * cos - ly * sin)
  const y = anchorWorld.y - (lx * sin + ly * cos)
  return { x, y, w: newW, h: newH }
}

/** Angle (deg) of the vector center→p, 0 = up, clockwise. */
export function angleFrom(center: Pt, p: Pt): number {
  return (Math.atan2(p.y - center.y, p.x - center.x) / RAD + 90 + 360) % 360
}

export const snapAngle = (deg: number, step = 15) => Math.round(deg / step) * step

/* ------------------------------------------------------------- snapping */

export interface SnapLine { axis: 'v' | 'h'; pos: number; from: number; to: number }
export interface SnapResult { dx: number; dy: number; lines: SnapLine[] }

export interface SnapTargets { v: number[]; h: number[] }

/** Snap a moving bbox against target edge/center positions. */
export function snapBox(box: Box, targets: SnapTargets, threshold: number): SnapResult {
  const candV = [box.x, box.x + box.w / 2, box.x + box.w]
  const candH = [box.y, box.y + box.h / 2, box.y + box.h]
  let dx = 0, dy = 0
  let bestV = threshold + 1, bestH = threshold + 1
  let lineV: number | null = null, lineH: number | null = null

  for (const t of targets.v) {
    for (const c of candV) {
      const d = Math.abs(t - c)
      if (d < bestV) { bestV = d; dx = t - c; lineV = t }
    }
  }
  for (const t of targets.h) {
    for (const c of candH) {
      const d = Math.abs(t - c)
      if (d < bestH) { bestH = d; dy = t - c; lineH = t }
    }
  }

  const lines: SnapLine[] = []
  if (bestV <= threshold && lineV !== null) {
    lines.push({ axis: 'v', pos: lineV, from: Math.min(box.y - 40, box.y + dy), to: Math.max(box.y + box.h + 40, box.y + box.h + dy) })
  } else dx = 0
  if (bestH <= threshold && lineH !== null) {
    lines.push({ axis: 'h', pos: lineH, from: box.x - 40, to: box.x + box.w + 40 })
  } else dy = 0

  return { dx, dy, lines }
}
