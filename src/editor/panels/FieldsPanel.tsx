import React from 'react'
import { useDoc } from '../../store/doc'
import { useUi } from '../../store/ui'
import type { AnyObj, TextObj } from '../../types'

interface FieldEntry { obj: AnyObj; band: string }

function collectFields(objs: AnyObj[], out: FieldEntry[]) {
  for (const o of objs) {
    if (o.field) out.push({ obj: o, band: o.band })
    if (o.type === 'group') collectFields(o.objects, out)
  }
}

/** One form listing every `field`-tagged object, so retexting a duplicated
 *  template (names/date/venue) takes seconds instead of hunting layers.
 *  (Part B #4 — the reskin business motion.) */
export function FieldsPanel() {
  const doc = useDoc(s => s.doc)
  const updateObjs = useDoc(s => s.updateObjs)
  const select = useUi(s => s.select)
  if (!doc) return null

  const entries: FieldEntry[] = []
  collectFields(doc.objects, entries)

  if (!entries.length) {
    return (
      <div className="px-4 py-6 text-2xs leading-relaxed text-paper-faint">
        No editable fields yet. Select an object and tag it under
        <span className="text-paper-dim"> Inspector → Editable field </span>
        (names, date, venue…) — it will appear here for quick retexting.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      {entries.map(({ obj }) => (
        <label key={obj.id} className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-3xs font-semibold uppercase tracking-[0.12em] text-paper-faint">
            {obj.field}
            <button
              className="font-normal normal-case tracking-normal text-gold hover:underline"
              onClick={() => select([obj.id])}>
              show
            </button>
          </span>
          {obj.type === 'text' ? (
            <textarea
              className="min-h-[30px] resize-y rounded-md bg-ink-900 px-2 py-1.5 text-xs text-paper ring-1 ring-inset ring-ink-700 focus:ring-gold"
              rows={(obj as TextObj).text.includes('\n') ? 2 : 1}
              defaultValue={(obj as TextObj).text}
              key={obj.id + (obj as TextObj).text}
              onKeyDown={e => e.stopPropagation()}
              onBlur={e => {
                const v = e.target.value
                if (v !== (obj as TextObj).text) updateObjs([obj.id], ob => { (ob as TextObj).text = v })
              }}
            />
          ) : (
            <span className="rounded-md bg-ink-900 px-2 py-1.5 text-2xs text-paper-faint ring-1 ring-inset ring-ink-700">
              {obj.type} field — use “show” to edit it on the canvas
            </span>
          )}
        </label>
      ))}
    </div>
  )
}
