import React, { useRef } from 'react'
import { useDoc } from '../../store/doc'
import { useUi } from '../../store/ui'
import { AnyObj, GroupObj, LineObj, TextObj } from '../../types'
import {
  HANDLES, HandleId, angleFrom, resizeRotated, rotatePt, snapAngle,
} from '../../lib/geometry'
import { combinedAabb, objBox } from './objBox'

const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
  se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize',
}

export function SelectionOverlay({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const doc = useDoc(s => s.doc)!
  const applyLive = useDoc(s => s.applyLive)
  const beginGesture = useDoc(s => s.beginGesture)
  const endGesture = useDoc(s => s.endGesture)
  const selection = useUi(s => s.selection)
  const editingTextId = useUi(s => s.editingTextId)
  const previewMode = useUi(s => s.previewMode)
  const zoom = useUi(s => s.zoom)
  const panX = useUi(s => s.panX)
  const panY = useUi(s => s.panY)
  const sizes = useUi(s => s.sizes)
  const drag = useRef<{
    kind: 'resize' | 'rotate' | 'endpoint'
    handle?: HandleId
    endpoint?: 1 | 2
    id: string
    start: AnyObj
    startBox: { x: number; y: number; w: number; h: number }
  } | null>(null)

  if (previewMode) return null
  const selected = doc.objects.filter(o => selection.includes(o.id) && !o.hidden)
  if (!selected.length) return null

  const toDoc = (clientX: number, clientY: number) => {
    const r = containerRef.current!.getBoundingClientRect()
    return { x: (clientX - r.left - panX) / zoom, y: (clientY - r.top - panY) / zoom }
  }

  /* ------------------------------------------------------ drag handlers */
  const startDrag = (
    e: React.PointerEvent,
    kind: 'resize' | 'rotate' | 'endpoint',
    o: AnyObj,
    handle?: HandleId,
    endpoint?: 1 | 2,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    beginGesture()
    drag.current = {
      kind, handle, endpoint, id: o.id,
      start: JSON.parse(JSON.stringify(o)),
      startBox: objBox(o, sizes),
    }
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const g = drag.current
      if (!g) return
      const p = toDoc(ev.clientX, ev.clientY)
      const st = g.start

      if (g.kind === 'rotate') {
        const box = g.startBox
        const centerLocal = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
        const centerWorld = rotatePt(centerLocal, { x: box.x, y: box.y }, (st as any).angle ?? 0)
        let ang = angleFrom(centerWorld, p)
        if (ev.shiftKey) ang = snapAngle(ang)
        ang = ((ang % 360) + 360) % 360
        // keep center fixed: origin = center - R(ang)·(w/2, h/2)
        const rad = ang * Math.PI / 180
        const cos = Math.cos(rad), sin = Math.sin(rad)
        const cx = box.w / 2, cy = box.h / 2
        const nx = centerWorld.x - (cx * cos - cy * sin)
        const ny = centerWorld.y - (cx * sin + cy * cos)
        applyLive(d => {
          const o = d.objects.find(ob => ob.id === g.id)
          if (!o || o.type === 'line') return
          o.angle = Math.round(ang * 10) / 10
          o.x = nx; o.y = ny
        })
        return
      }

      if (g.kind === 'endpoint') {
        applyLive(d => {
          const o = d.objects.find(ob => ob.id === g.id)
          if (!o || o.type !== 'line') return
          let tx = p.x, ty = p.y
          const ox = g.endpoint === 1 ? o.x2 : o.x1
          const oy = g.endpoint === 1 ? o.y2 : o.y1
          if (ev.shiftKey) {
            const dx = tx - ox, dy = ty - oy
            const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
            const len = Math.hypot(dx, dy)
            tx = ox + Math.cos(ang) * len
            ty = oy + Math.sin(ang) * len
          }
          if (g.endpoint === 1) { o.x1 = tx; o.y1 = ty } else { o.x2 = tx; o.y2 = ty }
          o.x = Math.min(o.x1, o.x2); o.y = Math.min(o.y1, o.y2)
        })
        return
      }

      // resize
      const st2 = g.startBox
      const angle = (st as any).angle ?? 0
      const isText = st.type === 'text'
      const corner = g.handle!.length === 2
      const uniform = st.type === 'img' || st.type === 'group' || ev.shiftKey || (isText && corner)
      const next = resizeRotated(st2, angle, g.handle!, p, { uniform: uniform && corner, minSize: 8 })
      applyLive(d => {
        const o = d.objects.find(ob => ob.id === g.id)
        if (!o) return
        o.x = next.x; o.y = next.y
        if (o.type === 'text') {
          const t = o as TextObj
          if (corner) {
            const f = next.w / st2.w
            t.w = (st as TextObj).w * f
            t.fontSize = Math.max(4, Math.round((st as TextObj).fontSize * f * 10) / 10)
          } else if (g.handle === 'e' || g.handle === 'w') {
            t.w = Math.max(20, next.w - ((st as TextObj).boxPad ?? 0) * 2)
          }
        } else if (o.type === 'group') {
          const gr = o as GroupObj
          const sgr = st as GroupObj
          gr.scaleX = (next.w / st2.w) * sgr.scaleX
          gr.scaleY = (next.h / st2.h) * sgr.scaleY
        } else if (o.type !== 'line') {
          ;(o as any).w = next.w
          ;(o as any).h = next.h
        }
      })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      drag.current = null
      endGesture()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /* ------------------------------------------------------------ render */
  const hs = 9 // handle px size (screen)

  if (selected.length === 1) {
    const o = selected[0]

    if (o.type === 'line') {
      const l = o as LineObj
      const pts = [
        { n: 1 as const, x: l.x1, y: l.y1 },
        { n: 2 as const, x: l.x2, y: l.y2 },
      ]
      return (
        <>
          {pts.map(pt => (
            <div
              key={pt.n}
              onPointerDown={e => startDrag(e, 'endpoint', o, undefined, pt.n)}
              className="absolute z-20 rounded-full border-2 border-gold bg-ink-950"
              style={{
                width: hs + 3, height: hs + 3,
                left: pt.x * zoom + panX - (hs + 3) / 2,
                top: pt.y * zoom + panY - (hs + 3) / 2,
                cursor: 'move',
              }}
            />
          ))}
        </>
      )
    }

    const box = objBox(o, sizes)
    const angle = o.angle
    const editing = editingTextId === o.id
    const sx = box.x * zoom + panX
    const sy = box.y * zoom + panY
    const sw = box.w * zoom
    const sh = box.h * zoom

    return (
      <div
        className="pointer-events-none absolute z-20"
        style={{
          left: sx, top: sy, width: sw, height: sh,
          transform: angle ? `rotate(${angle}deg)` : undefined,
          transformOrigin: 'top left',
        }}
      >
        <div className={`absolute inset-0 border ${editing ? 'border-gold/50 border-dashed' : 'border-gold'}`} />
        {!editing && !o.locked && (
          <>
            {HANDLES.filter(h => o.type !== 'text' || true).map(h => (
              <div
                key={h.id}
                onPointerDown={e => startDrag(e, 'resize', o, h.id)}
                className="pointer-events-auto absolute rounded-[2px] border border-gold bg-ink-950"
                style={{
                  width: hs, height: hs,
                  left: h.ux * sw - hs / 2,
                  top: h.uy * sh - hs / 2,
                  cursor: HANDLE_CURSORS[h.id],
                }}
              />
            ))}
            {/* rotate handle */}
            <div
              onPointerDown={e => startDrag(e, 'rotate', o)}
              className="pointer-events-auto absolute rounded-full border border-gold bg-ink-950 hover:bg-gold"
              style={{ width: hs + 2, height: hs + 2, left: sw / 2 - (hs + 2) / 2, top: -26, cursor: 'grab' }}
            />
            <div className="absolute left-1/2 h-[15px] w-px -translate-x-1/2 bg-gold/60" style={{ top: -15 }} />
          </>
        )}
        {/* size badge */}
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gold px-1.5 py-0.5 text-2xs font-semibold text-ink-950"
          style={{ top: sh + 8 }}
        >
          {Math.round(box.w)} × {Math.round(box.h)}
          {angle ? ` · ${Math.round(angle)}°` : ''}
        </div>
      </div>
    )
  }

  // multi-selection: combined bounds, move via objects themselves
  const bb = combinedAabb(selected, sizes)
  if (!bb) return null
  return (
    <div
      className="pointer-events-none absolute z-20 border border-gold/80"
      style={{
        left: bb.x * zoom + panX,
        top: bb.y * zoom + panY,
        width: bb.w * zoom,
        height: bb.h * zoom,
      }}
    >
      <div className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gold px-1.5 py-0.5 text-2xs font-semibold text-ink-950" style={{ top: bb.h * zoom + 8 }}>
        {selected.length} objects
      </div>
    </div>
  )
}
