import React, { useCallback, useEffect, useRef } from 'react'
import { useDoc, bandAtY } from '../../store/doc'
import { useUi } from '../../store/ui'
import {
  AnyObj, EllipseObj, LineObj, RectObj, TextObj, uid, bandOffsets,
} from '../../types'
import { Box, SnapTargets, boxesIntersect, snapBox } from '../../lib/geometry'
import { storage } from '../../lib/storage'
import { ASSET_DRAG_MIME, placeImageAt } from '../placeImageAt'
import { objAabb } from './objBox'
import { ObjectView } from './ObjectView'
import { SelectionOverlay } from './SelectionOverlay'

const SNAP_PX = 6

type Gesture =
  | { kind: 'pan'; startX: number; startY: number; panX: number; panY: number }
  | { kind: 'move'; ids: string[]; startX: number; startY: number; starts: Map<string, AnyObj>; targets: SnapTargets; moved: boolean }
  | { kind: 'marquee'; startX: number; startY: number; additive: boolean }
  | { kind: 'create'; id: string; startX: number; startY: number }
  | null

export function Viewport() {
  const doc = useDoc(s => s.doc)!
  const applyLive = useDoc(s => s.applyLive)
  const beginGesture = useDoc(s => s.beginGesture)
  const endGesture = useDoc(s => s.endGesture)
  const cancelGesture = useDoc(s => s.cancelGesture)
  const duplicateObjects = useDoc(s => s.duplicateObjects)

  const ui = useUi()
  const containerRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture>(null)
  const lastClick = useRef<{ id: string; t: number }>({ id: '', t: 0 })

  const toDoc = useCallback((clientX: number, clientY: number) => {
    const r = containerRef.current!.getBoundingClientRect()
    const { zoom, panX, panY } = useUi.getState()
    return { x: (clientX - r.left - panX) / zoom, y: (clientY - r.top - panY) / zoom }
  }, [])

  /* ------------------------------------------------ snap target harvest */
  const buildTargets = useCallback((excludeIds: string[]): SnapTargets => {
    const { sizes } = useUi.getState()
    const d = useDoc.getState().doc!
    const v: number[] = [0, d.width / 2, d.width]
    const h: number[] = []
    let y = 0
    for (const b of d.bands) {
      h.push(y, y + b.height / 2)
      y += b.height
    }
    h.push(y)
    for (const o of d.objects) {
      if (o.hidden || excludeIds.includes(o.id)) continue
      const bb = objAabb(o, sizes)
      v.push(bb.x, bb.x + bb.w / 2, bb.x + bb.w)
      h.push(bb.y, bb.y + bb.h / 2, bb.y + bb.h)
    }
    return { v, h }
  }, [])

  /* ------------------------------------------------------- pointer down */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || ui.tool === 'hand' || useUi.getState().spaceHeld) {
      const { panX, panY } = useUi.getState()
      gesture.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, panX, panY }
      containerRef.current!.setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return
    const p = toDoc(e.clientX, e.clientY)

    if (ui.tool === 'select') {
      const el = (e.target as HTMLElement).closest?.('[data-obj-id]') as HTMLElement | null
      if (el) {
        const id = el.dataset.objId!
        const obj = doc.objects.find(o => o.id === id)
        if (!obj || obj.locked) return
        let sel = useUi.getState().selection
        if (e.shiftKey) {
          ui.select([id], true)
          return
        }
        // manual double-click detection (pointer capture makes dblclick unreliable)
        const now = performance.now()
        if (lastClick.current.id === id && now - lastClick.current.t < 400) {
          lastClick.current = { id: '', t: 0 }
          if (obj.type === 'text') {
            ui.select([id])
            ui.setEditingText(id)
            return
          }
          if (obj.type === 'img') {
            ui.select([id])
            ui.setCropTarget(id)
            return
          }
        }
        lastClick.current = { id, t: now }
        if (!sel.includes(id)) {
          ui.select([id])
          sel = [id]
        }
        if (useUi.getState().editingTextId === id) return

        let ids = sel
        if (e.altKey) {
          ids = duplicateObjects(sel)
          ui.select(ids)
        }
        beginGesture()
        const starts = new Map<string, AnyObj>()
        for (const o of useDoc.getState().doc!.objects) {
          if (ids.includes(o.id)) starts.set(o.id, JSON.parse(JSON.stringify(o)))
        }
        gesture.current = {
          kind: 'move', ids, startX: p.x, startY: p.y, starts,
          targets: buildTargets(ids), moved: false,
        }
        containerRef.current!.setPointerCapture(e.pointerId)
      } else {
        gesture.current = { kind: 'marquee', startX: p.x, startY: p.y, additive: e.shiftKey }
        containerRef.current!.setPointerCapture(e.pointerId)
      }
      return
    }

    // draw tools
    if (['text', 'rect', 'ellipse', 'line'].includes(ui.tool)) {
      const band = bandAtY(doc.bands, p.y)
      const id = uid()
      const common = {
        id, x: p.x, y: p.y, opacity: 1, blend: 'source-over', band, angle: 0,
        flipX: false, flipY: false, name: '', locked: false, hidden: false,
        custom: true, field: '', motion: 'static' as const, anim: '', dur: 0, motionOpts: {},
      }
      let obj: AnyObj
      if (ui.tool === 'text') {
        obj = {
          ...common, type: 'text', name: 'Text', text: 'Add your text',
          w: 280, fontSize: 32, fontFamily: 'Cormorant Garamond, Georgia, serif', fill: '#2b2b2b',
          textAlign: 'center', fontStyle: 'normal', fontWeight: 'normal',
          charSpacing: 0, underline: false, linethrough: false, lineHeight: 1.16,
          textCase: 'none', textBackgroundColor: '', boxFill: '', boxFillOpacity: 100,
          boxPad: 0, shadow: null,
        } as TextObj
        obj.x = p.x - 140
      } else if (ui.tool === 'rect') {
        obj = {
          ...common, type: 'rect', name: 'Rectangle', w: 1, h: 1, fill: '#d9a94e',
          gradient: null, shadow: null, stroke: '', strokeWidth: 0, rx: 0,
        } as RectObj
      } else if (ui.tool === 'ellipse') {
        obj = {
          ...common, type: 'ellipse', name: 'Ellipse', w: 1, h: 1, fill: '#d9a94e',
          gradient: null, shadow: null, stroke: '', strokeWidth: 0,
        } as EllipseObj
      } else {
        obj = {
          ...common, type: 'line', name: 'Line', x1: p.x, y1: p.y, x2: p.x + 1, y2: p.y,
          stroke: '#c9a84c', strokeWidth: 2,
        } as LineObj
      }
      beginGesture()
      applyLive(d => { d.objects.push(obj) })
      gesture.current = { kind: 'create', id, startX: p.x, startY: p.y }
      containerRef.current!.setPointerCapture(e.pointerId)
      return
    }
  }

  /* ------------------------------------------------------- pointer move */
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pan') {
      ui.setPan(g.panX + e.clientX - g.startX, g.panY + e.clientY - g.startY)
      return
    }
    const p = toDoc(e.clientX, e.clientY)

    if (g.kind === 'move') {
      let dx = p.x - g.startX
      let dy = p.y - g.startY
      if (Math.abs(dx) + Math.abs(dy) > 0.5) g.moved = true
      if (e.shiftKey) {
        Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0)
      }
      // snap using combined bbox of moved set at its would-be position
      const { sizes, zoom, snapEnabled } = useUi.getState()
      if (snapEnabled && !e.metaKey) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const [, st] of g.starts) {
          const bb = objAabb(st, sizes)
          minX = Math.min(minX, bb.x + dx); minY = Math.min(minY, bb.y + dy)
          maxX = Math.max(maxX, bb.x + bb.w + dx); maxY = Math.max(maxY, bb.y + bb.h + dy)
        }
        const res = snapBox({ x: minX, y: minY, w: maxX - minX, h: maxY - minY }, g.targets, SNAP_PX / zoom)
        dx += res.dx; dy += res.dy
        ui.setSnapLines(res.lines)
      } else {
        ui.setSnapLines([])
      }
      applyLive(d => {
        for (const o of d.objects) {
          const st = g.starts.get(o.id)
          if (!st) continue
          o.x = st.x + dx; o.y = st.y + dy
          if (o.type === 'line' && st.type === 'line') {
            o.x1 = st.x1 + dx; o.y1 = st.y1 + dy; o.x2 = st.x2 + dx; o.y2 = st.y2 + dy
          }
          if (o.type === 'group' && st.type === 'group') {
            const setChildren = (cs: AnyObj[], ss: AnyObj[]) => {
              cs.forEach((c, i) => {
                const s = ss[i]
                c.x = s.x + dx; c.y = s.y + dy
                if (c.type === 'line' && s.type === 'line') {
                  c.x1 = s.x1 + dx; c.y1 = s.y1 + dy; c.x2 = s.x2 + dx; c.y2 = s.y2 + dy
                }
                if (c.type === 'group' && s.type === 'group') setChildren(c.objects, s.objects)
              })
            }
            setChildren(o.objects, st.objects)
          }
        }
      })
      return
    }

    if (g.kind === 'marquee') {
      ui.setMarquee({
        x: Math.min(g.startX, p.x), y: Math.min(g.startY, p.y),
        w: Math.abs(p.x - g.startX), h: Math.abs(p.y - g.startY),
      })
      return
    }

    if (g.kind === 'create') {
      applyLive(d => {
        const o = d.objects.find(ob => ob.id === g.id)
        if (!o) return
        if (o.type === 'line') {
          o.x2 = e.shiftKey ? (Math.abs(p.x - g.startX) > Math.abs(p.y - g.startY) ? p.x : g.startX) : p.x
          o.y2 = e.shiftKey ? (Math.abs(p.x - g.startX) > Math.abs(p.y - g.startY) ? g.startY : p.y) : p.y
          o.x = Math.min(o.x1, o.x2); o.y = Math.min(o.y1, o.y2)
        } else if (o.type === 'rect' || o.type === 'ellipse') {
          let w = p.x - g.startX, h = p.y - g.startY
          if (e.shiftKey) { const s = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * s; h = Math.sign(h || 1) * s }
          o.x = w < 0 ? g.startX + w : g.startX
          o.y = h < 0 ? g.startY + h : g.startY
          ;(o as RectObj).w = Math.max(1, Math.abs(w))
          ;(o as RectObj).h = Math.max(1, Math.abs(h))
        } else if (o.type === 'text') {
          const w = Math.abs(p.x - g.startX)
          if (w > 40) { o.x = Math.min(g.startX, p.x); (o as TextObj).w = w }
        }
      })
      return
    }
  }

  /* --------------------------------------------------------- pointer up */
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    ui.setSnapLines([])
    if (!g) return

    if (g.kind === 'move') {
      if (g.moved) {
        // reassign bands from final center-y
        applyLive(d => {
          for (const o of d.objects) {
            if (!g.ids.includes(o.id)) continue
            const bb = objAabb(o, useUi.getState().sizes)
            o.band = bandAtY(d.bands, bb.y + bb.h / 2)
          }
        })
      }
      endGesture()
      return
    }

    if (g.kind === 'marquee') {
      const m = useUi.getState().marquee
      ui.setMarquee(null)
      const p = toDoc(e.clientX, e.clientY)
      const dragged = m && (m.w > 3 || m.h > 3)
      if (!dragged) {
        if (!g.additive) {
          // plain click on a page background → select that section
          if (p.x >= 0 && p.x <= doc.width && p.y >= 0) {
            const bandId = bandAtY(doc.bands, p.y)
            const total = doc.bands.reduce((s, b) => s + b.height, 0)
            if (p.y <= total && bandId) {
              ui.selectBand(bandId)
              return
            }
          }
          ui.clearSelection()
        }
        return
      }
      const { sizes } = useUi.getState()
      const hit = doc.objects
        .filter(o => !o.hidden && !o.locked && boxesIntersect(objAabb(o, sizes), m as Box))
        .map(o => o.id)
      ui.select(hit, g.additive)
      return
    }

    if (g.kind === 'create') {
      const id = g.id
      const d = useDoc.getState().doc!
      const o = d.objects.find(ob => ob.id === id)
      if (o && (o.type === 'rect' || o.type === 'ellipse') && (o.w < 4 || o.h < 4)) {
        applyLive(dd => {
          const oo = dd.objects.find(ob => ob.id === id) as RectObj
          if (oo) { oo.w = 160; oo.h = 120 }
        })
      }
      endGesture()
      ui.select([id])
      ui.setTool('select')
      if (o?.type === 'text') ui.setEditingText(id)
      return
    }

    if (g.kind === 'pan') return
  }

  /* ------------------------------------------ viewport + doc size report */
  useEffect(() => {
    const el = containerRef.current!
    const report = () => useUi.getState().setViewportSize(el.clientWidth, el.clientHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const totalHForClamp = doc.bands.reduce((s, b) => s + b.height, 0)
  useEffect(() => {
    useUi.getState().setDocSize(doc.width, totalHForClamp)
  }, [doc.width, totalHForClamp])

  /* ---------------------------------------------------------------- wheel */
  useEffect(() => {
    const el = containerRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const { zoom, panX, panY } = useUi.getState()
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0022)
        useUi.getState().setZoom(zoom * factor, e.clientX - r.left, e.clientY - r.top)
      } else {
        useUi.getState().setPan(panX - (e.shiftKey ? e.deltaY : e.deltaX), panY - (e.shiftKey ? 0 : e.deltaY))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* ------------------------------------------------------------ escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gesture.current) {
        cancelGesture()
        gesture.current = null
        ui.setSnapLines([])
        ui.setMarquee(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const offsets = bandOffsets(doc.bands)
  const totalH = doc.bands.reduce((s, b) => s + b.height, 0)
  const cursor =
    ui.tool === 'hand' || ui.spaceHeld ? 'grab'
      : ui.tool === 'select' ? 'default' : 'crosshair'

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const p = toDoc(e.clientX, e.clientY)
    const assetData = e.dataTransfer.getData(ASSET_DRAG_MIME)
    if (assetData) {
      try {
        const { url, name } = JSON.parse(assetData)
        placeImageAt(url, name, p)
      } catch { /* malformed drag payload — ignore */ }
      return
    }
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    let i = 0
    for (const f of files) {
      const rec = await storage.uploadAsset(f)
      placeImageAt(rec.url, rec.name, { x: p.x + i * 24, y: p.y + i * 24 })
      i++
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden canvas-backdrop"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* ------- artboard (doc space, scaled) ------- */}
      <div
        style={{
          position: 'absolute',
          left: ui.panX,
          top: ui.panY,
          width: doc.width,
          height: totalH,
          transform: `scale(${ui.zoom})`,
          transformOrigin: 'top left',
        }}
      >
        {/* band backgrounds */}
        <div className="shadow-board" style={{ position: 'absolute', inset: 0 }}>
          {doc.bands.map(b => (
            <div
              key={b.id}
              data-band-id={b.id}
              style={{
                position: 'absolute',
                left: 0,
                top: offsets.get(b.id) ?? 0,
                width: doc.width,
                height: b.height,
                background: b.bg || '#ffffff',
                overflow: 'hidden',
              }}
            >
              {b.bgImage && (
                <img
                  src={b.bgImage}
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  alt=""
                />
              )}
            </div>
          ))}
        </div>

        {/* objects */}
        <div style={{ position: 'absolute', inset: 0 }}>
          {doc.objects.map(o => <ObjectView key={o.id} obj={o} />)}
        </div>
      </div>

      {/* ------- band labels + separators (screen space) ------- */}
      {doc.bands.map(b => {
        const y = (offsets.get(b.id) ?? 0) * ui.zoom + ui.panY
        return (
          <div key={b.id} className="pointer-events-none absolute" style={{ left: ui.panX, top: y - 22 }}>
            <span className="rounded-t-md bg-ink-800/90 px-2.5 py-1 text-2xs font-medium tracking-wide text-paper-dim">
              {b.name}
            </span>
          </div>
        )
      })}

      {/* ------- selected section highlight ------- */}
      {ui.selectedBandId && !ui.previewMode && (() => {
        const top = offsets.get(ui.selectedBandId)
        const band = doc.bands.find(b => b.id === ui.selectedBandId)
        if (top === undefined || !band) return null
        return (
          <div
            className="pointer-events-none absolute border-2 border-gold/80"
            style={{
              left: ui.panX - 1,
              top: top * ui.zoom + ui.panY - 1,
              width: doc.width * ui.zoom + 2,
              height: band.height * ui.zoom + 2,
            }}
          >
            <span className="absolute -top-5 left-0 rounded bg-gold px-1.5 py-0.5 text-2xs font-semibold text-ink-950">
              {band.name}
            </span>
          </div>
        )
      })()}

      {/* ------- snap guides ------- */}
      {ui.snapLines.map((l, i) =>
        l.axis === 'v' ? (
          <div key={i} className="pointer-events-none absolute w-px bg-gold-bright"
            style={{ left: l.pos * ui.zoom + ui.panX, top: 0, bottom: 0 }} />
        ) : (
          <div key={i} className="pointer-events-none absolute h-px bg-gold-bright"
            style={{ top: l.pos * ui.zoom + ui.panY, left: 0, right: 0 }} />
        ),
      )}

      {/* ------- marquee ------- */}
      {ui.marquee && (
        <div
          className="pointer-events-none absolute border border-gold/70 bg-gold/10"
          style={{
            left: ui.marquee.x * ui.zoom + ui.panX,
            top: ui.marquee.y * ui.zoom + ui.panY,
            width: ui.marquee.w * ui.zoom,
            height: ui.marquee.h * ui.zoom,
          }}
        />
      )}

      <SelectionOverlay containerRef={containerRef} />
    </div>
  )
}
