import React, { useRef } from 'react'
import { Tool, useUi } from '../store/ui'
import { storage } from '../lib/storage'
import { useDoc, bandAtY } from '../store/doc'
import { DEFAULT_ADJUST, ImgObj, uid } from '../types'

const TOOLS: { id: Tool; key: string; title: string; icon: React.ReactNode }[] = [
  {
    id: 'select', key: 'V', title: 'Select',
    icon: <path d="M4 2.5 12 8l-3.6.9L10 12.6l-1.8.8-1.6-3.8L4 11.5Z" fill="currentColor" strokeLinejoin="round" />,
  },
  {
    id: 'hand', key: 'H', title: 'Hand (pan)',
    icon: <path d="M5 8V3.8a.9.9 0 0 1 1.8 0V7m0-3.9V2.9a.9.9 0 0 1 1.8 0V7m0-3.5a.9.9 0 0 1 1.8 0V7.6m0-2.6a.9.9 0 0 1 1.8 0v4.2c0 2.6-1.7 4.3-4.2 4.3-2 0-3-.8-3.9-2.4L2.6 8.6a1 1 0 0 1 1.6-1.1L5 8.6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    id: 'text', key: 'T', title: 'Text',
    icon: <path d="M3.5 4.5V3h9v1.5M8 3v10m-1.8 0h3.6" stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="round" />,
  },
  {
    id: 'rect', key: 'R', title: 'Rectangle',
    icon: <rect x="3" y="4" width="10" height="8" rx="1" stroke="currentColor" fill="none" strokeWidth="1.3" />,
  },
  {
    id: 'ellipse', key: 'O', title: 'Ellipse',
    icon: <ellipse cx="8" cy="8" rx="5" ry="4" stroke="currentColor" fill="none" strokeWidth="1.3" />,
  },
  {
    id: 'line', key: 'L', title: 'Line',
    icon: <path d="M3.5 12.5 12.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
  },
]

export function ToolRail() {
  const tool = useUi(s => s.tool)
  const setTool = useUi(s => s.setTool)
  const select = useUi(s => s.select)
  const addObject = useDoc(s => s.addObject)
  const doc = useDoc(s => s.doc)!
  const imgRef = useRef<HTMLInputElement>(null)

  const placeUpload = async (file: File) => {
    const asset = await storage.uploadAsset(file)
    const img = new Image()
    img.onload = () => {
      const { zoom, panX, panY } = useUi.getState()
      const cx = (window.innerWidth / 2 - panX) / zoom
      const cy = (window.innerHeight / 2 - panY) / zoom
      const w = Math.min(img.naturalWidth, doc.width * 0.6)
      const h = w * (img.naturalHeight / img.naturalWidth)
      const obj: ImgObj = {
        id: uid(), type: 'img', src: asset.url,
        x: Math.round(cx - w / 2), y: Math.round(cy - h / 2),
        w: Math.round(w), h: Math.round(h),
        opacity: 1, blend: 'source-over', band: bandAtY(doc.bands, cy), angle: 0,
        flipX: false, flipY: false, name: file.name, locked: false, hidden: false,
        custom: true, field: '', motion: 'static', anim: '', dur: 0, motionOpts: {},
        crop: null, shadow: null,
        adjust: { ...DEFAULT_ADJUST },
      }
      addObject(obj)
      select([obj.id])
      setTool('select')
    }
    img.src = asset.url
  }

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-ink-700/70 bg-ink-900 py-2.5">
      {TOOLS.map(t => (
        <button
          key={t.id}
          title={`${t.title} (${t.key})`}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            tool === t.id ? 'bg-gold text-ink-950' : 'text-paper-dim hover:bg-ink-700/70 hover:text-paper'
          }`}
          onClick={() => setTool(t.id)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">{t.icon}</svg>
        </button>
      ))}
      <button
        title="Place image…"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-paper-dim transition-colors hover:bg-ink-700/70 hover:text-paper"
        onClick={() => imgRef.current?.click()}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <rect x="2.5" y="3.5" width="11" height="9" rx="1.2" stroke="currentColor" fill="none" strokeWidth="1.2" />
          <circle cx="6" cy="6.6" r="1" fill="currentColor" />
          <path d="M4 11.5l3.2-3 2.2 2 1.8-1.6 1.8 1.8" stroke="currentColor" fill="none" strokeWidth="1.1" />
        </svg>
      </button>
      <input ref={imgRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) placeUpload(f); e.target.value = '' }} />
    </div>
  )
}
