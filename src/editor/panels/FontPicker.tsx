import React, { useEffect, useRef, useState } from 'react'
import { FONT_GROUPS, buildStack, ensureFont } from '../../lib/fonts'
import { familyName } from '../../lib/filters'

/** `value` is a CSS font stack (contract stores stacks like
 * "Cormorant Garamond, Georgia, serif"); picking a font swaps the family
 * and keeps a sensible fallback tail. */
export function FontPicker({ value, onChange }: { value: string; onChange: (stack: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const q = query.trim().toLowerCase()

  return (
    <div className="relative flex-1" ref={ref}>
      <button
        className="flex h-7 w-full items-center justify-between rounded-md bg-ink-800 px-2 text-xs text-paper ring-1 ring-inset ring-ink-700/70 hover:ring-gold/40"
        onClick={() => setOpen(v => !v)}
      >
        <span className="truncate" style={{ fontFamily: value }}>{familyName(value) || 'Font'}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" className="ml-1 shrink-0 text-paper-faint">
          <path d="M1 2.5 4 5.5 7 2.5" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 flex max-h-[420px] w-[248px] flex-col overflow-hidden rounded-lg bg-ink-850 shadow-pop ring-1 ring-ink-700">
          <div className="p-2">
            <input
              autoFocus
              placeholder="Search fonts…"
              className="h-7 w-full rounded-md bg-ink-950 px-2 text-xs text-paper outline-none ring-1 ring-inset ring-ink-700 focus:ring-gold/50"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            {FONT_GROUPS.map(g => {
              const fonts = g.fonts.filter(f => !q || f.family.toLowerCase().includes(q))
              if (!fonts.length) return null
              return (
                <div key={g.label}>
                  <div className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-paper-faint">{g.label}</div>
                  {fonts.map(f => {
                    ensureFont(f.family)
                    return (
                      <button
                        key={f.family}
                        className={`flex h-9 w-full items-center px-3 text-left hover:bg-ink-700/60 ${f.family === familyName(value) ? 'bg-gold/10 text-gold-bright' : 'text-paper'}`}
                        onClick={() => { onChange(buildStack(f.family, value)); setOpen(false) }}
                      >
                        <span className="truncate text-[17px] leading-none" style={{ fontFamily: `'${f.family}'` }}>
                          {f.family}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
