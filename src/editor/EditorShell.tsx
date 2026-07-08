import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDoc } from '../store/doc'
import { useUi } from '../store/ui'
import { parseProject } from '../contract/parse'
import { serializeProject } from '../contract/serialize'
import { storage } from '../lib/storage'
import { renderThumbnail } from '../lib/thumbnail'
import { usePresence } from '../lib/usePresence'
import { docHeight } from '../types'
import { Topbar } from './Topbar'
import { RelinkBanner } from './RelinkBanner'
import { ToolRail } from './ToolRail'
import { Viewport } from './canvas/Viewport'
import { LayersPanel } from './panels/LayersPanel'
import { AssetsPanel } from './panels/AssetsPanel'
import { FieldsPanel } from './panels/FieldsPanel'
import { Inspector } from './panels/Inspector'
import { CropModal } from './panels/CropModal'
import { useShortcuts } from './useShortcuts'

type SaveState = 'saved' | 'saving' | 'dirty' | 'conflict'

export function EditorShell({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const doc = useDoc(s => s.doc)
  const dirty = useDoc(s => s.dirty)
  const load = useDoc(s => s.load)
  const close = useDoc(s => s.close)
  const markSaved = useDoc(s => s.markSaved)
  const ui = useUi()
  const [loadError, setLoadError] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const loadedAt = useRef<string>('')
  const peers = usePresence(projectId)
  const bodyRef = useRef<HTMLDivElement>(null)

  /* ---------------------------------------------------------- load */
  useEffect(() => {
    let alive = true
    storage.getProject(projectId).then(rec => {
      if (!alive) return
      if (!rec) { setLoadError('Project not found.'); return }
      try {
        const { doc: d, bandsKey } = parseProject(rec.data)
        d.name = rec.name || d.name
        loadedAt.current = rec.updated_at
        load(d, bandsKey, projectId)
      } catch (e) {
        setLoadError(`Could not parse layout: ${e}`)
      }
    }).catch(e => setLoadError(String(e)))
    return () => { alive = false; close() }
  }, [projectId])

  useEffect(() => { setSaveState(dirty ? 'dirty' : 'saved') }, [dirty])

  /* ---------------------------------------------------------- save */
  const save = useCallback(async (opts: { force?: boolean } = {}) => {
    const d = useDoc.getState().doc
    if (!d) return
    setSaveState('saving')
    try {
      const data = serializeProject(d)
      const thumbnail = await renderThumbnail(d)
      const res = await storage.saveProject(
        projectId,
        { name: d.name, data, thumbnail },
        opts.force ? undefined : loadedAt.current,
      )
      if (!res.ok && res.conflict) {
        setSaveState('conflict')
        const other = res.conflict.updated_by || 'someone'
        if (confirm(`${other} saved this project after you opened it (${new Date(res.conflict.updated_at).toLocaleTimeString()}).\n\nOverwrite their version with yours?`)) {
          await save({ force: true })
        }
        return
      }
      if (res.updated_at) loadedAt.current = res.updated_at
      markSaved()
      setSaveState('saved')
    } catch (e) {
      setSaveState('dirty')
      alert(`Save failed: ${e}`)
    }
  }, [projectId])

  /* -------------------------------------------------------- autosave */
  useEffect(() => {
    const t = setInterval(() => {
      if (useDoc.getState().dirty) save()
    }, 30000)
    return () => clearInterval(t)
  }, [save])

  /* ------------------------------------------------------- zoom fit */
  const zoomFit = useCallback(() => {
    const d = useDoc.getState().doc
    const el = bodyRef.current?.querySelector('.canvas-backdrop')
    if (!d || !el) return
    const rect = el.getBoundingClientRect()
    const firstBand = d.bands[0]?.height ?? 1280
    const z = Math.min((rect.width - 96) / d.width, (rect.height - 88) / firstBand, 1.25)
    useUi.getState().setZoom(z)
    useUi.getState().setPan((rect.width - d.width * z) / 2, 44)
  }, [])

  useEffect(() => {
    if (doc) setTimeout(zoomFit, 0)
  }, [!!doc])

  useShortcuts(save, zoomFit)

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-ink-950 text-paper">
        <p className="text-sm text-paper-dim">{loadError}</p>
        <button className="h-8 rounded-md bg-gold px-4 text-xs font-semibold text-ink-950" onClick={onBack}>Back to projects</button>
      </div>
    )
  }
  if (!doc) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-950">
        <span className="font-display text-lg italic text-paper-dim">Opening…</span>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-ink-900 text-paper">
      <Topbar onBack={onBack} onSave={() => save()} saveState={saveState} peers={peers} onZoomFit={zoomFit} />
      {!ui.previewMode && <RelinkBanner />}
      <div className="flex min-h-0 flex-1" ref={bodyRef}>
        <ToolRail />

        {/* left panel */}
        {!ui.previewMode && (
          <aside className="flex w-60 shrink-0 flex-col border-r border-ink-700/70 bg-ink-850">
            <div className="flex shrink-0 gap-1 p-2">
              {(['layers', 'assets', 'fields'] as const).map(t => (
                <button
                  key={t}
                  className={`h-7 flex-1 rounded-md text-2xs font-semibold uppercase tracking-[0.12em] transition ${
                    ui.leftTab === t ? 'bg-ink-700 text-paper' : 'text-paper-faint hover:text-paper-dim'
                  }`}
                  onClick={() => ui.setLeftTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {ui.leftTab === 'layers' ? <LayersPanel /> : ui.leftTab === 'assets' ? <AssetsPanel /> : <FieldsPanel />}
            </div>
          </aside>
        )}

        <Viewport />

        {/* right panel */}
        {!ui.previewMode && (
          <aside className="flex w-[272px] shrink-0 flex-col border-l border-ink-700/70 bg-ink-850">
            <Inspector />
          </aside>
        )}
      </div>
      <CropModal />
    </div>
  )
}
