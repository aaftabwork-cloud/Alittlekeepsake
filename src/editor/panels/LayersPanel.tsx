import React, { useEffect, useRef, useState } from 'react'
import { useDoc } from '../../store/doc'
import { useUi } from '../../store/ui'
import { AnyObj, Band, uid } from '../../types'
import { IconBtn } from '../controls'
import { revealBand, revealObject } from '../reveal'

const TYPE_GLYPH: Record<string, React.ReactNode> = {
  text: <path d="M3 4h8M7 4v7" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />,
  img: <><rect x="2.5" y="3" width="9" height="8" rx="1" stroke="currentColor" strokeWidth="1.1" fill="none" /><circle cx="5.4" cy="5.8" r="0.9" fill="currentColor" /><path d="M3.5 10.5 6.5 7.5l2 2 1.5-1.4 1.5 1.6" stroke="currentColor" strokeWidth="1" fill="none" /></>,
  rect: <rect x="2.5" y="3.5" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />,
  ellipse: <ellipse cx="7" cy="7" rx="4.5" ry="3.6" stroke="currentColor" strokeWidth="1.2" fill="none" />,
  line: <path d="M3 11 11 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />,
  group: <><rect x="2.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" fill="none" /><rect x="5.5" y="5.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" fill="none" /></>,
}

function objLabel(o: AnyObj): string {
  if (o.name) return o.name
  if (o.type === 'text') return o.text.slice(0, 26) || 'Text'
  if (o.type === 'img') {
    if (o.src.startsWith('data:')) return 'Image'
    return o.src.split('/').pop()?.split('?')[0]?.slice(0, 26) || 'Image'
  }
  return { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', group: 'Group' }[o.type] ?? o.type
}

function LayerRow({ o, depth }: { o: AnyObj; depth: number }) {
  const selection = useUi(s => s.selection)
  const select = useUi(s => s.select)
  const updateObjs = useDoc(s => s.updateObjs)
  const [renaming, setRenaming] = useState(false)
  const selected = selection.includes(o.id)

  return (
    <div
      draggable={!renaming}
      data-layer-id={o.id}
      onDragStart={e => e.dataTransfer.setData('layer/id', o.id)}
      onClick={e => { select([o.id], e.shiftKey); if (!e.shiftKey) revealObject(o.id) }}
      onDoubleClick={() => setRenaming(true)}
      className={`group flex h-[30px] cursor-default items-center gap-2 rounded-md pr-1 text-xs ${
        selected ? 'bg-gold/15 text-paper ring-1 ring-inset ring-gold/40' : 'text-paper-dim hover:bg-ink-700/60'
      } ${o.hidden ? 'opacity-45' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0 text-paper-faint">{TYPE_GLYPH[o.type]}</svg>
      {renaming ? (
        <input
          autoFocus
          defaultValue={o.name || objLabel(o)}
          className="h-5 w-full rounded bg-ink-950 px-1 text-xs text-paper outline-none ring-1 ring-gold/50"
          onBlur={e => { updateObjs([o.id], ob => { ob.name = e.target.value }); setRenaming(false) }}
          onKeyDown={e => {
            e.stopPropagation()
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setRenaming(false)
          }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{objLabel(o)}</span>
      )}
      {o.field && <span className="rounded bg-gold/20 px-1 py-px text-[9px] font-semibold text-gold-bright">{o.field}</span>}
      <span className="hidden shrink-0 items-center group-hover:flex">
        <IconBtn title={o.locked ? 'Unlock' : 'Lock'} onClick={e => { e.stopPropagation(); updateObjs([o.id], ob => { ob.locked = !ob.locked }) }}>
          <svg width="11" height="11" viewBox="0 0 12 12">
            {o.locked
              ? <><rect x="2.5" y="5" width="7" height="5" rx="1" stroke="currentColor" fill="none" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" fill="none" /></>
              : <><rect x="2.5" y="5" width="7" height="5" rx="1" stroke="currentColor" fill="none" /><path d="M4 5V3.5a2 2 0 0 1 4 0" stroke="currentColor" fill="none" opacity="0.4" /></>}
          </svg>
        </IconBtn>
        <IconBtn title={o.hidden ? 'Show' : 'Hide'} onClick={e => { e.stopPropagation(); updateObjs([o.id], ob => { ob.hidden = !ob.hidden }) }}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1.5 6C2.7 3.8 4.2 2.8 6 2.8S9.3 3.8 10.5 6C9.3 8.2 7.8 9.2 6 9.2S2.7 8.2 1.5 6Z" stroke="currentColor" fill="none" />
            {!o.hidden && <circle cx="6" cy="6" r="1.3" fill="currentColor" />}
            {o.hidden && <path d="M2 10 10 2" stroke="currentColor" strokeLinecap="round" />}
          </svg>
        </IconBtn>
      </span>
      {(o.locked || o.hidden) && (
        <span className="flex shrink-0 items-center gap-0.5 pr-1 text-paper-faint group-hover:hidden">
          {o.locked && <svg width="10" height="10" viewBox="0 0 12 12"><rect x="2.5" y="5" width="7" height="5" rx="1" stroke="currentColor" fill="none" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" fill="none" /></svg>}
        </span>
      )}
    </div>
  )
}

function BandGroup({ band, objs }: { band: Band; objs: AnyObj[] }) {
  const [open, setOpen] = useState(true)
  const apply = useDoc(s => s.apply)
  const doc = useDoc(s => s.doc)!
  const select = useUi(s => s.select)
  const [renaming, setRenaming] = useState(false)

  // layers listed top-of-stack first
  const rows = [...objs].reverse()

  const onDrop = (e: React.DragEvent) => {
    const dragId = e.dataTransfer.getData('layer/id')
    if (!dragId) return
    e.preventDefault()
    const targetEl = (e.target as HTMLElement).closest('[data-layer-id]') as HTMLElement | null
    apply(d => {
      const from = d.objects.findIndex(o => o.id === dragId)
      if (from < 0) return
      const [moved] = d.objects.splice(from, 1)
      moved.band = band.id
      if (targetEl && targetEl.dataset.layerId !== dragId) {
        const to = d.objects.findIndex(o => o.id === targetEl.dataset.layerId)
        // dropping ON a row inserts above it in visual stack = after it in array
        d.objects.splice(to + 1, 0, moved)
      } else {
        d.objects.push(moved)
      }
    })
  }

  return (
    <div onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <div className="group sticky top-0 z-10 flex items-center gap-1 bg-ink-850/95 px-2 py-1.5 backdrop-blur">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-paper-dim hover:text-paper">
          <svg width="8" height="8" viewBox="0 0 8 8" className={`transition-transform ${open ? '' : '-rotate-90'}`}>
            <path d="M1 2.5 4 5.5 7 2.5" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {renaming ? (
            <input
              autoFocus
              defaultValue={band.name}
              className="h-5 w-28 rounded bg-ink-950 px-1 text-xs normal-case tracking-normal text-paper outline-none ring-1 ring-gold/50"
              onClick={e => e.stopPropagation()}
              onBlur={e => { apply(d => { const b = d.bands.find(x => x.id === band.id); if (b) b.name = e.target.value }); setRenaming(false) }}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
          ) : (
            <span
              title="Click to jump to this section · double-click to rename"
              onClick={e => { e.stopPropagation(); revealBand(band.id) }}
              onDoubleClick={() => setRenaming(true)}
            >
              {band.name}
            </span>
          )}
        </button>
        <span className="ml-1 text-[9px] text-paper-faint">{objs.length}</span>
        <span className="ml-auto hidden items-center group-hover:flex">
          <IconBtn title="Select all in section" onClick={() => select(objs.map(o => o.id))}>
            <svg width="11" height="11" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeDasharray="2 1.6" fill="none" /></svg>
          </IconBtn>
        </span>
      </div>
      {open && (
        <div className="space-y-px px-1.5 pb-2">
          {rows.length === 0 && <div className="px-2 py-1 text-2xs italic text-paper-faint">empty</div>}
          {rows.map(o => <LayerRow key={o.id} o={o} depth={0} />)}
        </div>
      )}
    </div>
  )
}

export function LayersPanel() {
  const doc = useDoc(s => s.doc)!
  const apply = useDoc(s => s.apply)
  const selection = useUi(s => s.selection)
  const listRef = useRef<HTMLDivElement>(null)

  // canvas selection → keep the selected row visible in the list
  useEffect(() => {
    if (!selection.length) return
    const row = listRef.current?.querySelector(`[data-layer-id="${selection[0]}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [selection])

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto" ref={listRef}>
        {doc.bands.map(b => (
          <BandGroup key={b.id} band={b} objs={doc.objects.filter(o => o.band === b.id)} />
        ))}
      </div>
      <div className="border-t border-ink-700/60 p-2">
        <button
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-2xs font-medium text-paper-dim ring-1 ring-inset ring-ink-700 hover:bg-ink-700/50 hover:text-paper"
          onClick={() =>
            apply(d => {
              const n = d.bands.length + 1
              d.bands.push({ id: uid('band'), name: `Section ${n}`, height: 1280, bg: '#ffffff', bgImage: '' })
            })
          }
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          Add section
        </button>
      </div>
    </div>
  )
}
