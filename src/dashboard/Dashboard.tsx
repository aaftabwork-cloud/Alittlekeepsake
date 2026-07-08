import React, { useEffect, useRef, useState } from 'react'
import { ProjectMeta, storage } from '../lib/storage'
import { parseProject } from '../contract/parse'
import { isCloud, supabase } from '../lib/supabase'

// v1-native project shape: bands carry label/bg(image)/color, objects in `layout`
const BLANK_DOC = {
  name: 'Untitled invite',
  format: 'mobile',
  bands: [{ id: 'sec1', label: 'Cover', height: 900, bg: '', color: '#f6f1e7' }],
  layout: [],
}

interface TemplateEntry { slug: string; name: string; file: string; thumb: string }

export function Dashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null)
  const [templates, setTemplates] = useState<TemplateEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const refresh = () => storage.listProjects().then(setProjects).catch(e => { console.error(e); setProjects([]) })
  useEffect(() => { refresh() }, [])
  useEffect(() => { if (isCloud) storage.whoami().then(setEmail) }, [])
  useEffect(() => {
    fetch('/templates/index.json').then(r => r.json()).then(setTemplates).catch(() => {})
  }, [])

  const useTemplate = async (t: TemplateEntry) => {
    setBusy(true)
    try {
      const json = await (await fetch(t.file)).json()
      parseProject(json) // validate before storing
      const id = await storage.createProject(t.name, json)
      onOpen(id)
    } catch (e) {
      alert(`Could not open template: ${e}`)
    } finally { setBusy(false) }
  }

  const createBlank = async () => {
    setBusy(true)
    try {
      const id = await storage.createProject('Untitled invite', BLANK_DOC)
      onOpen(id)
    } finally { setBusy(false) }
  }

  const importJson = async (file: File) => {
    setBusy(true)
    try {
      const json = JSON.parse(await file.text())
      const { doc } = parseProject(json) // validate before storing
      const id = await storage.createProject(doc.name, json as Record<string, unknown>)
      onOpen(id)
    } catch (e) {
      alert(`Could not import: ${e}`)
    } finally { setBusy(false) }
  }


  return (
    <div className="min-h-screen bg-ink-950 text-paper">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 dashboard-glow" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center gap-3 px-6 pb-2 pt-10">
        <svg width="34" height="34" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="7" fill="#ffffff" />
          <path d="M16 5.5c2.2 4.4 5.9 8.1 10.5 10.5C21.9 18.4 18.2 22.1 16 26.5 13.8 22.1 10.1 18.4 5.5 16 10.1 13.6 13.8 9.9 16 5.5Z" fill="none" stroke="#2563eb" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="2.1" fill="#3b82f6" />
        </svg>
        <div>
          <h1 className="font-display text-2xl italic tracking-tight text-paper">Invite Studio</h1>
          <p className="text-2xs tracking-wide text-paper-faint">finish what the machines started</p>
        </div>
        <div className="flex-1" />
        {isCloud && email && (
          <div className="flex items-center gap-2 text-2xs text-paper-faint">
            {email}
            <button className="rounded-md px-2 py-1 ring-1 ring-inset ring-ink-700 hover:text-paper" onClick={() => supabase!.auth.signOut().then(() => location.reload())}>
              Sign out
            </button>
          </div>
        )}
        {!isCloud && (
          <span className="rounded-full bg-ink-800 px-3 py-1 text-2xs text-paper-faint ring-1 ring-inset ring-ink-700" title="Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to enable the team workspace">
            local mode
          </span>
        )}
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-8">
        <div className="mb-8 flex items-center gap-2.5">
          <button
            className="h-9 rounded-lg bg-gold px-4 text-xs font-semibold text-ink-950 transition hover:bg-gold-bright disabled:opacity-50"
            disabled={busy}
            onClick={createBlank}
          >
            + New invite
          </button>
          <button
            className="h-9 rounded-lg px-4 text-xs font-medium text-paper-dim ring-1 ring-inset ring-ink-700 transition hover:bg-ink-800 hover:text-paper disabled:opacity-50"
            disabled={busy}
            onClick={() => importRef.current?.click()}
          >
            Import layout JSON
          </button>
          <input ref={importRef} type="file" accept=".json,application/json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }} />
        </div>

        {/* -------- template gallery (from the v1 studio + pipeline) -------- */}
        {templates.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-2xs font-semibold uppercase tracking-[0.16em] text-paper-faint">
              Templates · start from one of these
            </h2>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {templates.map(t => (
                <button
                  key={t.slug}
                  disabled={busy}
                  className="group/tpl block overflow-hidden rounded-lg bg-ink-850 text-left ring-1 ring-inset ring-ink-700/60 transition hover:-translate-y-0.5 hover:ring-gold/60 disabled:opacity-50"
                  onClick={() => useTemplate(t)}
                  title={`Create a new project from “${t.name}”`}
                >
                  <div className="aspect-[3/4] w-full overflow-hidden bg-ink-800">
                    {t.thumb ? (
                      <img src={t.thumb} className="h-full w-full object-cover object-top transition duration-300 group-hover/tpl:scale-[1.04]" loading="lazy" alt="" />
                    ) : (
                      <div className="card-sheen flex h-full w-full items-center justify-center">
                        <span className="font-display text-2xl italic text-ink-600">{t.name.slice(0, 1)}</span>
                      </div>
                    )}
                  </div>
                  <div className="truncate px-2 py-1.5 text-2xs font-medium text-paper">{t.name}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {projects === null && <p className="text-sm text-paper-faint">Loading projects…</p>}

        {projects?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-700 py-16">
            <p className="font-display text-lg italic text-paper-dim">No projects yet</p>
            <p className="max-w-sm text-center text-xs leading-relaxed text-paper-faint">
              Pick a template above, import a layout JSON from the AI pipeline, or start from a blank canvas.
            </p>
          </div>
        )}

        {projects && projects.length > 0 && (
          <h2 className="mb-3 text-2xs font-semibold uppercase tracking-[0.16em] text-paper-faint">Projects</h2>
        )}
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {projects?.map(p => (
            <div key={p.id} className="group relative">
              <button
                className="block w-full overflow-hidden rounded-xl bg-ink-850 text-left shadow-panel ring-1 ring-inset ring-ink-700/60 transition duration-200 hover:-translate-y-0.5 hover:ring-gold/50"
                onClick={() => onOpen(p.id)}
              >
                <div className="aspect-[4/5] w-full overflow-hidden bg-ink-800">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]" alt="" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center card-sheen">
                      <span className="font-display text-3xl italic text-ink-600">{p.name.slice(0, 1).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  {renaming === p.id ? (
                    <input
                      autoFocus
                      defaultValue={p.name}
                      className="w-full rounded bg-ink-950 px-1 py-0.5 text-xs text-paper outline-none ring-1 ring-gold/50"
                      onClick={e => e.stopPropagation()}
                      onBlur={async e => {
                        await storage.saveProject(p.id, { name: e.target.value })
                        setRenaming(null); refresh()
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    />
                  ) : (
                    <div className="truncate text-xs font-medium text-paper">{p.name}</div>
                  )}
                  <div className="pt-0.5 text-[9.5px] text-paper-faint">
                    {new Date(p.updated_at).toLocaleDateString()} · {p.updated_by}
                  </div>
                </div>
              </button>
              <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                <CardAction title="Rename" onClick={() => setRenaming(p.id)}>
                  <path d="M8.5 2.5l1 1L4 9l-1.5.5L3 8Z" stroke="currentColor" fill="none" strokeLinejoin="round" />
                </CardAction>
                <CardAction title="Duplicate template" onClick={async () => { await storage.duplicateProject(p.id); refresh() }}>
                  <><rect x="1.5" y="1.5" width="6" height="6" rx="1" stroke="currentColor" fill="none" /><path d="M9.5 4v4a1.5 1.5 0 0 1-1.5 1.5H4" stroke="currentColor" fill="none" /></>
                </CardAction>
                <CardAction title="Delete" onClick={async () => {
                  if (confirm(`Delete "${p.name}"? This cannot be undone.`)) { await storage.deleteProject(p.id); refresh() }
                }}>
                  <path d="M2 3h7M4.5 3V2h2v1M3 3l.5 6h4L8 3" stroke="currentColor" fill="none" strokeLinecap="round" />
                </CardAction>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function CardAction({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-950/90 text-paper-dim shadow ring-1 ring-inset ring-ink-700 hover:text-gold-bright"
      onClick={e => { e.stopPropagation(); onClick() }}
    >
      <svg width="11" height="11" viewBox="0 0 11 11">{children}</svg>
    </button>
  )
}
