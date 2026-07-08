import React, { useEffect, useRef, useState } from 'react'

/* Compact control kit for the inspector panels. */

export function Section({ title, children, actions, defaultOpen = true }: {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-ink-700/60">
      <button
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-paper-dim">{title}</span>
        <span className="flex items-center gap-1.5">
          {actions}
          <svg width="8" height="8" viewBox="0 0 8 8" className={`text-paper-faint transition-transform ${open ? '' : '-rotate-90'}`}>
            <path d="M1 2.5 4 5.5 7 2.5" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && <div className="space-y-2 px-3.5 pb-3.5">{children}</div>}
    </div>
  )
}

export function Row({ label, children, wide }: { label?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${wide ? 'flex-col items-stretch' : ''}`}>
      {label !== undefined && <span className="w-[52px] shrink-0 text-2xs text-paper-faint">{label}</span>}
      <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${wide ? 'w-full' : ''}`}>{children}</div>
    </div>
  )
}

/** Numeric input with label-scrub (drag the prefix to change value). */
export function NumInput({ value, onChange, onCommit, prefix, min, max, step = 1, className = '' }: {
  value: number
  onChange: (v: number) => void
  onCommit?: () => void
  prefix?: string
  min?: number
  max?: number
  step?: number
  className?: string
}) {
  const [text, setText] = useState<string | null>(null)
  const scrub = useRef<{ x: number; v: number } | null>(null)

  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
  const shown = text ?? (Math.round(value * 100) / 100).toString()

  return (
    <div className={`flex h-7 min-w-0 flex-1 items-center overflow-hidden rounded-md bg-ink-800 ring-1 ring-inset ring-ink-700/70 focus-within:ring-gold/60 ${className}`}>
      {prefix && (
        <span
          className="shrink-0 cursor-ew-resize select-none pl-2 pr-1 text-2xs text-paper-faint"
          onPointerDown={e => {
            scrub.current = { x: e.clientX, v: value }
            const el = e.currentTarget
            el.setPointerCapture(e.pointerId)
            const onMove = (ev: PointerEvent) => {
              if (!scrub.current) return
              onChange(clamp(scrub.current.v + Math.round((ev.clientX - scrub.current.x) / 2) * step))
            }
            const onUp = () => {
              scrub.current = null
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
              onCommit?.()
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
          }}
        >
          {prefix}
        </span>
      )}
      <input
        className="h-full w-full min-w-0 bg-transparent px-1.5 text-xs tabular-nums text-paper outline-none"
        value={shown}
        onChange={e => {
          setText(e.target.value)
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(clamp(v))
        }}
        onBlur={() => { setText(null); onCommit?.() }}
        onKeyDown={e => {
          if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1) * step
            setText(null)
            onChange(clamp(value + d))
          }
          e.stopPropagation()
        }}
      />
    </div>
  )
}

export function Slider({ value, onChange, onCommit, min = 0, max = 100, step = 1 }: {
  value: number
  onChange: (v: number) => void
  onCommit?: () => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <input
      type="range"
      className="slider flex-1"
      min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      onPointerUp={() => onCommit?.()}
      onKeyDown={e => e.stopPropagation()}
    />
  )
}

export function ColorInput({ value, onChange, onCommit, allowEmpty }: {
  value: string
  onChange: (v: string) => void
  onCommit?: () => void
  allowEmpty?: boolean
}) {
  const norm = /^#[0-9a-f]{6}$/i.test(value) ? value : value ? '#000000' : ''
  return (
    <div className="flex h-7 flex-1 items-center gap-1.5 rounded-md bg-ink-800 px-1.5 ring-1 ring-inset ring-ink-700/70 focus-within:ring-gold/60">
      <label className="relative h-4.5 w-4.5 shrink-0 cursor-pointer">
        <span
          className="block h-[18px] w-[18px] rounded-[4px] ring-1 ring-inset ring-white/20"
          style={{
            background: value || 'repeating-conic-gradient(#3a352b 0 25%, #262218 0 50%) 0 0/8px 8px',
          }}
        />
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={norm || '#000000'}
          onChange={e => onChange(e.target.value)}
          onBlur={() => onCommit?.()}
        />
      </label>
      <input
        className="h-full w-full min-w-0 bg-transparent text-xs text-paper outline-none"
        value={value}
        placeholder={allowEmpty ? 'none' : '#000000'}
        onChange={e => onChange(e.target.value)}
        onBlur={() => onCommit?.()}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); e.stopPropagation() }}
        spellCheck={false}
      />
      {allowEmpty && value && (
        <button className="text-paper-faint hover:text-paper" onClick={() => { onChange(''); onCommit?.() }} title="Remove">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        </button>
      )}
    </div>
  )
}

export function Select({ value, onChange, options, className = '' }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[] | string[]
  className?: string
}) {
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <select
      className={`h-7 min-w-0 flex-1 cursor-pointer appearance-none rounded-md bg-ink-800 px-2 text-xs text-paper outline-none ring-1 ring-inset ring-ink-700/70 focus:ring-gold/60 ${className}`}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label?: string; icon?: React.ReactNode; title?: string }[]
}) {
  return (
    <div className="flex h-7 flex-1 items-stretch overflow-hidden rounded-md bg-ink-800 p-0.5 ring-1 ring-inset ring-ink-700/70">
      {options.map(o => (
        <button
          key={o.value}
          title={o.title}
          className={`flex flex-1 items-center justify-center rounded-[5px] px-1 text-2xs transition-colors ${
            value === o.value ? 'bg-ink-600 text-paper shadow-sm' : 'text-paper-faint hover:text-paper-dim'
          }`}
          onClick={() => onChange(o.value)}
        >
          {o.icon ?? o.label}
        </button>
      ))}
    </div>
  )
}

export function IconBtn({ title, onClick, active, children, danger }: {
  title: string
  onClick: (e: React.MouseEvent) => void
  active?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
        active ? 'bg-gold text-ink-950'
          : danger ? 'text-paper-faint hover:bg-danger/15 hover:text-danger'
          : 'text-paper-dim hover:bg-ink-700 hover:text-paper'
      }`}
    >
      {children}
    </button>
  )
}

/** Debounce helper for text-ish inputs writing into history-committing stores. */
export function useDebounced<T>(value: T, delay = 400): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}
