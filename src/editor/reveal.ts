import { useDoc } from '../store/doc'
import { useUi } from '../store/ui'
import { bandOffsets } from '../types'
import { objAabb } from './canvas/objBox'

/** Pan the canvas so a section's top is at the top of the viewport. */
export function revealBand(bandId: string) {
  const doc = useDoc.getState().doc
  const ui = useUi.getState()
  if (!doc) return
  const top = bandOffsets(doc.bands).get(bandId) ?? 0
  ui.setPan(ui.panX, -top * ui.zoom + 36)
}

/** Pan the canvas so the object is visible (used when selecting via layers). */
export function revealObject(id: string) {
  const doc = useDoc.getState().doc
  const ui = useUi.getState()
  const el = document.querySelector('.canvas-backdrop')
  if (!doc || !el) return
  const o = doc.objects.find(x => x.id === id)
  if (!o) return
  const rect = el.getBoundingClientRect()
  const bb = objAabb(o, ui.sizes)
  const sx = bb.x * ui.zoom + ui.panX
  const sy = bb.y * ui.zoom + ui.panY
  const sw = bb.w * ui.zoom
  const sh = bb.h * ui.zoom
  const margin = 40
  const visible =
    sx + sw > margin && sx < rect.width - margin &&
    sy + sh > margin && sy < rect.height - margin
  if (visible) return
  // center the object
  ui.setPan(
    rect.width / 2 - (bb.x + bb.w / 2) * ui.zoom,
    rect.height / 2 - (bb.y + bb.h / 2) * ui.zoom,
  )
}
