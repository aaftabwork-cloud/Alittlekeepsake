import React, { useEffect, useLayoutEffect, useRef } from 'react'
import {
  AnyObj, EllipseObj, GroupObj, ImgObj, LineObj, RectObj, TextObj,
} from '../../types'
import { adjustToFilter, blendToCss, fontFamilyCss, gradientToCss, shadowToCss, withAlpha } from '../../lib/filters'
import { ensureFont } from '../../lib/fonts'
import { cssEase, motionFrames, resolveMotion } from '../../lib/animPresets'
import { useUi } from '../../store/ui'
import { usePlayback } from '../../store/playback'
import { useDoc } from '../../store/doc'

function baseStyle(o: AnyObj): React.CSSProperties {
  const flip = `${o.flipX ? ' scaleX(-1)' : ''}${o.flipY ? ' scaleY(-1)' : ''}`
  return {
    position: 'absolute',
    left: o.x,
    top: o.y,
    opacity: o.opacity,
    mixBlendMode: blendToCss(o.blend) as any,
    transform: o.angle || flip ? `rotate(${o.angle}deg)${flip}` : undefined,
    transformOrigin: 'top left',
    display: o.hidden ? 'none' : undefined,
  }
}

/** Hook: plays the object's animation preset when a preview is triggered. */
function useMotionPreview(o: AnyObj, ref: React.RefObject<HTMLElement | null>) {
  const nonce = usePlayback(s => s.nonce)
  const targets = usePlayback(s => s.targets)
  useEffect(() => {
    if (!nonce || !ref.current) return
    if (targets !== 'all' && !targets.includes(o.id)) return
    if (o.motion !== 'animated' || !o.anim) return
    const m = resolveMotion(o.anim, o.dur, o.motionOpts ?? {})
    if (!m) return
    const entrance = m.trigger === 'enter'
    const anim = ref.current.animate(motionFrames(m, entrance), {
      duration: Math.max(0.05, m.dur || 6) * 1000,
      delay: m.delay * 1000,
      easing: cssEase(m.ease),
      iterations: m.loop ? Infinity : 1,
      direction: m.yoyo ? 'alternate' : 'normal',
      fill: 'backwards',
    })
    if (m.loop) {
      const stop = setTimeout(() => anim.cancel(), 8000)
      return () => { clearTimeout(stop); anim.cancel() }
    }
    return () => anim.cancel()
  }, [nonce])
}

/* --------------------------------------------------------------- text */

function TextView({ o }: { o: TextObj }) {
  const ref = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const reportSize = useUi(s => s.reportSize)
  const editing = useUi(s => s.editingTextId === o.id)
  const setEditingText = useUi(s => s.setEditingText)
  const updateObjs = useDoc(s => s.updateObjs)
  useMotionPreview(o, ref)

  ensureFont(o.fontFamily)

  useLayoutEffect(() => {
    if (ref.current) reportSize(o.id, ref.current.offsetWidth, ref.current.offsetHeight)
  })

  useEffect(() => {
    if (editing && innerRef.current) {
      innerRef.current.focus()
      const sel = window.getSelection()
      if (sel && innerRef.current.childNodes.length) {
        sel.selectAllChildren(innerRef.current)
      }
    }
  }, [editing])

  const commit = () => {
    const t = innerRef.current?.innerText ?? o.text
    if (t !== o.text) updateObjs([o.id], obj => { (obj as TextObj).text = t })
    setEditingText(null)
  }

  const style: React.CSSProperties = {
    ...baseStyle(o),
    width: o.w + (o.boxPad ? o.boxPad * 2 : 0),
    padding: o.boxPad || undefined,
    background: o.boxFill ? withAlpha(o.boxFill, o.boxFillOpacity ?? 100) : undefined,
  }
  const textStyle: React.CSSProperties = {
    fontFamily: fontFamilyCss(o.fontFamily),
    fontSize: o.fontSize,
    fontWeight: o.fontWeight as any,
    fontStyle: o.fontStyle,
    color: o.fill,
    textAlign: o.textAlign,
    letterSpacing: `${(o.charSpacing ?? 0) / 1000}em`,
    lineHeight: o.lineHeight,
    textDecoration: [o.underline && 'underline', o.linethrough && 'line-through'].filter(Boolean).join(' ') || undefined,
    textTransform: o.textCase === 'upper' ? 'uppercase' : o.textCase === 'lower' ? 'lowercase' : o.textCase === 'title' ? 'capitalize' : undefined,
    textShadow: shadowToCss(o.shadow) || undefined,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    outline: 'none',
    cursor: editing ? 'text' : undefined,
  }

  return (
    <div ref={ref} data-obj-id={o.id} style={style}>
      <div
        ref={innerRef}
        style={textStyle}
        contentEditable={editing}
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={editing ? commit : undefined}
        onKeyDown={editing ? e => {
          e.stopPropagation()
          if (e.key === 'Escape') commit()
        } : undefined}
        onPointerDown={editing ? e => e.stopPropagation() : undefined}
      >
        {o.textBackgroundColor
          ? <span style={{ background: o.textBackgroundColor, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' as any }}>{o.text}</span>
          : o.text}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- image */

function ImgView({ o }: { o: ImgObj }) {
  const ref = useRef<HTMLDivElement>(null)
  const [broken, setBroken] = React.useState(false)
  useEffect(() => { setBroken(false) }, [o.src])
  useMotionPreview(o, ref)
  const filter = adjustToFilter(o.adjust)
  const shadow = shadowToCss(o.shadow)

  if (broken) {
    return (
      <div
        ref={ref}
        data-obj-id={o.id}
        style={{
          ...baseStyle(o), width: o.w, height: o.h,
          background: 'repeating-conic-gradient(#e8e2d4 0 25%, #d8d0bd 0 50%) 0 0/16px 16px',
          outline: '1px dashed #a89468', display: 'flex', alignItems: 'center',
          justifyContent: 'center', overflow: 'hidden',
        }}
        title={o.src}
      >
        <span style={{
          fontSize: Math.max(10, Math.min(14, o.w / 14)), color: '#7a6a45', padding: 8,
          textAlign: 'center', fontFamily: 'Instrument Sans, sans-serif', wordBreak: 'break-all',
        }}>
          missing: {o.src.split('/').pop()?.slice(0, 40) || 'image'}
        </span>
      </div>
    )
  }

  let img: React.ReactNode
  if (o.crop && o.crop.w > 0 && o.crop.h > 0) {
    const sx = o.w / o.crop.w
    const sy = o.h / o.crop.h
    img = (
      <img
        src={o.src}
        draggable={false}
        onError={() => setBroken(true)}
        style={{
          position: 'absolute',
          left: -o.crop.x * sx,
          top: -o.crop.y * sy,
          transform: `scale(${sx}, ${sy})`,
          transformOrigin: `${o.crop.x * sx}px ${o.crop.y * sy}px`,
          maxWidth: 'none',
        }}
        alt=""
      />
    )
  } else {
    img = <img src={o.src} draggable={false} onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'fill' }} alt="" />
  }

  return (
    <div
      ref={ref}
      data-obj-id={o.id}
      style={{
        ...baseStyle(o),
        width: o.w,
        height: o.h,
        overflow: 'hidden',
        filter: [filter, shadow ? `drop-shadow(${shadow})` : ''].filter(Boolean).join(' ') || undefined,
      }}
    >
      {img}
    </div>
  )
}

/* --------------------------------------------------------------- shapes */

function RectView({ o }: { o: RectObj }) {
  const ref = useRef<HTMLDivElement>(null)
  useMotionPreview(o, ref)
  return (
    <div
      ref={ref}
      data-obj-id={o.id}
      style={{
        ...baseStyle(o),
        width: o.w,
        height: o.h,
        background: gradientToCss(o.gradient) || o.fill || undefined,
        border: o.stroke && o.strokeWidth ? `${o.strokeWidth}px solid ${o.stroke}` : undefined,
        borderRadius: o.rx || undefined,
        boxShadow: shadowToCss(o.shadow) || undefined,
      }}
    />
  )
}

function EllipseView({ o }: { o: EllipseObj }) {
  const ref = useRef<HTMLDivElement>(null)
  useMotionPreview(o, ref)
  return (
    <div
      ref={ref}
      data-obj-id={o.id}
      style={{
        ...baseStyle(o),
        width: o.w,
        height: o.h,
        background: gradientToCss(o.gradient) || o.fill || undefined,
        border: o.stroke && o.strokeWidth ? `${o.strokeWidth}px solid ${o.stroke}` : undefined,
        borderRadius: '50%',
        boxShadow: shadowToCss(o.shadow) || undefined,
      }}
    />
  )
}

function LineView({ o }: { o: LineObj }) {
  const ref = useRef<HTMLDivElement>(null)
  useMotionPreview(o, ref)
  const pad = Math.max(o.strokeWidth, 4)
  const x = Math.min(o.x1, o.x2) - pad
  const y = Math.min(o.y1, o.y2) - pad
  const w = Math.abs(o.x2 - o.x1) + pad * 2
  const h = Math.abs(o.y2 - o.y1) + pad * 2
  return (
    <div
      ref={ref}
      data-obj-id={o.id}
      style={{ ...baseStyle(o), left: x, top: y, width: w, height: h }}
    >
      <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
        <line
          x1={o.x1 - x} y1={o.y1 - y} x2={o.x2 - x} y2={o.y2 - y}
          stroke={o.stroke} strokeWidth={o.strokeWidth} strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function GroupView({ o }: { o: GroupObj }) {
  const ref = useRef<HTMLDivElement>(null)
  useMotionPreview(o, ref)
  const flip = `${o.flipX ? ' scaleX(-1)' : ''}${o.flipY ? ' scaleY(-1)' : ''}`
  const hasTransform = o.angle || o.scaleX !== 1 || o.scaleY !== 1 || flip
  return (
    <div
      ref={ref}
      data-obj-id={o.id}
      data-group="1"
      style={{
        position: 'absolute',
        left: o.x,
        top: o.y,
        width: o.w,
        height: o.h,
        opacity: o.opacity,
        mixBlendMode: (o.blend !== 'normal' ? o.blend : undefined) as any,
        transform: hasTransform ? `rotate(${o.angle}deg) scale(${o.scaleX}, ${o.scaleY})${flip}` : undefined,
        transformOrigin: 'top left',
        display: o.hidden ? 'none' : undefined,
        pointerEvents: 'none',
      }}
    >
      {/* children are stored in absolute artboard coords; offset back */}
      <div style={{ position: 'absolute', left: -o.x, top: -o.y }}>
        {o.objects.map(c => <ObjectView key={c.id} obj={c} />)}
      </div>
    </div>
  )
}

export function ObjectView({ obj }: { obj: AnyObj }) {
  switch (obj.type) {
    case 'text': return <TextView o={obj} />
    case 'img': return <ImgView o={obj} />
    case 'rect': return <RectView o={obj} />
    case 'ellipse': return <EllipseView o={obj} />
    case 'line': return <LineView o={obj} />
    case 'group': return <GroupView o={obj} />
    default: return null
  }
}
