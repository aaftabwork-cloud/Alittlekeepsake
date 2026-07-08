import React, { useRef, useState } from 'react'
import { useDoc } from '../../store/doc'
import { useUi } from '../../store/ui'
import { usePlayback } from '../../store/playback'
import {
  AnyObj, DEFAULT_ADJUST, EllipseObj, ImageAdjust, ImgObj, LineObj, RectObj,
  Shadow, TextObj, bandOffsets,
} from '../../types'
import { ANIM_PRESETS, PRESET_BY_ID, PRESET_GROUPS } from '../../lib/animPresets'
import { storage } from '../../lib/storage'
import { ColorInput, IconBtn, NumInput, Row, Section, Segmented, Select, Slider } from '../controls'
import { FontPicker } from './FontPicker'
import { combinedAabb, objAabb, translateObj } from '../canvas/objBox'

/** v1's blend list — canvas composite names, as stored in the contract. */
const BLEND_MODES = [
  { value: 'source-over', label: 'Normal' },
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft light' },
  { value: 'color-dodge', label: 'Color dodge' },
  { value: 'color-burn', label: 'Color burn' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'darken', label: 'Darken' },
  { value: 'luminosity', label: 'Luminosity' },
]
const FIELD_KEYS = ['', 'coupleNames', 'brideName', 'groomName', 'date', 'time', 'venue', 'address', 'message', 'rsvp', 'hosts', 'hashtag']

/** Lazy gesture wrapper so sliders/scrubs produce ONE history entry. */
function useLive(ids: string[]) {
  const began = useRef(false)
  const beginGesture = useDoc(s => s.beginGesture)
  const endGesture = useDoc(s => s.endGesture)
  const updateObjs = useDoc(s => s.updateObjs)
  return {
    change(fn: (o: AnyObj) => void) {
      if (!began.current) { beginGesture(); began.current = true }
      updateObjs(ids, fn, true)
    },
    done() {
      if (began.current) { endGesture(); began.current = false }
    },
  }
}

/* ------------------------------------------------------------ canvas ins. */

function CanvasInspector() {
  const doc = useDoc(s => s.doc)!
  const apply = useDoc(s => s.apply)
  const moveBand = useDoc(s => s.moveBand)
  const duplicateBand = useDoc(s => s.duplicateBand)
  const dragFrom = useRef<number | null>(null)
  const live = useRef(false)
  return (
    <>
      <Section title="Canvas">
        <Row label="Width">
          <NumInput prefix="W" value={doc.width} min={100} onChange={v => apply(d => { d.width = v })} />
        </Row>
      </Section>
      <Section title="Sections">
        {doc.bands.map((b, i) => (
          <div key={b.id} className="space-y-1.5 rounded-md bg-ink-800/50 p-2 ring-1 ring-inset ring-ink-700/50"
            draggable
            onDragStart={e => { dragFrom.current = i; e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              if (dragFrom.current !== null && dragFrom.current !== i) moveBand(doc.bands[dragFrom.current].id, i)
              dragFrom.current = null
            }}>
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 cursor-grab truncate text-xs text-paper" title="Drag to reorder">{b.name}</span>
              <IconBtn title="Move up" onClick={() => moveBand(b.id, i - 1)}>
                <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 6.5 5 3.5 8 6.5" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </IconBtn>
              <IconBtn title="Move down" onClick={() => moveBand(b.id, i + 1)}>
                <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </IconBtn>
              <IconBtn title="Duplicate section and its objects" onClick={() => duplicateBand(b.id)}>
                <svg width="11" height="11" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="currentColor" fill="none" /><rect x="3.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" fill="none" /></svg>
              </IconBtn>
              <IconBtn title="Delete section" danger onClick={() => {
                if (doc.bands.length <= 1) return
                if (!confirm(`Delete "${b.name}" and its objects?`)) return
                apply(d => {
                  d.objects = d.objects.filter(o => o.band !== b.id)
                  d.bands = d.bands.filter(x => x.id !== b.id)
                })
              }}>
                <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2.5 3.5h7M5 3V2h2v1M3.5 3.5l.5 6.5h4l.5-6.5" stroke="currentColor" fill="none" strokeLinecap="round" /></svg>
              </IconBtn>
            </div>
            <Row label="Height">
              <NumInput prefix="H" value={b.height} min={100}
                onChange={v => apply(d => { const x = d.bands.find(y => y.id === b.id); if (x) x.height = v })} />
            </Row>
            <Row label="Fill">
              <ColorInput value={b.bg}
                onChange={v => apply(d => { const x = d.bands.find(y => y.id === b.id); if (x) x.bg = v })} />
            </Row>
            <Row label="Image">
              <BandImageButton bandId={b.id} has={!!b.bgImage} />
            </Row>
          </div>
        ))}
      </Section>
    </>
  )
}

function BandImageButton({ bandId, has }: { bandId: string; has: boolean }) {
  const apply = useDoc(s => s.apply)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-1 gap-1.5">
      <button
        className="h-7 flex-1 rounded-md text-2xs text-paper-dim ring-1 ring-inset ring-ink-700 hover:bg-ink-700/60"
        onClick={() => inputRef.current?.click()}
      >
        {has ? 'Replace…' : 'Choose…'}
      </button>
      {has && (
        <button className="h-7 rounded-md px-2 text-2xs text-paper-faint ring-1 ring-inset ring-ink-700 hover:text-danger"
          onClick={() => apply(d => { const b = d.bands.find(x => x.id === bandId); if (b) b.bgImage = '' })}>
          Clear
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0]
          if (!f) return
          // register in the shared library so every other design can reuse it
          const rec = await storage.uploadAsset(f)
          apply(d => { const b = d.bands.find(x => x.id === bandId); if (b) b.bgImage = rec.url })
        }} />
    </div>
  )
}

/* ---------------------------------------------------- focused section ins. */

function SectionInspector({ bandId }: { bandId: string }) {
  const doc = useDoc(s => s.doc)!
  const apply = useDoc(s => s.apply)
  const selectBand = useUi(s => s.selectBand)
  const { change, done } = useLiveBand(bandId)
  const b = doc.bands.find(x => x.id === bandId)
  if (!b) return null
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex items-center gap-1 border-b border-ink-700/60 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-paper">Section · {b.name}</span>
        <IconBtn title="Delete section and its objects" danger onClick={() => {
          if (doc.bands.length <= 1) return
          if (!confirm(`Delete "${b.name}" and everything on it?`)) return
          apply(d => {
            d.objects = d.objects.filter(o => o.band !== b.id)
            d.bands = d.bands.filter(x => x.id !== b.id)
          })
          selectBand(null)
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 3.5h7M5 3V2h2v1M3.5 3.5l.5 6.5h4l.5-6.5" stroke="currentColor" fill="none" strokeLinecap="round" /></svg>
        </IconBtn>
      </div>
      <Section title="Page background">
        <Row label="Image">
          <BandImageButton bandId={b.id} has={!!b.bgImage} />
        </Row>
        {b.bgImage && (
          <div className="checker overflow-hidden rounded-md ring-1 ring-inset ring-ink-700/60">
            <img src={b.bgImage} className="max-h-40 w-full object-cover" alt="" />
          </div>
        )}
        <Row label="Fill">
          <ColorInput value={b.bg} allowEmpty
            onChange={v => change(x => { x.bg = v })} onCommit={done} />
        </Row>
        <p className="text-2xs leading-snug text-paper-faint">
          Tip: in the Assets tab, hover any image and use the frame icon to set it as this page's background.
        </p>
      </Section>
      <Section title="Layout">
        <Row label="Height">
          <NumInput prefix="H" value={b.height} min={100}
            onChange={v => change(x => { x.height = v })} onCommit={done} />
        </Row>
        <Row label="Name">
          <input
            className="h-7 w-full rounded-md bg-ink-800 px-2 text-xs text-paper outline-none ring-1 ring-inset ring-ink-700/70 focus:ring-gold/60"
            defaultValue={b.name}
            key={b.id}
            onBlur={e => apply(d => { const x = d.bands.find(y => y.id === b.id); if (x) x.name = e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); e.stopPropagation() }}
          />
        </Row>
      </Section>
      <div className="px-3.5 py-3">
        <button
          className="h-7 w-full rounded-md text-2xs text-paper-faint ring-1 ring-inset ring-ink-700 hover:bg-ink-700/40 hover:text-paper"
          onClick={() => selectBand(null)}
        >
          Show all sections
        </button>
      </div>
    </div>
  )
}

/** Gesture-coalesced live edits for one band. */
function useLiveBand(bandId: string) {
  const began = useRef(false)
  const beginGesture = useDoc(s => s.beginGesture)
  const endGesture = useDoc(s => s.endGesture)
  const applyLive = useDoc(s => s.applyLive)
  return {
    change(fn: (b: import('../../types').Band) => void) {
      if (!began.current) { beginGesture(); began.current = true }
      applyLive(d => { const b = d.bands.find(x => x.id === bandId); if (b) fn(b) })
    },
    done() {
      if (began.current) { endGesture(); began.current = false }
    },
  }
}

/* -------------------------------------------------------------- align bar */

const ALIGNS: { id: string; title: string; icon: React.ReactNode }[] = [
  { id: 'left', title: 'Align left', icon: <path d="M2 1.5v9M4.5 3.5h5v2h-5zM4.5 6.5h3v2h-3z" /> },
  { id: 'hcenter', title: 'Align horizontal center', icon: <path d="M6 1.5v9M3.5 3.5h5v2h-5zM4.5 6.5h3v2h-3z" /> },
  { id: 'right', title: 'Align right', icon: <path d="M10 1.5v9M2.5 3.5h5v2h-5zM4.5 6.5h3v2h-3z" /> },
  { id: 'top', title: 'Align top', icon: <path d="M1.5 2h9M3.5 4.5h2v5h-2zM6.5 4.5h2v3h-2z" /> },
  { id: 'vcenter', title: 'Align vertical center', icon: <path d="M1.5 6h9M3.5 3.5h2v5h-2zM6.5 4.5h2v3h-2z" /> },
  { id: 'bottom', title: 'Align bottom', icon: <path d="M1.5 10h9M3.5 2.5h2v5h-2zM6.5 4.5h2v3h-2z" /> },
]

function AlignBar({ objs }: { objs: AnyObj[] }) {
  const doc = useDoc(s => s.doc)!
  const apply = useDoc(s => s.apply)
  const sizes = useUi(s => s.sizes)

  const run = (mode: string) => {
    apply(d => {
      const members = d.objects.filter(o => objs.some(s => s.id === o.id))
      // frame: multi → their combined box; single → its band + artboard width
      let frame
      if (members.length > 1) {
        frame = combinedAabb(members, sizes)!
      } else {
        const offs = bandOffsets(d.bands)
        const b = d.bands.find(x => x.id === members[0].band) ?? d.bands[0]
        frame = { x: 0, y: offs.get(b.id) ?? 0, w: d.width, h: b.height }
      }
      for (const o of members) {
        const bb = objAabb(o, sizes)
        let dx = 0, dy = 0
        if (mode === 'left') dx = frame.x - bb.x
        if (mode === 'hcenter') dx = frame.x + frame.w / 2 - (bb.x + bb.w / 2)
        if (mode === 'right') dx = frame.x + frame.w - (bb.x + bb.w)
        if (mode === 'top') dy = frame.y - bb.y
        if (mode === 'vcenter') dy = frame.y + frame.h / 2 - (bb.y + bb.h / 2)
        if (mode === 'bottom') dy = frame.y + frame.h - (bb.y + bb.h)
        translateObj(o, dx, dy)
      }
    })
  }

  const distribute = (axis: 'h' | 'v') => {
    apply(d => {
      const members = d.objects.filter(o => objs.some(s => s.id === o.id))
      if (members.length < 3) return
      const boxes = members.map(o => ({ o, bb: objAabb(o, sizes) }))
      boxes.sort((a, b) => (axis === 'h' ? a.bb.x - b.bb.x : a.bb.y - b.bb.y))
      const first = boxes[0], last = boxes[boxes.length - 1]
      const span = axis === 'h'
        ? (last.bb.x + last.bb.w) - first.bb.x
        : (last.bb.y + last.bb.h) - first.bb.y
      const total = boxes.reduce((s, b) => s + (axis === 'h' ? b.bb.w : b.bb.h), 0)
      const gap = (span - total) / (boxes.length - 1)
      let cursor = axis === 'h' ? first.bb.x : first.bb.y
      for (const b of boxes) {
        const target = cursor
        const cur = axis === 'h' ? b.bb.x : b.bb.y
        translateObj(b.o, axis === 'h' ? target - cur : 0, axis === 'v' ? target - cur : 0)
        cursor = target + (axis === 'h' ? b.bb.w : b.bb.h) + gap
      }
    })
  }

  return (
    <div className="flex items-center gap-0.5 px-3 py-2">
      {ALIGNS.map(a => (
        <IconBtn key={a.id} title={a.title} onClick={() => run(a.id)}>
          <svg width="12" height="12" viewBox="0 0 12 12" className="fill-current stroke-current" strokeWidth="1" fill="none">{a.icon}</svg>
        </IconBtn>
      ))}
      <div className="mx-0.5 h-4 w-px bg-ink-700" />
      <IconBtn title="Distribute horizontally (3+)" onClick={() => distribute('h')}>
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1.5 1.5v9M10.5 1.5v9M4.5 3.5h3v5h-3z" stroke="currentColor" fill="none" /></svg>
      </IconBtn>
      <IconBtn title="Distribute vertically (3+)" onClick={() => distribute('v')}>
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1.5 1.5h9M1.5 10.5h9M3.5 4.5h5v3h-5z" stroke="currentColor" fill="none" /></svg>
      </IconBtn>
    </div>
  )
}

/* --------------------------------------------------------------- shadow */

function ShadowSection({ objs }: { objs: (TextObj | ImgObj | RectObj | EllipseObj)[] }) {
  const ids = objs.map(o => o.id)
  const { change, done } = useLive(ids)
  const updateObjs = useDoc(s => s.updateObjs)
  const s = objs[0].shadow

  const set = (patch: Partial<Shadow>, live = false) => {
    const fn = (o: AnyObj) => {
      const t = o as TextObj
      t.shadow = { color: 'rgba(0,0,0,0.35)', blur: 12, offsetX: 0, offsetY: 6, ...(t.shadow ?? {}), ...patch }
    }
    live ? change(fn) : updateObjs(ids, fn)
  }

  return (
    <Section title="Shadow" defaultOpen={!!s} actions={
      s ? (
        <span role="button" className="text-2xs text-paper-faint hover:text-danger"
          onClick={e => { e.stopPropagation(); updateObjs(ids, o => { (o as TextObj).shadow = null }) }}>
          remove
        </span>
      ) : (
        <span role="button" className="text-2xs text-gold hover:text-gold-bright"
          onClick={e => { e.stopPropagation(); set({}) }}>
          add
        </span>
      )
    }>
      {s && (
        <>
          <Row label="Color"><ColorInput value={s.color} onChange={v => set({ color: v })} /></Row>
          <Row label="Blur"><Slider value={s.blur} min={0} max={80} onChange={v => set({ blur: v }, true)} onCommit={done} /><NumInput value={s.blur} min={0} onChange={v => set({ blur: v }, true)} onCommit={done} className="max-w-[64px]" /></Row>
          <Row label="Offset">
            <NumInput prefix="X" value={s.offsetX} onChange={v => set({ offsetX: v }, true)} onCommit={done} />
            <NumInput prefix="Y" value={s.offsetY} onChange={v => set({ offsetY: v }, true)} onCommit={done} />
          </Row>
        </>
      )}
    </Section>
  )
}

/* --------------------------------------------------------------- text */

function TextSection({ o }: { o: TextObj }) {
  const { change, done } = useLive([o.id])
  const updateObjs = useDoc(s => s.updateObjs)
  const set = (fn: (t: TextObj) => void) => updateObjs([o.id], ob => fn(ob as TextObj))
  const setLive = (fn: (t: TextObj) => void) => change(ob => fn(ob as TextObj))

  return (
    <>
      <Section title="Typography">
        <Row><FontPicker value={o.fontFamily} onChange={v => set(t => { t.fontFamily = v })} /></Row>
        <Row>
          <NumInput prefix="Size" value={o.fontSize} min={4} onChange={v => setLive(t => { t.fontSize = v })} onCommit={done} />
          <Select value={String(o.fontWeight)} onChange={v => set(t => { t.fontWeight = /^\d+$/.test(v) ? Number(v) : v })}
            options={[{ value: '300', label: 'Light' }, { value: 'normal', label: 'Regular' }, { value: '500', label: 'Medium' }, { value: '600', label: 'SemiBold' }, { value: 'bold', label: 'Bold' }]} />
        </Row>
        <Row>
          <Segmented value={o.textAlign} onChange={v => set(t => { t.textAlign = v as TextObj['textAlign'] })}
            options={[
              { value: 'left', title: 'Left', icon: <AlignGlyph mode="left" /> },
              { value: 'center', title: 'Center', icon: <AlignGlyph mode="center" /> },
              { value: 'right', title: 'Right', icon: <AlignGlyph mode="right" /> },
              { value: 'justify', title: 'Justify', icon: <AlignGlyph mode="justify" /> },
            ]} />
        </Row>
        <Row>
          <button className={styleBtn(o.fontStyle === 'italic')} onClick={() => set(t => { t.fontStyle = t.fontStyle === 'italic' ? 'normal' : 'italic' })}><em className="font-serif">I</em></button>
          <button className={styleBtn(o.underline)} onClick={() => set(t => { t.underline = !t.underline })}><span className="underline">U</span></button>
          <button className={styleBtn(o.linethrough)} onClick={() => set(t => { t.linethrough = !t.linethrough })}><span className="line-through">S</span></button>
          <Select value={o.textCase} onChange={v => set(t => { t.textCase = v as TextObj['textCase'] })}
            options={[{ value: 'none', label: 'As typed' }, { value: 'upper', label: 'UPPER' }, { value: 'lower', label: 'lower' }, { value: 'title', label: 'Title' }]} />
        </Row>
        <Row label="Spacing">
          <NumInput prefix="Ltr" value={o.charSpacing} step={10} onChange={v => setLive(t => { t.charSpacing = v })} onCommit={done} />
          <NumInput prefix="Line" value={o.lineHeight} step={0.05} min={0.5} max={4} onChange={v => setLive(t => { t.lineHeight = v })} onCommit={done} />
        </Row>
        <Row label="Color"><ColorInput value={o.fill} onChange={v => setLive(t => { t.fill = v })} onCommit={done} /></Row>
        <Row label="Highlight"><ColorInput allowEmpty value={o.textBackgroundColor} onChange={v => setLive(t => { t.textBackgroundColor = v })} onCommit={done} /></Row>
      </Section>
      <Section title="Text box" defaultOpen={!!o.boxFill}>
        <Row label="Fill"><ColorInput allowEmpty value={o.boxFill} onChange={v => setLive(t => { t.boxFill = v })} onCommit={done} /></Row>
        <Row label="Opacity"><Slider value={o.boxFillOpacity ?? 100} onChange={v => setLive(t => { t.boxFillOpacity = v })} onCommit={done} /><span className="w-7 text-right text-2xs tabular-nums text-paper-faint">{Math.round(o.boxFillOpacity ?? 100)}</span></Row>
        <Row label="Padding"><NumInput value={o.boxPad} min={0} onChange={v => setLive(t => { t.boxPad = v })} onCommit={done} /></Row>
      </Section>
    </>
  )
}

const styleBtn = (active: boolean) =>
  `flex h-7 w-9 items-center justify-center rounded-md text-xs ring-1 ring-inset transition-colors ${
    active ? 'bg-gold text-ink-950 ring-gold' : 'text-paper-dim ring-ink-700 hover:bg-ink-700/60'
  }`

function AlignGlyph({ mode }: { mode: string }) {
  const lines = {
    left: [[1, 11], [1, 8], [1, 11], [1, 6]],
    center: [[1, 11], [3, 9], [1, 11], [4, 8]],
    right: [[1, 11], [4, 11], [1, 11], [6, 11]],
    justify: [[1, 11], [1, 11], [1, 11], [1, 11]],
  }[mode]!
  return (
    <svg width="12" height="12" viewBox="0 0 12 12">
      {lines.map(([a, b], i) => (
        <line key={i} x1={a} x2={b} y1={2.5 + i * 2.4} y2={2.5 + i * 2.4} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      ))}
    </svg>
  )
}

/* --------------------------------------------------------------- image */

/** v1 ranges: first four are 100-neutral. */
const ADJUST_DEFS: { key: keyof ImageAdjust; label: string; min: number; max: number }[] = [
  { key: 'exposure', label: 'Exposure', min: 0, max: 200 },
  { key: 'contrast', label: 'Contrast', min: 0, max: 200 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200 },
  { key: 'vibrance', label: 'Vibrance', min: 0, max: 200 },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100 },
  { key: 'hue', label: 'Hue', min: -100, max: 100 },
  { key: 'fade', label: 'Fade', min: 0, max: 100 },
  { key: 'glow', label: 'Glow', min: 0, max: 100 },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100 },
  { key: 'blur', label: 'Blur', min: 0, max: 100 },
]

function ImageSection({ o }: { o: ImgObj }) {
  const { change, done } = useLive([o.id])
  const updateObjs = useDoc(s => s.updateObjs)
  const setCropTarget = useUi(s => s.setCropTarget)
  const inputRef = useRef<HTMLInputElement>(null)
  const adj = { ...DEFAULT_ADJUST, ...o.adjust }
  const touched = (Object.keys(DEFAULT_ADJUST) as (keyof ImageAdjust)[]).some(k => adj[k] !== DEFAULT_ADJUST[k])

  return (
    <>
      <Section title="Image">
        <div className="flex gap-1.5">
          <button className="h-7 flex-1 rounded-md text-2xs text-paper-dim ring-1 ring-inset ring-ink-700 hover:bg-ink-700/60"
            onClick={() => inputRef.current?.click()}>
            Replace…
          </button>
          <button className="h-7 flex-1 rounded-md text-2xs text-paper-dim ring-1 ring-inset ring-ink-700 hover:bg-ink-700/60"
            onClick={() => setCropTarget(o.id)}>
            Crop
          </button>
          {o.crop && (
            <button className="h-7 rounded-md px-2 text-2xs text-paper-faint ring-1 ring-inset ring-ink-700 hover:text-danger"
              onClick={() => updateObjs([o.id], ob => { (ob as ImgObj).crop = null })}>
              Uncrop
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={async e => {
            const f = e.target.files?.[0]
            if (!f) return
            // register in the shared library so every other design can reuse it
            const rec = await storage.uploadAsset(f)
            updateObjs([o.id], ob => { (ob as ImgObj).src = rec.url; (ob as ImgObj).crop = null; if (!ob.name) ob.name = rec.name })
          }} />
      </Section>
      <Section title="Adjust" defaultOpen={touched} actions={
        touched ? (
          <span role="button" className="text-2xs text-paper-faint hover:text-gold"
            onClick={e => { e.stopPropagation(); updateObjs([o.id], ob => { (ob as ImgObj).adjust = { ...DEFAULT_ADJUST } }) }}>
            reset
          </span>
        ) : undefined
      }>
        {ADJUST_DEFS.map(d => (
          <Row key={d.key} label={d.label}>
            <Slider value={(adj as any)[d.key] ?? 0} min={d.min} max={d.max}
              onChange={v => change(ob => { (ob as ImgObj).adjust = { ...DEFAULT_ADJUST, ...(ob as ImgObj).adjust, [d.key]: v } })}
              onCommit={done} />
            <span className="w-7 text-right text-2xs tabular-nums text-paper-faint">{Math.round((adj as any)[d.key] ?? 0)}</span>
          </Row>
        ))}
      </Section>
    </>
  )
}

/* --------------------------------------------------------------- shapes */

function ShapeSection({ o }: { o: RectObj | EllipseObj }) {
  const { change, done } = useLive([o.id])
  const updateObjs = useDoc(s => s.updateObjs)
  const set = (fn: (t: RectObj) => void) => updateObjs([o.id], ob => fn(ob as RectObj))
  const setLive = (fn: (t: RectObj) => void) => change(ob => fn(ob as RectObj))
  const g = o.gradient

  return (
    <Section title="Fill & stroke">
      <Row label="Fill"><ColorInput allowEmpty value={o.fill} onChange={v => setLive(t => { t.fill = v })} onCommit={done} /></Row>
      <Row label="Gradient">
        {g ? (
          <>
            <ColorInput value={g.from} onChange={v => setLive(t => { t.gradient!.from = v })} onCommit={done} />
            <ColorInput value={g.to} onChange={v => setLive(t => { t.gradient!.to = v })} onCommit={done} />
          </>
        ) : (
          <button className="h-7 flex-1 rounded-md text-2xs text-paper-dim ring-1 ring-inset ring-ink-700 hover:bg-ink-700/60"
            onClick={() => set(t => { t.gradient = { type: 'linear', from: t.fill || '#f4e0a0', to: '#8a3a4e' } })}>
            Add gradient
          </button>
        )}
      </Row>
      {g && (
        <>
          <Row label="Type">
            <Segmented value={g.type} onChange={v => set(t => { t.gradient!.type = v as 'linear' })}
              options={[{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }]} />
          </Row>
          <Row>
            <button className="h-6 flex-1 rounded-md text-2xs text-paper-faint ring-1 ring-inset ring-ink-700 hover:text-danger"
              onClick={() => set(t => { t.gradient = null })}>
              Remove gradient
            </button>
          </Row>
        </>
      )}
      <Row label="Stroke">
        <ColorInput allowEmpty value={o.stroke} onChange={v => setLive(t => { t.stroke = v })} onCommit={done} />
        <NumInput value={o.strokeWidth} min={0} onChange={v => setLive(t => { t.strokeWidth = v })} onCommit={done} className="max-w-[56px]" />
      </Row>
      {o.type === 'rect' && (
        <Row label="Radius"><Slider value={(o as RectObj).rx} min={0} max={Math.min(o.w, o.h) / 2} onChange={v => setLive(t => { t.rx = v })} onCommit={done} /><NumInput value={(o as RectObj).rx} min={0} onChange={v => setLive(t => { t.rx = v })} onCommit={done} className="max-w-[56px]" /></Row>
      )}
    </Section>
  )
}

function LineSection({ o }: { o: LineObj }) {
  const { change, done } = useLive([o.id])
  return (
    <Section title="Stroke">
      <Row label="Color"><ColorInput value={o.stroke} onChange={v => change(t => { (t as LineObj).stroke = v })} onCommit={done} /></Row>
      <Row label="Width"><Slider value={o.strokeWidth} min={1} max={40} onChange={v => change(t => { (t as LineObj).strokeWidth = v })} onCommit={done} /><NumInput value={o.strokeWidth} min={0.5} step={0.5} onChange={v => change(t => { (t as LineObj).strokeWidth = v })} onCommit={done} className="max-w-[56px]" /></Row>
    </Section>
  )
}

/* ------------------------------------------------------------ animation */

function AnimationSection({ objs }: { objs: AnyObj[] }) {
  const ids = objs.map(o => o.id)
  const updateObjs = useDoc(s => s.updateObjs)
  const play = usePlayback(s => s.play)
  const { change, done } = useLive(ids)
  const o = objs[0]
  const animated = o.motion === 'animated'

  return (
    <Section title="Animation" actions={
      animated && o.anim ? (
        <span
          role="button"
          className="flex items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 text-2xs font-semibold text-gold-bright hover:bg-gold/25"
          onClick={e => { e.stopPropagation(); play(ids) }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 1 7 4 1.5 7Z" fill="currentColor" /></svg>
          Play
        </span>
      ) : undefined
    }>
      <Row>
        <Segmented value={o.motion} onChange={v => updateObjs(ids, ob => {
          ob.motion = v as 'static'
          if (v === 'animated' && !ob.anim) {
            const p = PRESET_BY_ID.get('reveal-soft')!
            ob.anim = p.id
            ob.dur = p.dur
            ob.motionOpts = { trigger: 'enter', dur: p.dur, delay: 0, x: p.x, y: p.y, rotate: p.rotate, scale: p.scale, opacity: p.opacity, loop: p.loop, yoyo: p.yoyo, ease: p.ease }
          }
        })}
          options={[{ value: 'static', label: 'Static' }, { value: 'animated', label: 'Animated' }]} />
      </Row>
      {animated && (
        <>
          {PRESET_GROUPS.map(gr => {
            const presets = ANIM_PRESETS.filter(p => p.group === gr)
            if (!presets.length) return null
            return (
              <div key={gr}>
                <div className="pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-paper-faint">{gr}</div>
                <div className="grid grid-cols-3 gap-1">
                  {presets.map(p => (
                    <button
                      key={p.id}
                      title={p.hint}
                      className={`h-8 rounded-md px-1 text-2xs leading-tight transition-colors ${
                        o.anim === p.id
                          ? 'bg-gold text-ink-950 font-semibold'
                          : 'bg-ink-800 text-paper-dim ring-1 ring-inset ring-ink-700/60 hover:text-paper'
                      }`}
                      onClick={() => {
                        // v1 behaviour: picking a preset copies its defaults into motionOpts
                        updateObjs(ids, ob => {
                          ob.anim = p.id
                          ob.dur = p.dur
                          ob.motionOpts = {
                            ...(p.trigger ? { trigger: p.trigger } : {}),
                            dur: p.dur, delay: 0, x: p.x, y: p.y, rotate: p.rotate,
                            scale: p.scale, opacity: p.opacity, loop: p.loop, yoyo: p.yoyo,
                            ease: p.ease,
                            ...(ob.motionOpts?.note ? { note: ob.motionOpts.note } : {}),
                          }
                        })
                        play(ids)
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <Row label="Timing">
            <NumInput prefix="s" value={o.dur} min={0} step={0.5}
              onChange={v => change(ob => { ob.dur = v; ob.motionOpts = { ...ob.motionOpts, dur: v } })} onCommit={done} />
            <NumInput prefix="delay" value={(o.motionOpts?.delay as number) ?? 0} min={0} step={0.1}
              onChange={v => change(ob => { ob.motionOpts = { ...ob.motionOpts, delay: v } })} onCommit={done} />
          </Row>
          <Row label="Drift">
            <NumInput prefix="X" value={(o.motionOpts?.x as number) ?? PRESET_BY_ID.get(o.anim)?.x ?? 0}
              onChange={v => change(ob => { ob.motionOpts = { ...ob.motionOpts, x: v } })} onCommit={done} />
            <NumInput prefix="Y" value={(o.motionOpts?.y as number) ?? PRESET_BY_ID.get(o.anim)?.y ?? 0}
              onChange={v => change(ob => { ob.motionOpts = { ...ob.motionOpts, y: v } })} onCommit={done} />
          </Row>
          <Row label="Motion">
            <NumInput prefix="∠" value={(o.motionOpts?.rotate as number) ?? PRESET_BY_ID.get(o.anim)?.rotate ?? 0}
              onChange={v => change(ob => { ob.motionOpts = { ...ob.motionOpts, rotate: v } })} onCommit={done} />
            <NumInput prefix="×" value={(o.motionOpts?.scale as number) ?? PRESET_BY_ID.get(o.anim)?.scale ?? 1} step={0.02}
              onChange={v => change(ob => { ob.motionOpts = { ...ob.motionOpts, scale: v } })} onCommit={done} />
          </Row>
          <Row label="Opacity">
            <Slider value={(o.motionOpts?.opacity as number) ?? PRESET_BY_ID.get(o.anim)?.opacity ?? 100} min={0} max={100}
              onChange={v => change(ob => { ob.motionOpts = { ...ob.motionOpts, opacity: v } })} onCommit={done} />
            <span className="w-7 text-right text-2xs tabular-nums text-paper-faint">{Math.round((o.motionOpts?.opacity as number) ?? PRESET_BY_ID.get(o.anim)?.opacity ?? 100)}</span>
          </Row>
          <Row label="Note" wide>
            <textarea
              className="min-h-[64px] w-full resize-y rounded-md bg-ink-800 p-2 text-xs leading-snug text-paper outline-none ring-1 ring-inset ring-ink-700/70 placeholder:text-paper-faint focus:ring-gold/60"
              placeholder="Describe the intent for the animation pipeline — e.g. “petals drift down slowly behind the names, continuous”"
              defaultValue={(o.motionOpts?.note as string) ?? ''}
              key={o.id}
              onBlur={e => updateObjs(ids, ob => { ob.motionOpts = { ...ob.motionOpts, note: e.target.value } })}
              onKeyDown={e => e.stopPropagation()}
            />
          </Row>
        </>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------ transform */

function TransformSection({ o }: { o: AnyObj }) {
  const { change, done } = useLive([o.id])
  const updateObjs = useDoc(s => s.updateObjs)
  const sizes = useUi(s => s.sizes)

  if (o.type === 'line') {
    const l = o as LineObj
    const setL = (k: 'x1' | 'y1' | 'x2' | 'y2', v: number) => change(ob => {
      const t = ob as LineObj
      t[k] = v
      t.x = Math.min(t.x1, t.x2); t.y = Math.min(t.y1, t.y2)
    })
    return (
      <Section title="Position">
        <Row label="Start">
          <NumInput prefix="X" value={l.x1} onChange={v => setL('x1', v)} onCommit={done} />
          <NumInput prefix="Y" value={l.y1} onChange={v => setL('y1', v)} onCommit={done} />
        </Row>
        <Row label="End">
          <NumInput prefix="X" value={l.x2} onChange={v => setL('x2', v)} onCommit={done} />
          <NumInput prefix="Y" value={l.y2} onChange={v => setL('y2', v)} onCommit={done} />
        </Row>
      </Section>
    )
  }

  const hasWH = o.type !== 'group'
  const w = o.type === 'group' ? o.w * o.scaleX : (o as RectObj).w
  const h = o.type === 'text' ? undefined : o.type === 'group' ? o.h * o.scaleY : (o as RectObj).h

  return (
    <Section title="Transform">
      <Row>
        <NumInput prefix="X" value={o.x} onChange={v => change(ob => { translateObj(ob, v - ob.x, 0) })} onCommit={done} />
        <NumInput prefix="Y" value={o.y} onChange={v => change(ob => { translateObj(ob, 0, v - ob.y) })} onCommit={done} />
      </Row>
      <Row>
        {hasWH ? (
          <NumInput prefix="W" value={w} min={1} onChange={v => change(ob => { (ob as RectObj).w = v })} onCommit={done} />
        ) : (
          <NumInput prefix="W" value={Math.round(w)} min={1} onChange={v => change(ob => {
            const g = ob as any
            g.scaleX = v / g.w
          })} onCommit={done} />
        )}
        {h !== undefined ? (
          hasWH ? (
            <NumInput prefix="H" value={h} min={1} onChange={v => change(ob => { (ob as RectObj).h = v })} onCommit={done} />
          ) : (
            <NumInput prefix="H" value={Math.round(h)} min={1} onChange={v => change(ob => {
              const g = ob as any
              g.scaleY = v / g.h
            })} onCommit={done} />
          )
        ) : (
          <NumInput prefix="H" value={Math.round(sizes[o.id]?.h ?? 0)} onChange={() => {}} className="pointer-events-none opacity-40" />
        )}
      </Row>
      <Row>
        <NumInput prefix="∠" value={o.angle} step={1} onChange={v => change(ob => { ob.angle = ((v % 360) + 360) % 360 })} onCommit={done} />
        <button className={styleBtn(o.flipX)} title="Flip horizontal" onClick={() => updateObjs([o.id], ob => { ob.flipX = !ob.flipX })}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M4 3 1.5 6 4 9M8 3l2.5 3L8 9" stroke="currentColor" fill="none" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className={styleBtn(o.flipY)} title="Flip vertical" onClick={() => updateObjs([o.id], ob => { ob.flipY = !ob.flipY })}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 6h10M3 4 6 1.5 9 4M3 8l3 2.5L9 8" stroke="currentColor" fill="none" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </Row>
    </Section>
  )
}

/* ------------------------------------------------------------ appearance */

function AppearanceSection({ objs }: { objs: AnyObj[] }) {
  const ids = objs.map(o => o.id)
  const { change, done } = useLive(ids)
  const updateObjs = useDoc(s => s.updateObjs)
  const o = objs[0]
  return (
    <Section title="Appearance">
      <Row label="Opacity">
        <Slider value={o.opacity * 100} onChange={v => change(ob => { ob.opacity = v / 100 })} onCommit={done} />
        <span className="w-7 text-right text-2xs tabular-nums text-paper-faint">{Math.round(o.opacity * 100)}</span>
      </Row>
      <Row label="Blend">
        <Select value={o.blend || 'normal'} onChange={v => updateObjs(ids, ob => { ob.blend = v })} options={BLEND_MODES} />
      </Row>
    </Section>
  )
}

/* ------------------------------------------------------------ field tag */

function FieldSection({ objs }: { objs: AnyObj[] }) {
  const ids = objs.map(o => o.id)
  const updateObjs = useDoc(s => s.updateObjs)
  const o = objs[0]
  const isPreset = FIELD_KEYS.includes(o.field)
  return (
    <Section title="Editable field" defaultOpen={!!o.field}>
      <Row label="Key">
        <Select value={isPreset ? o.field : '__custom'} onChange={v => updateObjs(ids, ob => { ob.field = v === '__custom' ? 'custom' : v })}
          options={[...FIELD_KEYS.map(k => ({ value: k, label: k || '— none —' })), { value: '__custom', label: 'custom…' }]} />
      </Row>
      {(!isPreset || (o.field && !FIELD_KEYS.includes(o.field))) && (
        <Row label="Custom">
          <input
            className="h-7 w-full rounded-md bg-ink-800 px-2 text-xs text-paper outline-none ring-1 ring-inset ring-ink-700/70 focus:ring-gold/60"
            defaultValue={o.field}
            key={o.id + o.field}
            onBlur={e => updateObjs(ids, ob => { ob.field = e.target.value.trim() })}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); e.stopPropagation() }}
          />
        </Row>
      )}
      <p className="text-2xs leading-snug text-paper-faint">
        Marks this object as end-user editable (names, date, venue…) in the published invite.
      </p>
    </Section>
  )
}

/* ---------------------------------------------------------------- shell */

export function Inspector() {
  const doc = useDoc(s => s.doc)!
  const selection = useUi(s => s.selection)
  const removeObjects = useDoc(s => s.removeObjects)
  const duplicateObjects = useDoc(s => s.duplicateObjects)
  const reorder = useDoc(s => s.reorder)
  const groupObjects = useDoc(s => s.groupObjects)
  const ungroup = useDoc(s => s.ungroup)
  const select = useUi(s => s.select)

  const selectedBandId = useUi(s => s.selectedBandId)
  const objs = doc.objects.filter(o => selection.includes(o.id))

  if (!objs.length) {
    if (selectedBandId) return <SectionInspector bandId={selectedBandId} />
    return <div className="min-h-0 flex-1 overflow-y-auto"><CanvasInspector /></div>
  }

  const o = objs[0]
  const single = objs.length === 1

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="flex items-center gap-1 border-b border-ink-700/60 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-paper">
          {single ? (o.name || { text: 'Text', img: 'Image', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', group: 'Group' }[o.type]) : `${objs.length} selected`}
        </span>
        {single && o.type === 'group' && (
          <IconBtn title="Ungroup (⌘⇧G)" onClick={() => select(ungroup(o.id))}>
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" fill="none" /><rect x="5.5" y="5.5" width="5" height="5" rx="1" stroke="currentColor" fill="none" strokeDasharray="1.6 1.2" /></svg>
          </IconBtn>
        )}
        {objs.length > 1 && (
          <IconBtn title="Group (⌘G)" onClick={() => { const gid = groupObjects(selection); if (gid) select([gid]) }}>
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" fill="none" /><rect x="5.5" y="5.5" width="5" height="5" rx="1" stroke="currentColor" fill="none" /></svg>
          </IconBtn>
        )}
        <IconBtn title="Send backward ([)" onClick={() => reorder(selection, 'backward')}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 2v8M3 7l3 3 3-3" stroke="currentColor" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </IconBtn>
        <IconBtn title="Bring forward (])" onClick={() => reorder(selection, 'forward')}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 10V2M3 5l3-3 3 3" stroke="currentColor" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </IconBtn>
        <IconBtn title="Duplicate (⌘D)" onClick={() => select(duplicateObjects(selection))}>
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="7" height="7" rx="1.5" stroke="currentColor" fill="none" /><path d="M10.5 4v5a1.5 1.5 0 0 1-1.5 1.5H4" stroke="currentColor" fill="none" /></svg>
        </IconBtn>
        <IconBtn title="Delete (⌫)" danger onClick={() => { removeObjects(selection); select([]) }}>
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 3.5h7M5 3V2h2v1M3.5 3.5l.5 6.5h4l.5-6.5" stroke="currentColor" fill="none" strokeLinecap="round" /></svg>
        </IconBtn>
      </div>

      <AlignBar objs={objs} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {single && <TransformSection o={o} />}
        <AppearanceSection objs={objs} />
        {single && o.type === 'text' && <TextSection o={o as TextObj} />}
        {single && o.type === 'img' && <ImageSection o={o as ImgObj} />}
        {single && (o.type === 'rect' || o.type === 'ellipse') && <ShapeSection o={o as RectObj} />}
        {single && o.type === 'line' && <LineSection o={o as LineObj} />}
        {objs.every(x => x.type === 'text' || x.type === 'img' || x.type === 'rect' || x.type === 'ellipse') && (
          <ShadowSection objs={objs as (TextObj | ImgObj | RectObj | EllipseObj)[]} />
        )}
        <FieldSection objs={objs} />
        <AnimationSection objs={objs} />
      </div>
    </div>
  )
}
