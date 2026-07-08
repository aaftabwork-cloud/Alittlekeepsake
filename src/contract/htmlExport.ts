import { AnyObj, ImgObj, ProjectDoc, TextObj, bandOffsets, docHeight } from '../types'
import {
  adjustToFilter, applyTextCase, blendToCss, fontFamilyCss, gradientToCss,
  shadowToCss, withAlpha,
} from '../lib/filters'
import { fontsHref } from '../lib/fonts'
import { resolveMotion } from '../lib/animPresets'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function styleAttr(pairs: Record<string, string | number | undefined>): string {
  const s = Object.entries(pairs)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
  return s ? ` style="${esc(s)}"` : ''
}

function baseCss(o: AnyObj): Record<string, string | number | undefined> {
  const flip = `${o.flipX ? ' scaleX(-1)' : ''}${o.flipY ? ' scaleY(-1)' : ''}`
  return {
    position: 'absolute',
    left: `${o.x}px`,
    top: `${o.y}px`,
    opacity: o.opacity !== 1 ? o.opacity : undefined,
    'mix-blend-mode': blendToCss(o.blend),
    transform: o.angle || flip ? `rotate(${o.angle}deg)${flip}` : undefined,
    'transform-origin': 'top left',
  }
}

/** Per-element animation payload consumed by the export's tiny runtime. */
function animAttrs(o: AnyObj): string {
  if (o.motion !== 'animated' || !o.anim) return ''
  const m = resolveMotion(o.anim, o.dur, o.motionOpts ?? {})
  if (!m) return ''
  const note = (o.motionOpts?.note as string) ?? ''
  return ` data-anim="${esc(o.anim)}" data-motion="${esc(JSON.stringify(m))}"${note ? ` data-note="${esc(note)}"` : ''}`
}

function objHtml(o: AnyObj): string {
  if (o.hidden) return ''
  const anim = animAttrs(o)
  const field = o.field ? ` data-field="${esc(o.field)}"` : ''

  switch (o.type) {
    case 'text': {
      const t = o as TextObj
      const css = {
        ...baseCss(o),
        width: `${t.w + (t.boxPad ? t.boxPad * 2 : 0)}px`,
        padding: t.boxPad ? `${t.boxPad}px` : undefined,
        background: t.boxFill ? withAlpha(t.boxFill, t.boxFillOpacity ?? 100) : undefined,
        'font-family': fontFamilyCss(t.fontFamily),
        'font-size': `${t.fontSize}px`,
        'font-weight': String(t.fontWeight),
        'font-style': t.fontStyle !== 'normal' ? t.fontStyle : undefined,
        color: t.fill,
        'text-align': t.textAlign,
        'letter-spacing': t.charSpacing ? `${t.charSpacing / 1000}em` : undefined,
        'line-height': String(t.lineHeight),
        'text-decoration': [t.underline && 'underline', t.linethrough && 'line-through'].filter(Boolean).join(' ') || undefined,
        'text-shadow': shadowToCss(t.shadow) || undefined,
        'white-space': 'pre-wrap',
      }
      const inner = t.textBackgroundColor
        ? `<span style="background:${esc(t.textBackgroundColor)}">${esc(applyTextCase(t.text, t.textCase))}</span>`
        : esc(applyTextCase(t.text, t.textCase))
      return `<div${styleAttr(css)}${anim}${field}>${inner}</div>`
    }
    case 'img': {
      const m = o as ImgObj
      const filter = adjustToFilter(m.adjust)
      const shadow = shadowToCss(m.shadow)
      const css = {
        ...baseCss(o),
        width: `${m.w}px`,
        height: `${m.h}px`,
        overflow: 'hidden',
        filter: [filter, shadow ? `drop-shadow(${shadow})` : ''].filter(Boolean).join(' ') || undefined,
      }
      let img: string
      if (m.crop && m.crop.w > 0) {
        const sx = m.w / m.crop.w, sy = m.h / m.crop.h
        img = `<img src="${esc(m.src)}" style="position:absolute;left:${-m.crop.x * sx}px;top:${-m.crop.y * sy}px;transform:scale(${sx},${sy});transform-origin:${m.crop.x * sx}px ${m.crop.y * sy}px;max-width:none" alt="">`
      } else {
        img = `<img src="${esc(m.src)}" style="width:100%;height:100%;object-fit:fill" alt="">`
      }
      return `<div${styleAttr(css)}${anim}${field}>${img}</div>`
    }
    case 'rect': {
      const css = {
        ...baseCss(o),
        width: `${o.w}px`, height: `${o.h}px`,
        background: gradientToCss(o.gradient) || o.fill || undefined,
        border: o.stroke && o.strokeWidth ? `${o.strokeWidth}px solid ${o.stroke}` : undefined,
        'border-radius': o.rx ? `${o.rx}px` : undefined,
        'box-shadow': shadowToCss(o.shadow) || undefined,
      }
      return `<div${styleAttr(css)}${anim}${field}></div>`
    }
    case 'ellipse': {
      const css = {
        ...baseCss(o),
        width: `${o.w}px`, height: `${o.h}px`,
        background: gradientToCss(o.gradient) || o.fill || undefined,
        border: o.stroke && o.strokeWidth ? `${o.strokeWidth}px solid ${o.stroke}` : undefined,
        'border-radius': '50%',
        'box-shadow': shadowToCss(o.shadow) || undefined,
      }
      return `<div${styleAttr(css)}${anim}${field}></div>`
    }
    case 'line': {
      const pad = Math.max(o.strokeWidth, 4)
      const x = Math.min(o.x1, o.x2) - pad, y = Math.min(o.y1, o.y2) - pad
      const w = Math.abs(o.x2 - o.x1) + pad * 2, h = Math.abs(o.y2 - o.y1) + pad * 2
      const css = { ...baseCss(o), left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }
      return `<div${styleAttr(css)}${anim}${field}><svg width="${w}" height="${h}" style="display:block;overflow:visible"><line x1="${o.x1 - x}" y1="${o.y1 - y}" x2="${o.x2 - x}" y2="${o.y2 - y}" stroke="${esc(o.stroke)}" stroke-width="${o.strokeWidth}" stroke-linecap="round"/></svg></div>`
    }
    case 'group': {
      const flip = `${o.flipX ? ' scaleX(-1)' : ''}${o.flipY ? ' scaleY(-1)' : ''}`
      const css = {
        position: 'absolute',
        left: `${o.x}px`, top: `${o.y}px`,
        width: `${o.w}px`, height: `${o.h}px`,
        opacity: o.opacity !== 1 ? o.opacity : undefined,
        'mix-blend-mode': blendToCss(o.blend),
        transform: o.angle || o.scaleX !== 1 || o.scaleY !== 1 || flip
          ? `rotate(${o.angle}deg) scale(${o.scaleX},${o.scaleY})${flip}` : undefined,
        'transform-origin': 'top left',
      }
      return `<div${styleAttr(css)}${anim}${field}><div style="position:absolute;left:${-o.x}px;top:${-o.y}px">${o.objects.map(objHtml).join('')}</div></div>`
    }
  }
}

/** Standalone HTML preview of the invite (animation approximations included). */
export function exportHtml(doc: ProjectDoc): string {
  const fonts = new Set<string>()
  const walk = (objs: AnyObj[]) => {
    for (const o of objs) {
      if (o.type === 'text') fonts.add(o.fontFamily)
      if (o.type === 'group') walk(o.objects)
    }
  }
  walk(doc.objects)

  const offs = bandOffsets(doc.bands)
  const bandsHtml = doc.bands.map(b => `
    <div class="band" data-band="${esc(b.id)}" style="position:absolute;left:0;top:${offs.get(b.id)}px;width:${doc.width}px;height:${b.height}px;background:${esc(b.bg || '#fff')};overflow:hidden">
      ${b.bgImage ? `<img src="${esc(b.bgImage)}" style="width:100%;height:100%;object-fit:cover" alt="">` : ''}
    </div>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.name)}</title>
${fonts.size ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fontsHref([...fonts])}">` : ''}
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#111;display:flex;justify-content:center}
.stage-wrap{position:relative;width:100%;max-width:${doc.width}px}
.stage{position:relative;width:${doc.width}px;height:${docHeight(doc)}px;transform-origin:top left}
</style>
</head>
<body>
<div class="stage-wrap"><div class="stage" id="stage">
${bandsHtml}
${doc.objects.map(objHtml).join('\n')}
</div></div>
<script>
// responsive scale
const stage = document.getElementById('stage')
const fit = () => {
  const s = Math.min(1, document.documentElement.clientWidth / ${doc.width})
  stage.style.transform = 'scale(' + s + ')'
  stage.parentElement.style.height = (${docHeight(doc)} * s) + 'px'
}
fit(); addEventListener('resize', fit)

// tiny motion runtime — approximates the GSAP presets from data-motion
const EASES = { 'sine.inOut':'cubic-bezier(0.45,0,0.55,1)', 'sine.out':'cubic-bezier(0.39,0.575,0.565,1)',
  'cubic.out':'cubic-bezier(0.22,1,0.36,1)', 'cubic.in':'cubic-bezier(0.55,0.055,0.675,0.19)',
  'cubic.inOut':'cubic-bezier(0.65,0,0.35,1)', linear:'linear', steps:'steps(3, end)' }
function play(el){
  const m = JSON.parse(el.dataset.motion)
  const target = 'translate('+m.x+'px,'+m.y+'px) rotate('+m.rotate+'deg) scale('+m.scale+')'
  const entrance = m.trigger === 'enter'
  const frames = entrance
    ? [{opacity:m.opacity/100, transform:target}, {opacity:1, transform:'none'}]
    : [{opacity:1, transform:'none'}, {opacity:m.opacity/100, transform:target}]
  el.animate(frames, {
    duration: Math.max(0.05, m.dur || 6) * 1000,
    delay: (m.delay || 0) * 1000,
    easing: EASES[m.ease] || 'ease-in-out',
    iterations: m.loop ? Infinity : 1,
    direction: m.yoyo ? 'alternate' : 'normal',
    fill: 'backwards',
  })
}
const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue
    play(e.target); io.unobserve(e.target)
  }
}, { threshold: 0.15 })
document.querySelectorAll('[data-motion]').forEach(el => {
  const m = JSON.parse(el.dataset.motion)
  if (m.trigger === 'enter' || m.trigger === 'scroll') io.observe(el)
  else play(el)
})
</script>
</body>
</html>`
}
