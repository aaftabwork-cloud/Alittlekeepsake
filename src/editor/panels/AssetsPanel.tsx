import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AssetRecord, storage } from '../../lib/storage'
import { useDoc, bandAtY } from '../../store/doc'
import { useUi } from '../../store/ui'
import { AnyObj, DEFAULT_ADJUST, ImgObj, uid } from '../../types'
import { ASSET_DRAG_MIME } from '../placeImageAt'

interface ManifestEntry { name: string; url: string }
type Manifest = Record<string, ManifestEntry[]>

let manifestCache: Manifest | null = null

/** Pull every image url out of a stored project's raw JSON (src / bg / bgImage). */
function harvestImages(json: unknown, out: Map<string, ManifestEntry>, projectName: string) {
  const isImageUrl = (v: string) =>
    v.startsWith('data:image') || /\.(webp|png|jpe?g|gif|svg)(\?|$)/i.test(v) || v.startsWith('http')
  const walk = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (!node || typeof node !== 'object') return
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if ((k === 'src' || k === 'bg' || k === 'bgImage') && typeof v === 'string' && v && isImageUrl(v)) {
        // theme-library files are already listed in their own sections
        if (!v.startsWith('/templates/assets/') && !out.has(v)) {
          const name = v.startsWith('data:')
            ? `image · ${projectName}`
            : decodeURIComponent(v.split('/').pop()?.split('?')[0] ?? 'image')
          out.set(v, { name, url: v })
        }
      } else if (typeof v === 'object') {
        walk(v)
      }
    }
  }
  walk(json)
}

/** Assets tab: what's in this design, the theme's full library, and shared uploads. */
export function AssetsPanel() {
  const doc = useDoc(s => s.doc)!
  const [uploads, setUploads] = useState<AssetRecord[]>([])
  const [manifest, setManifest] = useState<Manifest>(manifestCache ?? {})
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const addObject = useDoc(s => s.addObject)
  const select = useUi(s => s.select)

  const projectId = useDoc(s => s.projectId)
  const [designAssets, setDesignAssets] = useState<ManifestEntry[] | null>(null)

  /** Lazy-harvest images from every OTHER saved design (today's template
   * is tomorrow's asset source). */
  const loadDesignAssets = async () => {
    if (designAssets !== null) return
    setDesignAssets([])
    try {
      const metas = await storage.listProjects()
      const found = new Map<string, ManifestEntry>()
      for (const m of metas) {
        if (m.id === projectId) continue
        const rec = await storage.getProject(m.id)
        if (rec) harvestImages(rec.data, found, m.name)
      }
      setDesignAssets([...found.values()].slice(0, 120))
    } catch { /* leave empty */ }
  }

  const refreshUploads = () => storage.listAssets().then(setUploads).catch(() => {})
  useEffect(() => { refreshUploads() }, [])
  useEffect(() => {
    if (manifestCache) return
    fetch('/templates/assets-manifest.json')
      .then(r => r.json())
      .then((m: Manifest) => { manifestCache = m; setManifest(m) })
      .catch(() => {})
  }, [])

  /* ---------- 1. images actually used in this design ---------- */
  const usedImages = useMemo(() => {
    const seen = new Map<string, ManifestEntry>()
    const push = (url: string) => {
      if (!url || seen.has(url)) return
      const name = url.startsWith('data:')
        ? 'embedded image'
        : decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? 'image')
      seen.set(url, { name, url })
    }
    for (const b of doc.bands) push(b.bgImage)
    const walk = (objs: AnyObj[]) => {
      for (const o of objs) {
        if (o.type === 'img') push(o.src)
        if (o.type === 'group') walk(o.objects)
      }
    }
    walk(doc.objects)
    return [...seen.values()]
  }, [doc])

  /* ---------- 2. theme libraries: this design's first, then all others ---------- */
  const { themeAssets, otherThemes } = useMemo(() => {
    const folders = new Set<string>()
    for (const { url } of usedImages) {
      const m = /^\/templates\/assets\/([^/]+)\//.exec(url)
      if (m) folders.add(m[1])
    }
    const mine: { folder: string; items: ManifestEntry[] }[] = []
    const others: { folder: string; items: ManifestEntry[] }[] = []
    for (const f of Object.keys(manifest).sort()) {
      if (!manifest[f]?.length) continue
      ;(folders.has(f) ? mine : others).push({ folder: f, items: manifest[f] })
    }
    return { themeAssets: mine, otherThemes: others }
  }, [usedImages, manifest])

  const q = query.trim().toLowerCase()
  const match = (e: ManifestEntry) => !q || e.name.toLowerCase().includes(q)

  /* ------------------------------------------------- place on canvas */
  const placeImage = (url: string, name: string) => {
    const img = new Image()
    img.onload = () => {
      const { zoom, panX, panY, vpW, vpH } = useUi.getState()
      const cx = ((vpW || window.innerWidth) / 2 - panX) / zoom
      const cy = ((vpH || window.innerHeight) / 2 - panY) / zoom
      const maxW = doc.width * 0.6
      const w = Math.min(img.naturalWidth, maxW)
      const h = w * (img.naturalHeight / img.naturalWidth)
      const obj: ImgObj = {
        id: uid(), type: 'img', src: url,
        x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h),
        opacity: 1, blend: 'source-over', band: bandAtY(doc.bands, cy), angle: 0,
        flipX: false, flipY: false, name, locked: false, hidden: false,
        custom: true, field: '', motion: 'static', anim: '', dur: 0, motionOpts: {},
        crop: null, shadow: null,
        adjust: { ...DEFAULT_ADJUST },
      }
      addObject(obj)
      select([obj.id])
    }
    img.src = url
  }

  /** Set an image as the background of the selected page (or the page in view). */
  const setAsBackground = (url: string) => {
    const ui = useUi.getState()
    const bandId = ui.selectedBandId
      ?? bandAtY(doc.bands, ((ui.vpH || 600) / 2 - ui.panY) / ui.zoom)
    if (!bandId) return
    useDoc.getState().apply(d => {
      const b = d.bands.find(x => x.id === bandId)
      if (b) b.bgImage = url
    })
    ui.selectBand(bandId)
  }

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const f of Array.from(files)) await storage.uploadAsset(f)
      await refreshUploads()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-2.5 pb-1.5">
        <div className="flex gap-1.5">
          <input
            placeholder="Search assets…"
            className="h-7 w-full min-w-0 rounded-md bg-ink-950 px-2 text-xs text-paper outline-none ring-1 ring-inset ring-ink-700 focus:ring-gold/50"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
          />
          <button
            className="h-7 shrink-0 rounded-md bg-gold px-2.5 text-2xs font-semibold text-ink-950 hover:bg-gold-bright disabled:opacity-50"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? '…' : 'Upload'}
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => upload(e.target.files)} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {/* -------- in this design -------- */}
        <AssetGroup
          title={`In this design · ${usedImages.length}`}
          items={usedImages.filter(match)}
          onPlace={placeImage}
          onBackground={setAsBackground}
          empty="No images placed yet."
        />

        {/* -------- this design's theme libraries -------- */}
        {themeAssets.map(t => (
          <AssetGroup
            key={t.folder}
            title={`${t.folder.replace(/-/g, ' ')} library · ${t.items.length}`}
            items={t.items.filter(match)}
            onPlace={placeImage}
            onBackground={setAsBackground}
          />
        ))}

        {/* -------- shared uploads -------- */}
        <AssetGroup
          title={`Your uploads · ${uploads.length}`}
          items={uploads.filter(a => !q || a.name.toLowerCase().includes(q)).map(a => ({ name: a.name, url: a.url, id: a.id }))}
          onPlace={placeImage}
          onBackground={setAsBackground}
          onDelete={async (id: string) => { await storage.deleteAsset(id); refreshUploads() }}
          empty="Nothing uploaded yet — cutouts and photos you upload here are shared with the whole team, across every template."
        />

        {/* -------- images used in every other saved design -------- */}
        <AssetGroup
          title={`From your designs${designAssets ? ` · ${designAssets.length}` : ''}`}
          items={(designAssets ?? []).filter(match)}
          onPlace={placeImage}
          onBackground={setAsBackground}
          defaultOpen={false}
          onFirstOpen={loadDesignAssets}
          empty={designAssets === null ? 'Expand to scan your other designs…' : 'No reusable images found in your other designs yet.'}
        />

        {/* -------- every other template's assets -------- */}
        {otherThemes.length > 0 && (
          <div className="pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-paper-faint">
            All templates
          </div>
        )}
        {otherThemes.map(t => (
          <AssetGroup
            key={t.folder}
            title={`${t.folder.replace(/-/g, ' ')} · ${t.items.length}`}
            items={t.items.filter(match)}
            onPlace={placeImage}
            onBackground={setAsBackground}
            defaultOpen={!!q}
          />
        ))}
      </div>
    </div>
  )
}

function AssetGroup({ title, items, onPlace, onBackground, onDelete, empty, defaultOpen = true, onFirstOpen }: {
  title: string
  items: (ManifestEntry & { id?: string })[]
  onPlace: (url: string, name: string) => void
  onBackground?: (url: string) => void
  onDelete?: (id: string) => void
  empty?: string
  defaultOpen?: boolean
  onFirstOpen?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="pb-1">
      <button
        className="sticky top-0 z-10 flex w-full items-center gap-1.5 bg-ink-850/95 py-1.5 text-left text-2xs font-semibold uppercase tracking-[0.12em] text-paper-dim backdrop-blur hover:text-paper"
        onClick={() => { if (!open) onFirstOpen?.(); setOpen(v => !v) }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" className={`transition-transform ${open ? '' : '-rotate-90'}`}>
          <path d="M1 2.5 4 5.5 7 2.5" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {title}
      </button>
      {open && (
        items.length === 0 ? (
          empty ? <p className="px-1 pb-2 text-2xs leading-relaxed text-paper-faint">{empty}</p> : null
        ) : (
          <div className="grid grid-cols-2 gap-2 pb-2">
            {items.map(a => (
              <div key={a.url} className="group relative">
                <button
                  className="block w-full overflow-hidden rounded-md bg-ink-950 ring-1 ring-inset ring-ink-700/60 transition hover:ring-gold/60"
                  title={`${a.name} — click to place, or drag onto the canvas`}
                  onClick={() => onPlace(a.url, a.name)}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData(ASSET_DRAG_MIME, JSON.stringify({ url: a.url, name: a.name }))
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                >
                  <div className="checker flex h-20 w-full items-center justify-center">
                    <img src={a.url} className="max-h-full max-w-full object-contain" loading="lazy" alt={a.name} />
                  </div>
                </button>
                <div className="truncate pt-1 text-[9.5px] text-paper-faint">{a.name}</div>
                {onBackground && (
                  <button
                    className="absolute left-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-ink-950/90 text-paper-faint ring-1 ring-inset ring-ink-700 hover:text-gold group-hover:flex"
                    title="Use as page background"
                    onClick={e => { e.stopPropagation(); onBackground(a.url) }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12">
                      <rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" fill="none" />
                      <path d="M1.5 8 4.5 5l2.5 2.5L8.5 6l2 2" stroke="currentColor" fill="none" strokeWidth="1" />
                    </svg>
                  </button>
                )}
                {onDelete && a.id && (
                  <button
                    className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-ink-950/90 text-paper-faint hover:text-danger group-hover:flex"
                    title="Delete upload"
                    onClick={async e => { e.stopPropagation(); if (confirm(`Delete "${a.name}"?`)) onDelete(a.id!) }}
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2.5 3.5h7M5 3V2h2v1M3.5 3.5l.5 6.5h4l.5-6.5" stroke="currentColor" fill="none" strokeLinecap="round" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
