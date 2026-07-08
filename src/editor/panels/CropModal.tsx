import React, { useEffect, useRef, useState } from 'react'
import { useDoc } from '../../store/doc'
import { useUi } from '../../store/ui'
import { Crop, ImgObj } from '../../types'

/** Crop editor: drag/resize a window over the source image.
 * Writes a source-rect crop {x,y,w,h} in natural image pixels. */
export function CropModal() {
  const cropTargetId = useUi(s => s.cropTargetId)
  const setCropTarget = useUi(s => s.setCropTarget)
  const doc = useDoc(s => s.doc)
  const updateObjs = useDoc(s => s.updateObjs)
  const obj = doc?.objects.find(o => o.id === cropTargetId && o.type === 'img') as ImgObj | undefined

  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [rect, setRect] = useState<Crop | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: 'move' | string; sx: number; sy: number; start: Crop } | null>(null)

  useEffect(() => {
    setNat(null)
    setRect(null)
    if (!obj) return
    const img = new Image()
    img.onload = () => {
      const n = { w: img.naturalWidth, h: img.naturalHeight }
      setNat(n)
      setRect(obj.crop && obj.crop.w > 0
        ? { ...obj.crop }
        : { x: 0, y: 0, w: n.w, h: n.h })
    }
    img.src = obj.src
  }, [cropTargetId])

  if (!obj || !nat || !rect) return null

  // fit the image inside the modal viewport
  const maxW = Math.min(window.innerWidth * 0.7, 900)
  const maxH = window.innerHeight * 0.65
  const scale = Math.min(maxW / nat.w, maxH / nat.h, 1)
  const vw = nat.w * scale, vh = nat.h * scale

  const clampRect = (r: Crop): Crop => {
    const w = Math.max(16, Math.min(r.w, nat.w))
    const h = Math.max(16, Math.min(r.h, nat.h))
    return {
      w, h,
      x: Math.max(0, Math.min(r.x, nat.w - w)),
      y: Math.max(0, Math.min(r.y, nat.h - h)),
    }
  }

  const onDown = (e: React.PointerEvent, mode: 'move' | string) => {
    e.preventDefault()
    e.stopPropagation()
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: { ...rect } }
    const onMove = (ev: PointerEvent) => {
      const g = drag.current
      if (!g) return
      const dx = (ev.clientX - g.sx) / scale
      const dy = (ev.clientY - g.sy) / scale
      const s = g.start
      if (g.mode === 'move') {
        setRect(clampRect({ ...s, x: s.x + dx, y: s.y + dy }))
        return
      }
      let { x, y, w, h } = s
      if (g.mode.includes('e')) w = s.w + dx
      if (g.mode.includes('s')) h = s.h + dy
      if (g.mode.includes('w')) { x = s.x + dx; w = s.w - dx }
      if (g.mode.includes('n')) { y = s.y + dy; h = s.h - dy }
      setRect(clampRect({ x, y, w: Math.max(16, w), h: Math.max(16, h) }))
    }
    const onUp = () => {
      drag.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const applyCrop = () => {
    const full = rect.x < 1 && rect.y < 1 && rect.w >= nat.w - 1 && rect.h >= nat.h - 1
    updateObjs([obj.id], o => {
      const m = o as ImgObj
      const prev = m.crop
      m.crop = full ? null : { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) }
      // keep the on-canvas frame's aspect matched to the crop
      const ar = rect.w / rect.h
      const prevAr = prev && prev.w > 0 ? prev.w / prev.h : nat.w / nat.h
      if (Math.abs(ar - prevAr) > 0.001) m.h = m.w / ar
    })
    setCropTarget(null)
  }

  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  const hpos: Record<string, React.CSSProperties> = {
    nw: { left: -5, top: -5 }, n: { left: '50%', top: -5, marginLeft: -5 }, ne: { right: -5, top: -5 },
    e: { right: -5, top: '50%', marginTop: -5 }, se: { right: -5, bottom: -5 },
    s: { left: '50%', bottom: -5, marginLeft: -5 }, sw: { left: -5, bottom: -5 },
    w: { left: -5, top: '50%', marginTop: -5 },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/85 backdrop-blur-sm" onPointerDown={() => setCropTarget(null)}>
      <div className="rounded-xl bg-ink-850 p-4 shadow-pop ring-1 ring-ink-700" onPointerDown={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-sm italic text-paper">Crop image</span>
          <span className="text-2xs tabular-nums text-paper-faint">
            {Math.round(rect.w)} × {Math.round(rect.h)} px
          </span>
        </div>
        <div ref={boxRef} className="checker relative overflow-hidden rounded-md" style={{ width: vw, height: vh }}>
          <img src={obj.src} draggable={false} style={{ width: vw, height: vh, display: 'block' }} alt="" />
          {/* dimmed outside */}
          <div className="pointer-events-none absolute inset-0" style={{
            boxShadow: `0 0 0 9999px rgba(10,9,7,0.65)`,
            position: 'absolute',
            left: rect.x * scale, top: rect.y * scale,
            width: rect.w * scale, height: rect.h * scale,
          }} />
          {/* crop window */}
          <div
            className="absolute cursor-move border border-gold"
            style={{ left: rect.x * scale, top: rect.y * scale, width: rect.w * scale, height: rect.h * scale }}
            onPointerDown={e => onDown(e, 'move')}
          >
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
              {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-gold/30" />)}
            </div>
            {handles.map(h => (
              <div
                key={h}
                className="absolute h-2.5 w-2.5 rounded-sm border border-gold bg-ink-950"
                style={{ ...hpos[h], cursor: `${h}-resize` }}
                onPointerDown={e => onDown(e, h)}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button className="h-8 rounded-md px-3 text-xs text-paper-dim ring-1 ring-inset ring-ink-700 hover:bg-ink-700/60" onClick={() => setCropTarget(null)}>
            Cancel
          </button>
          <button className="h-8 rounded-md px-3 text-xs text-paper-dim ring-1 ring-inset ring-ink-700 hover:bg-ink-700/60"
            onClick={() => setRect({ x: 0, y: 0, w: nat.w, h: nat.h })}>
            Reset
          </button>
          <button className="h-8 rounded-md bg-gold px-4 text-xs font-semibold text-ink-950 hover:bg-gold-bright" onClick={applyCrop}>
            Apply crop
          </button>
        </div>
      </div>
    </div>
  )
}
