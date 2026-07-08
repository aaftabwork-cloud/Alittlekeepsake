import { ProjectDoc, bandOffsets } from '../types'
import { familyName } from './filters'

/** Best-effort canvas thumbnail of the first ~2 bands (for project cards). */
export async function renderThumbnail(doc: ProjectDoc, width = 280): Promise<string> {
  try {
    const bands = doc.bands.slice(0, 2)
    const srcH = bands.reduce((s, b) => s + b.height, 0)
    if (!srcH || !doc.width) return ''
    const scale = width / doc.width
    const height = Math.min(Math.round(srcH * scale), Math.round(width * 1.4))
    const cv = document.createElement('canvas')
    cv.width = width
    cv.height = height
    const ctx = cv.getContext('2d')
    if (!ctx) return ''
    ctx.scale(scale, scale)

    const offs = bandOffsets(doc.bands)
    const drawImage = (src: string, x: number, y: number, w: number, h: number) =>
      new Promise<void>(res => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => { try { ctx.drawImage(img, x, y, w, h) } catch { /* tainted */ } res() }
        img.onerror = () => res()
        img.src = src
      })

    for (const b of bands) {
      const y = offs.get(b.id) ?? 0
      ctx.fillStyle = b.bg || '#ffffff'
      ctx.fillRect(0, y, doc.width, b.height)
      if (b.bgImage) await drawImage(b.bgImage, 0, y, doc.width, b.height)
    }

    const visibleY = srcH
    for (const o of doc.objects) {
      if (o.hidden || o.y > visibleY) continue
      ctx.save()
      ctx.globalAlpha = o.opacity
      if (o.angle) {
        ctx.translate(o.x, o.y)
        ctx.rotate(o.angle * Math.PI / 180)
        ctx.translate(-o.x, -o.y)
      }
      if (o.type === 'rect') {
        ctx.fillStyle = o.fill || '#ccc'
        ctx.fillRect(o.x, o.y, o.w, o.h)
      } else if (o.type === 'ellipse') {
        ctx.fillStyle = o.fill || '#ccc'
        ctx.beginPath()
        ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2)
        ctx.fill()
      } else if (o.type === 'img') {
        await drawImage(o.src, o.x, o.y, o.w, o.h)
      } else if (o.type === 'text') {
        ctx.fillStyle = o.fill || '#222'
        ctx.font = `${o.fontStyle === 'italic' ? 'italic ' : ''}${o.fontWeight === 'bold' ? '700 ' : ''}${o.fontSize}px '${familyName(o.fontFamily)}', serif`
        ctx.textAlign = o.textAlign === 'justify' ? 'left' : o.textAlign
        const tx = o.textAlign === 'center' ? o.x + o.w / 2 : o.textAlign === 'right' ? o.x + o.w : o.x
        o.text.split('\n').slice(0, 4).forEach((line, i) => {
          ctx.fillText(line, tx, o.y + o.fontSize * (i + 0.9) * o.lineHeight, o.w)
        })
      } else if (o.type === 'line') {
        ctx.strokeStyle = o.stroke || '#222'
        ctx.lineWidth = o.strokeWidth || 1
        ctx.beginPath()
        ctx.moveTo(o.x1, o.y1)
        ctx.lineTo(o.x2, o.y2)
        ctx.stroke()
      }
      ctx.restore()
    }
    return cv.toDataURL('image/jpeg', 0.72)
  } catch {
    return ''
  }
}
