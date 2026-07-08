/** Animation presets — the EXACT vocabulary of the v1 studio + pipeline
 * (verified against studio.html ANIM_PRESETS). `id` is what the pipeline
 * reads from `anim`; opts x/y/rotate/scale/opacity/loop/yoyo/ease/trigger
 * live in `motionOpts` as per-object overrides. The editor preview
 * approximates the GSAP behaviour with WAAPI. */

export interface AnimPreset {
  id: string
  label: string
  group: 'Ambient' | 'Travel' | 'Emphasis' | 'Rotation' | 'Entrance' | 'Special' | 'Scroll'
  hint: string
  dur: number
  x: number
  y: number
  rotate: number
  scale: number
  /** target opacity in percent (100 = unchanged) */
  opacity: number
  loop: boolean
  yoyo: boolean
  ease: string
  trigger?: 'enter' | 'scroll'
}

export const ANIM_PRESETS: AnimPreset[] = [
  { id: 'float-drift', label: 'Float & drift', group: 'Ambient', hint: 'Drifts diagonally with a gentle tilt, forever.', dur: 8, x: 18, y: -18, rotate: 2, scale: 1, opacity: 100, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'bob', label: 'Bob up/down', group: 'Ambient', hint: 'Bobs vertically like floating on water.', dur: 5, x: 0, y: -24, rotate: 0, scale: 1, opacity: 100, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'bob-rotate', label: 'Bob + sway', group: 'Ambient', hint: 'Bobs while swaying a few degrees.', dur: 6, x: 0, y: -18, rotate: 4, scale: 1, opacity: 100, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'move-x', label: 'Move left/right', group: 'Travel', hint: 'Travels horizontally and returns.', dur: 8, x: 120, y: 0, rotate: 0, scale: 1, opacity: 100, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'move-y', label: 'Move up/down', group: 'Travel', hint: 'Travels vertically and returns.', dur: 7, x: 0, y: -100, rotate: 0, scale: 1, opacity: 100, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'glide', label: 'Glide slowly', group: 'Travel', hint: 'Long slow glide across, with a slight lift.', dur: 11, x: 160, y: -12, rotate: 0, scale: 1, opacity: 100, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'drift-x', label: 'Wide cloud drift', group: 'Travel', hint: 'Very slow, very wide drift — clouds, mist.', dur: 16, x: 220, y: 0, rotate: 0, scale: 1, opacity: 100, loop: true, yoyo: true, ease: 'linear' },
  { id: 'fade-pulse', label: 'Fade pulse', group: 'Emphasis', hint: 'Opacity breathes down to ~45% and back.', dur: 4, x: 0, y: 0, rotate: 0, scale: 1, opacity: 45, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'flicker', label: 'Flicker', group: 'Emphasis', hint: 'Stepped flicker — candles, fireflies.', dur: 4.5, x: 0, y: 0, rotate: 0, scale: 1, opacity: 55, loop: true, yoyo: true, ease: 'steps' },
  { id: 'twinkle', label: 'Twinkle', group: 'Emphasis', hint: 'Dims and slightly grows — stars.', dur: 3.8, x: 0, y: 0, rotate: 0, scale: 1.08, opacity: 35, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'breathe', label: 'Breathe scale', group: 'Emphasis', hint: 'Barely-visible scale breathing.', dur: 8, x: 0, y: 0, rotate: 0, scale: 1.04, opacity: 100, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'bloom-pulse', label: 'Bloom pulse', group: 'Emphasis', hint: 'Soft grow-and-shrink — florals, halos.', dur: 7, x: 0, y: 0, rotate: 0, scale: 1.08, opacity: 100, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'rotate-slow', label: 'Slow rotate', group: 'Rotation', hint: 'Full continuous rotation — mandalas, stars.', dur: 14, x: 0, y: 0, rotate: 360, scale: 1, opacity: 100, loop: true, yoyo: false, ease: 'linear' },
  { id: 'sway', label: 'Sway', group: 'Rotation', hint: 'Rocks a few degrees side to side.', dur: 5.5, x: 0, y: 0, rotate: 7, scale: 1, opacity: 100, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'reveal-up', label: 'Reveal up', group: 'Entrance', hint: 'Rises into place while fading in, on scroll into view.', dur: 1.2, x: 0, y: 28, rotate: 0, scale: 1, opacity: 0, loop: false, yoyo: false, ease: 'cubic.out', trigger: 'enter' },
  { id: 'reveal-soft', label: 'Soft fade in', group: 'Entrance', hint: 'Fades in with a whisper of scale, on scroll into view.', dur: 1.4, x: 0, y: 0, rotate: 0, scale: 1.02, opacity: 0, loop: false, yoyo: false, ease: 'cubic.out', trigger: 'enter' },
  { id: 'ripple', label: 'Ripple', group: 'Special', hint: 'Expands and fades out repeatedly — rings on water.', dur: 4.2, x: 0, y: 0, rotate: 0, scale: 1.22, opacity: 0, loop: true, yoyo: false, ease: 'sine.out' },
  { id: 'swim', label: 'Swim path', group: 'Special', hint: 'Wandering swim — koi, birds.', dur: 13, x: 120, y: -30, rotate: 6, scale: 1, opacity: 100, loop: true, yoyo: true, ease: 'sine.inOut' },
  { id: 'dart', label: 'Dart hops', group: 'Special', hint: 'Quick darting hops — dragonflies, sparrows.', dur: 7.5, x: 90, y: -50, rotate: 10, scale: 1, opacity: 100, loop: true, yoyo: true, ease: 'cubic.inOut' },
  { id: 'streak', label: 'Shooting streak', group: 'Special', hint: 'Streaks away and fades — shooting stars.', dur: 9, x: 260, y: -120, rotate: 0, scale: 1, opacity: 0, loop: true, yoyo: false, ease: 'cubic.in' },
  { id: 'parallax', label: 'Parallax on scroll', group: 'Scroll', hint: 'Moves against the scroll for depth.', dur: 0, x: 0, y: -80, rotate: 0, scale: 1, opacity: 100, loop: false, yoyo: false, ease: 'linear', trigger: 'scroll' },
]

export const PRESET_BY_ID = new Map(ANIM_PRESETS.map(p => [p.id, p]))
export const PRESET_GROUPS = ['Entrance', 'Ambient', 'Travel', 'Emphasis', 'Rotation', 'Special', 'Scroll'] as const

const EASE_MAP: Record<string, string> = {
  'sine.inOut': 'cubic-bezier(0.45, 0, 0.55, 1)',
  'sine.out': 'cubic-bezier(0.39, 0.575, 0.565, 1)',
  'cubic.out': 'cubic-bezier(0.22, 1, 0.36, 1)',
  'cubic.in': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  'cubic.inOut': 'cubic-bezier(0.65, 0, 0.35, 1)',
  linear: 'linear',
  steps: 'steps(3, end)',
}
export const cssEase = (e?: string) => EASE_MAP[e ?? ''] ?? 'ease-in-out'

export interface ResolvedMotion {
  dur: number
  delay: number
  x: number
  y: number
  rotate: number
  scale: number
  opacity: number
  loop: boolean
  yoyo: boolean
  ease: string
  trigger?: string
}

/** Preset defaults merged with per-object motionOpts overrides. */
export function resolveMotion(anim: string, dur: number, opts: Record<string, unknown>): ResolvedMotion | null {
  const p = PRESET_BY_ID.get(anim)
  if (!p) return null
  const n = (k: string, d: number) => (typeof opts[k] === 'number' ? (opts[k] as number) : d)
  return {
    dur: dur || n('dur', p.dur) || p.dur || 6,
    delay: n('delay', 0),
    x: n('x', p.x),
    y: n('y', p.y),
    rotate: n('rotate', p.rotate),
    scale: n('scale', p.scale),
    opacity: n('opacity', p.opacity),
    loop: typeof opts.loop === 'boolean' ? (opts.loop as boolean) : p.loop,
    yoyo: typeof opts.yoyo === 'boolean' ? (opts.yoyo as boolean) : p.yoyo,
    ease: typeof opts.ease === 'string' ? (opts.ease as string) : p.ease,
    trigger: (opts.trigger as string) ?? p.trigger,
  }
}

/** WAAPI keyframes approximating the GSAP tween (base → target). */
export function motionFrames(m: ResolvedMotion, isEntrance: boolean): Keyframe[] {
  const target = `translate(${m.x}px, ${m.y}px) rotate(${m.rotate}deg) scale(${m.scale})`
  if (isEntrance) {
    // entrance: FROM offset/faded TO identity
    return [
      { opacity: m.opacity / 100, transform: target },
      { opacity: 1, transform: 'translate(0,0) rotate(0deg) scale(1)' },
    ]
  }
  return [
    { opacity: 1, transform: 'translate(0,0) rotate(0deg) scale(1)' },
    { opacity: m.opacity / 100, transform: target },
  ]
}
