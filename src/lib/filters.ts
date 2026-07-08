import { Gradient, ImageAdjust, Shadow } from '../types'

/**
 * CSS approximation of the v1 adjust block for editor preview. Neutral values:
 * exposure/contrast/saturation/vibrance = 100; warmth/hue/fade/glow/sharpness/blur = 0.
 * The exact values live in the JSON; the pipeline re-applies them at bake time.
 */
export function adjustToFilter(a: Partial<ImageAdjust> | null | undefined): string {
  if (!a) return ''
  const parts: string[] = []
  const exposure = a.exposure ?? 100
  const contrast = a.contrast ?? 100
  const saturation = a.saturation ?? 100
  const vibrance = a.vibrance ?? 100
  if (exposure !== 100) parts.push(`brightness(${exposure / 100})`)
  if (contrast !== 100) parts.push(`contrast(${contrast / 100})`)
  const sat = (saturation - 100) + (vibrance - 100) * 0.5
  if (sat) parts.push(`saturate(${Math.max(0, 1 + sat / 100)})`)
  if (a.warmth) {
    if (a.warmth > 0) parts.push(`sepia(${a.warmth / 200})`, `saturate(${1 + a.warmth / 300})`)
    else parts.push(`hue-rotate(${a.warmth * 0.18}deg)`)
  }
  if (a.hue) parts.push(`hue-rotate(${a.hue * 1.8}deg)`)
  if (a.fade) parts.push(`contrast(${1 - a.fade / 250})`, `brightness(${1 + a.fade / 400})`)
  if (a.glow) parts.push(`brightness(${1 + a.glow / 350})`, `drop-shadow(0 0 ${a.glow / 6}px rgba(255,244,214,${a.glow / 200}))`)
  if (a.sharpness) parts.push(`contrast(${1 + a.sharpness / 400})`)
  if (a.blur) parts.push(`blur(${a.blur / 8}px)`)
  return parts.join(' ')
}

export function shadowToCss(s: Shadow | null | undefined): string {
  if (!s || !s.color) return ''
  return `${s.offsetX ?? 0}px ${s.offsetY ?? 0}px ${s.blur ?? 0}px ${s.color}`
}

/** v1 gradient {type, from, to}: linear runs top-left → bottom-right. */
export function gradientToCss(g: Gradient | null | undefined): string {
  if (!g || (!g.from && !g.to)) return ''
  const from = g.from || '#f4e0a0'
  const to = g.to || '#8a3a4e'
  return g.type === 'radial'
    ? `radial-gradient(circle at 50% 50%, ${from}, ${to})`
    : `linear-gradient(to bottom right, ${from}, ${to})`
}

/** Canvas composite-op names (the contract's blend values) → CSS mix-blend-mode. */
export function blendToCss(blend: string | undefined): string | undefined {
  if (!blend || blend === 'source-over' || blend === 'normal') return undefined
  return blend
}

export function applyTextCase(text: string, mode: string): string {
  switch (mode) {
    case 'upper': return text.toUpperCase()
    case 'lower': return text.toLowerCase()
    case 'title': return text.replace(/\b\p{L}/gu, c => c.toUpperCase())
    default: return text
  }
}

/** '#rrggbb' + opacity(0-100) → rgba() — matches v1's text box fill. */
export function withAlpha(hex: string, opacity100: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const a = Math.max(0, Math.min(100, opacity100)) / 100
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** First family of a CSS font stack — for font loading and the picker. */
export const familyName = (stack: string): string =>
  (stack || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '')

/** Quote a font stack correctly for CSS (stacks pass through untouched). */
export const fontFamilyCss = (stack: string): string =>
  stack.includes(',') ? stack : `'${stack}'`
