import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDoc } from '../store/doc'
import { storage } from '../lib/storage'
import type { AnyObj, ImgObj } from '../types'

/** Walk all image objects, including group children. */
function walkImgs(objs: AnyObj[], fn: (o: ImgObj) => void) {
  for (const o of objs) {
    if (o.type === 'img') fn(o)
    else if (o.type === 'group') walkImgs(o.objects, fn)
  }
}

const basename = (src: string) => src.split('/').pop()?.split('?')[0]?.toLowerCase() ?? ''

/** Probe an image URL; resolves true when it loads. */
function probe(src: string): Promise<boolean> {
  return new Promise(res => {
    const img = new Image()
    img.onload = () => res(true)
    img.onerror = () => res(false)
    img.src = src
  })
}

/** Banner shown when the open document references images that can't be found.
 *  "Re-link…" lets the operator pick the theme's asset folder (or files);
 *  files are matched to broken srcs by filename, uploaded to the shared
 *  library, and every matching object is rewritten. (E2E finding #1.) */
export function RelinkBanner() {
  const doc = useDoc(s => s.doc)
  const apply = useDoc(s => s.apply)
  const [broken, setBroken] = useState<string[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [result, setResult] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const srcKey = useMemo(() => {
    if (!doc) return ''
    const srcs = new Set<string>()
    walkImgs(doc.objects, o => { if (o.src && !o.src.startsWith('data:')) srcs.add(o.src) })
    return [...srcs].sort().join('\n')
  }, [doc])

  useEffect(() => {
    let alive = true
    const srcs = srcKey ? srcKey.split('\n') : []
    if (!srcs.length) { setBroken([]); return }
    Promise.all(srcs.map(s => probe(s).then(ok => (ok ? null : s)))).then(rs => {
      if (alive) setBroken(rs.filter((s): s is string => !!s))
    })
    return () => { alive = false }
  }, [srcKey])

  if (!doc || dismissed || (!broken.length && !result)) return null

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const byName = new Map<string, File>()
    for (const f of Array.from(files)) {
      if (f.type.startsWith('image/')) byName.set(f.name.toLowerCase(), f)
    }
    let fixed = 0
    for (const src of broken) {
      const f = byName.get(basename(src))
      if (!f) continue
      const rec = await storage.uploadAsset(f)
      apply(d => walkImgs(d.objects, o => {
        if (o.src === src) { o.src = rec.url; if (!o.name) o.name = rec.name }
      }))
      fixed++
    }
    setResult(`Re-linked ${fixed} of ${broken.length} image${broken.length === 1 ? '' : 's'}.`)
    setTimeout(() => setResult(''), 4000)
  }

  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-b border-ink-700/70 bg-ink-850 px-4 text-2xs">
      {broken.length ? (
        <>
          <span className="font-semibold text-danger">⚠ {broken.length} image{broken.length === 1 ? '' : 's'} can’t be found</span>
          <span className="truncate text-paper-faint">{broken.map(basename).join(', ')}</span>
          <button
            className="ml-auto h-6 shrink-0 rounded-md bg-gold px-3 font-semibold text-ink-950 hover:opacity-90"
            onClick={() => inputRef.current?.click()}>
            Re-link from folder…
          </button>
          <button className="shrink-0 text-paper-faint hover:text-paper" title="Dismiss" onClick={() => setDismissed(true)}>✕</button>
        </>
      ) : (
        <span className="text-paper-dim">{result}</span>
      )}
      <input
        ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        // @ts-expect-error non-standard folder-picker attribute
        webkitdirectory=""
        onChange={e => { onFiles(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
