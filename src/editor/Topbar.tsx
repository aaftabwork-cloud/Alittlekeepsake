import React, { useEffect, useRef, useState } from 'react'
import { useDoc } from '../store/doc'
import { useUi } from '../store/ui'
import { usePlayback } from '../store/playback'
import { exportEngineLayout, serializeProject } from '../contract/serialize'
import { exportHtml } from '../contract/htmlExport'
import { parseProject } from '../contract/parse'
import { Peer } from '../lib/usePresence'
import { IconBtn } from './controls'

function download(filename: string, content: string, type = 'application/json') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const AVATAR_HUES = [36, 152, 205, 268, 330]

export function Topbar({ onBack, onSave, saveState, peers, onZoomFit }: {
  onBack: () => void
  onSave: () => void
  saveState: 'saved' | 'saving' | 'dirty' | 'conflict'
  peers: Peer[]
  onZoomFit: () => void
}) {
  const doc = useDoc(s => s.doc)!
  const apply = useDoc(s => s.apply)
  const undo = useDoc(s => s.undo)
  const redo = useDoc(s => s.redo)
  const canUndo = useDoc(s => s.past.length > 0)
  const canRedo = useDoc(s => s.future.length > 0)
  const load = useDoc(s => s.load)
  const projectId = useDoc(s => s.projectId)
  const ui = useUi()
  const play = usePlayback(s => s.play)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menuOpen])

  const zoomPct = Math.round(ui.zoom * 100)

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-ink-700/70 bg-ink-900 px-3">
      {/* brand / back */}
      <button className="group flex items-center gap-2" onClick={onBack} title="Back to projects">
        <svg width="22" height="22" viewBox="0 0 32 32" className="shrink-0">
          <rect width="32" height="32" rx="7" fill="#ffffff" />
          <path d="M16 5.5c2.2 4.4 5.9 8.1 10.5 10.5C21.9 18.4 18.2 22.1 16 26.5 13.8 22.1 10.1 18.4 5.5 16 10.1 13.6 13.8 9.9 16 5.5Z" fill="none" stroke="#2563eb" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="2.1" fill="#3b82f6" />
        </svg>
        <span className="font-display text-[15px] italic tracking-tight text-paper group-hover:text-gold-bright">Invite Studio</span>
      </button>

      <div className="mx-1 h-5 w-px bg-ink-700" />

      {/* project name */}
      <input
        className="h-7 w-52 min-w-0 rounded-md bg-transparent px-2 text-[13px] text-paper outline-none ring-1 ring-inset ring-transparent transition hover:ring-ink-700 focus:bg-ink-950 focus:ring-gold/50"
        value={doc.name}
        onChange={e => apply(d => { d.name = e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); e.stopPropagation() }}
        spellCheck={false}
      />

      {/* save status */}
      <span className="flex items-center gap-1.5 text-2xs text-paper-faint">
        <span className={`h-1.5 w-1.5 rounded-full ${
          saveState === 'saved' ? 'bg-emerald-400'
            : saveState === 'saving' ? 'animate-pulse bg-gold'
            : saveState === 'conflict' ? 'bg-danger'
            : 'bg-paper-faint'
        }`} />
        {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : saveState === 'conflict' ? 'Conflict!' : 'Unsaved'}
      </span>

      <div className="flex-1" />

      {/* presence */}
      {peers.length > 0 && (
        <div className="mr-1 flex items-center">
          {peers.slice(0, 4).map((p, i) => (
            <span
              key={p.key}
              title={`${p.email} is viewing this project`}
              className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-ink-950 ring-2 ring-ink-900 first:ml-0"
              style={{ background: `hsl(${AVATAR_HUES[i % AVATAR_HUES.length]}, 55%, 62%)` }}
            >
              {p.email.slice(0, 1).toUpperCase()}
            </span>
          ))}
          <span className="ml-2 hidden text-2xs text-gold-bright lg:block">also editing</span>
        </div>
      )}

      {/* undo / redo */}
      <IconBtn title="Undo (⌘Z)" onClick={() => undo()}>
        <svg width="14" height="14" viewBox="0 0 14 14" className={canUndo ? '' : 'opacity-30'}><path d="M5.5 3 2.5 6l3 3M3 6h5a3 3 0 0 1 0 6H6" stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </IconBtn>
      <IconBtn title="Redo (⌘⇧Z)" onClick={() => redo()}>
        <svg width="14" height="14" viewBox="0 0 14 14" className={canRedo ? '' : 'opacity-30'}><path d="M8.5 3l3 3-3 3M11 6H6a3 3 0 0 0 0 6h2" stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </IconBtn>

      {/* snap */}
      <IconBtn title={`Snapping ${ui.snapEnabled ? 'on' : 'off'}`} active={ui.snapEnabled} onClick={() => ui.toggleSnap()}>
        <svg width="13" height="13" viewBox="0 0 14 14"><path d="M3 2v5a4 4 0 0 0 8 0V2M3 2h2M9 2h2" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </IconBtn>

      {/* zoom */}
      <div className="flex h-7 items-center rounded-md ring-1 ring-inset ring-ink-700">
        <button className="px-1.5 text-paper-dim hover:text-paper" onClick={() => ui.setZoom(ui.zoom / 1.25)} title="Zoom out (⌘−)">−</button>
        <button className="w-11 text-center text-2xs tabular-nums text-paper-dim hover:text-paper" onClick={onZoomFit} title="Fit (⌘0)">
          {zoomPct}%
        </button>
        <button className="px-1.5 text-paper-dim hover:text-paper" onClick={() => ui.setZoom(ui.zoom * 1.25)} title="Zoom in (⌘+)">+</button>
      </div>

      <div className="mx-1 h-5 w-px bg-ink-700" />

      {/* preview */}
      <button
        className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-2xs font-medium transition ${
          ui.previewMode ? 'bg-gold text-ink-950' : 'text-paper-dim ring-1 ring-inset ring-ink-700 hover:bg-ink-700/60 hover:text-paper'
        }`}
        onClick={() => {
          const next = !ui.previewMode
          ui.setPreview(next)
          if (next) { ui.clearSelection(); play('all') }
        }}
        title="Preview animations"
      >
        <svg width="9" height="9" viewBox="0 0 8 8"><path d="M1.5 1 7 4 1.5 7Z" fill="currentColor" /></svg>
        Preview
      </button>

      {/* import / export */}
      <div className="relative" ref={menuRef}>
        <button
          className="flex h-7 items-center gap-1 rounded-md px-2.5 text-2xs font-medium text-paper-dim ring-1 ring-inset ring-ink-700 hover:bg-ink-700/60 hover:text-paper"
          onClick={() => setMenuOpen(v => !v)}
        >
          File
          <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 2.5 4 5.5 7 2.5" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" /></svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 w-56 overflow-hidden rounded-lg bg-ink-850 py-1 shadow-pop ring-1 ring-ink-700">
            <MenuItem label="Import layout JSON…" hint="replaces canvas" onClick={() => { importRef.current?.click(); setMenuOpen(false) }} />
            <div className="my-1 h-px bg-ink-700/60" />
            <MenuItem label="Export project JSON" hint="full contract" onClick={() => {
              download(`${doc.name.replace(/\s+/g, '-').toLowerCase()}.project.json`, JSON.stringify(serializeProject(doc), null, 2))
              setMenuOpen(false)
            }} />
            <MenuItem label="Export engine layout JSON" hint="flattened, v1-style" onClick={() => {
              download(`${doc.name.replace(/\s+/g, '-').toLowerCase()}-layout.json`, JSON.stringify(exportEngineLayout(doc), null, 2))
              setMenuOpen(false)
            }} />
            <MenuItem label="Export HTML preview" hint="standalone file" onClick={() => {
              download(`${doc.name.replace(/\s+/g, '-').toLowerCase()}.preview.html`, exportHtml(doc), 'text/html')
              setMenuOpen(false)
            }} />
            <MenuItem label="Copy JSON to clipboard" onClick={async () => {
              await navigator.clipboard.writeText(JSON.stringify(serializeProject(doc), null, 2))
              setMenuOpen(false)
            }} />
          </div>
        )}
        <input ref={importRef} type="file" accept=".json,application/json" className="hidden"
          onChange={async e => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              const parsed = parseProject(JSON.parse(await f.text()))
              if (confirm(`Replace the current canvas with "${parsed.doc.name}"? (You can undo by not saving.)`)) {
                load(parsed.doc, parsed.bandsKey, projectId)
              }
            } catch (err) {
              alert(`Could not import: ${err}`)
            }
            e.target.value = ''
          }} />
      </div>

      {/* save */}
      <button
        className="h-7 rounded-md bg-gold px-3.5 text-2xs font-semibold text-ink-950 transition hover:bg-gold-bright"
        onClick={onSave}
      >
        Save
      </button>
    </header>
  )
}

function MenuItem({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-paper hover:bg-ink-700/60" onClick={onClick}>
      {label}
      {hint && <span className="text-2xs text-paper-faint">{hint}</span>}
    </button>
  )
}
