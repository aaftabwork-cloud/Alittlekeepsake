import { useEffect, useRef } from 'react'
import { useDoc } from '../store/doc'
import { useUi } from '../store/ui'
import { AnyObj, uid } from '../types'
import { translateObj } from './canvas/objBox'

let clipboard: AnyObj[] = []

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}

export function useShortcuts(onSave: () => void, onZoomFit: () => void) {
  const nudging = useRef(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const doc = useDoc.getState()
      const ui = useUi.getState()
      if (!doc.doc) return
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        onSave()
        return
      }

      if (isTyping(e)) return

      // undo / redo
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? doc.redo() : doc.undo()
        return
      }

      // zoom
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); ui.setZoom(ui.zoom * 1.25); return }
      if (mod && e.key === '-') { e.preventDefault(); ui.setZoom(ui.zoom / 1.25); return }
      if (mod && e.key === '0') { e.preventDefault(); onZoomFit(); return }
      if (mod && e.key === '1') { e.preventDefault(); ui.setZoom(1); return }

      // select all
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        ui.select(doc.doc.objects.filter(o => !o.locked && !o.hidden).map(o => o.id))
        return
      }

      // group / ungroup
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        if (e.shiftKey) {
          const g = doc.doc.objects.find(o => ui.selection.includes(o.id) && o.type === 'group')
          if (g) ui.select(doc.ungroup(g.id))
        } else {
          const gid = doc.groupObjects(ui.selection)
          if (gid) ui.select([gid])
        }
        return
      }

      // duplicate
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (ui.selection.length) ui.select(doc.duplicateObjects(ui.selection))
        return
      }

      // copy / paste / cut
      if (mod && e.key.toLowerCase() === 'c') {
        clipboard = doc.doc.objects.filter(o => ui.selection.includes(o.id)).map(o => JSON.parse(JSON.stringify(o)))
        return
      }
      if (mod && e.key.toLowerCase() === 'x') {
        clipboard = doc.doc.objects.filter(o => ui.selection.includes(o.id)).map(o => JSON.parse(JSON.stringify(o)))
        doc.removeObjects(ui.selection)
        ui.clearSelection()
        return
      }
      if (mod && e.key.toLowerCase() === 'v' && clipboard.length) {
        e.preventDefault()
        const ids: string[] = []
        doc.apply(d => {
          for (const src of clipboard) {
            const clone = JSON.parse(JSON.stringify(src)) as AnyObj
            const reId = (o: AnyObj) => { o.id = uid(); if (o.type === 'group') o.objects.forEach(reId) }
            reId(clone)
            translateObj(clone, 24, 24)
            clone.custom = true
            d.objects.push(clone)
            ids.push(clone.id)
          }
        })
        ui.select(ids)
        return
      }

      // z-order
      if (e.key === ']' && ui.selection.length) { e.preventDefault(); doc.reorder(ui.selection, mod ? 'front' : 'forward'); return }
      if (e.key === '[' && ui.selection.length) { e.preventDefault(); doc.reorder(ui.selection, mod ? 'back' : 'backward'); return }

      // delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selection.length) {
        e.preventDefault()
        doc.removeObjects(ui.selection)
        ui.clearSelection()
        return
      }

      // nudge
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && ui.selection.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        if (!nudging.current) { doc.beginGesture(); nudging.current = true }
        doc.applyLive(d => {
          for (const o of d.objects) if (ui.selection.includes(o.id)) translateObj(o, dx, dy)
        })
        return
      }

      // space → pan
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        ui.setSpaceHeld(true)
        return
      }

      // escape
      if (e.key === 'Escape') {
        if (ui.editingTextId) ui.setEditingText(null)
        else if (ui.cropTargetId) ui.setCropTarget(null)
        else if (ui.previewMode) ui.setPreview(false)
        else ui.clearSelection()
        return
      }

      // enter → edit text
      if (e.key === 'Enter' && ui.selection.length === 1) {
        const o = doc.doc.objects.find(x => x.id === ui.selection[0])
        if (o?.type === 'text') { e.preventDefault(); ui.setEditingText(o.id) }
        return
      }

      // tools
      if (!mod) {
        const tool = { v: 'select', h: 'hand', t: 'text', r: 'rect', o: 'ellipse', l: 'line' }[e.key.toLowerCase()]
        if (tool) { ui.setTool(tool as any); return }
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') useUi.getState().setSpaceHeld(false)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && nudging.current) {
        useDoc.getState().endGesture()
        nudging.current = false
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onSave, onZoomFit])
}
