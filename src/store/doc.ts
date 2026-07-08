import { create } from 'zustand'
import { produce } from 'immer'
import {
  AnyObj, GroupObj, ProjectDoc, bandOffsets, uid,
} from '../types'

const HISTORY_LIMIT = 120

interface DocState {
  doc: ProjectDoc | null
  bandsKey: string
  projectId: string | null
  dirty: boolean
  past: ProjectDoc[]
  future: ProjectDoc[]
  gestureBase: ProjectDoc | null

  load(doc: ProjectDoc, bandsKey: string, projectId: string | null): void
  close(): void
  /** Discrete, undoable change. */
  apply(fn: (d: ProjectDoc) => void): void
  /** Continuous change during a drag — no history entry. */
  applyLive(fn: (d: ProjectDoc) => void): void
  beginGesture(): void
  endGesture(): void
  cancelGesture(): void
  undo(): void
  redo(): void
  markSaved(): void

  // conveniences
  updateObjs(ids: string[], fn: (o: AnyObj) => void, live?: boolean): void
  addObject(obj: AnyObj, index?: number): void
  removeObjects(ids: string[]): void
  duplicateObjects(ids: string[]): string[]
  /** Move a band to a new index, shifting every object so it stays on its band. */
  moveBand(id: string, toIndex: number): void
  /** Clone a band and its objects (appended right below it); returns the new band id. */
  duplicateBand(id: string): string | null
  reorder(ids: string[], dir: 'front' | 'back' | 'forward' | 'backward'): void
  groupObjects(ids: string[]): string | null
  ungroup(id: string): string[]
}

/** Shift any object vertically, keeping lines and group children consistent. */
function shiftObjY(o: AnyObj, dy: number) {
  o.y += dy
  if (o.type === 'line') { o.y1 += dy; o.y2 += dy }
  if (o.type === 'group') translateGroup(o, 0, dy)
}

function translateGroup(g: GroupObj, dx: number, dy: number) {
  const walk = (objs: AnyObj[]) => {
    for (const c of objs) {
      c.x += dx; c.y += dy
      if (c.type === 'line') { c.x1 += dx; c.y1 += dy; c.x2 += dx; c.y2 += dy }
      if (c.type === 'group') walk(c.objects)
    }
  }
  walk(g.objects)
}

export const useDoc = create<DocState>((set, get) => ({
  doc: null,
  bandsKey: 'pages',
  projectId: null,
  dirty: false,
  past: [],
  future: [],
  gestureBase: null,

  load: (doc, bandsKey, projectId) =>
    set({ doc, bandsKey, projectId, dirty: false, past: [], future: [], gestureBase: null }),

  close: () => set({ doc: null, projectId: null, past: [], future: [], dirty: false }),

  apply: fn => {
    const { doc, past } = get()
    if (!doc) return
    const next = produce(doc, fn)
    if (next === doc) return
    set({
      doc: next,
      past: [...past.slice(-HISTORY_LIMIT), doc],
      future: [],
      dirty: true,
    })
  },

  applyLive: fn => {
    const { doc } = get()
    if (!doc) return
    const next = produce(doc, fn)
    if (next !== doc) set({ doc: next, dirty: true })
  },

  beginGesture: () => {
    const { doc } = get()
    if (doc) set({ gestureBase: doc })
  },

  endGesture: () => {
    const { doc, gestureBase, past } = get()
    if (!doc || !gestureBase) return
    if (doc !== gestureBase) {
      set({ past: [...past.slice(-HISTORY_LIMIT), gestureBase], future: [], gestureBase: null })
    } else {
      set({ gestureBase: null })
    }
  },

  cancelGesture: () => {
    const { gestureBase } = get()
    if (gestureBase) set({ doc: gestureBase, gestureBase: null })
  },

  undo: () => {
    const { doc, past, future } = get()
    if (!doc || !past.length) return
    const prev = past[past.length - 1]
    set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], dirty: true })
  },

  redo: () => {
    const { doc, past, future } = get()
    if (!doc || !future.length) return
    const next = future[0]
    set({ doc: next, past: [...past, doc], future: future.slice(1), dirty: true })
  },

  markSaved: () => set({ dirty: false }),

  updateObjs: (ids, fn, live) => {
    const op = (d: ProjectDoc) => {
      for (const o of d.objects) if (ids.includes(o.id)) fn(o)
    }
    live ? get().applyLive(op) : get().apply(op)
  },

  addObject: (obj, index) =>
    get().apply(d => {
      if (index === undefined) d.objects.push(obj)
      else d.objects.splice(index, 0, obj)
    }),

  removeObjects: ids =>
    get().apply(d => {
      d.objects = d.objects.filter(o => !ids.includes(o.id))
    }),

  duplicateObjects: ids => {
    const newIds: string[] = []
    get().apply(d => {
      const clones: AnyObj[] = []
      for (const o of d.objects) {
        if (!ids.includes(o.id)) continue
        const clone = JSON.parse(JSON.stringify(o)) as AnyObj
        const reId = (obj: AnyObj) => {
          obj.id = uid()
          if (obj.type === 'group') obj.objects.forEach(reId)
        }
        reId(clone)
        clone.x += 16; clone.y += 16
        if (clone.type === 'line') { clone.x1 += 16; clone.y1 += 16; clone.x2 += 16; clone.y2 += 16 }
        if (clone.type === 'group') translateGroup(clone, 16, 16)
        clone.custom = true
        clone.name = clone.name ? `${clone.name} copy` : clone.name
        clones.push(clone)
        newIds.push(clone.id)
      }
      d.objects.push(...clones)
    })
    return newIds
  },

  moveBand: (id, toIndex) =>
    get().apply(d => {
      const from = d.bands.findIndex(b => b.id === id)
      if (from < 0 || toIndex < 0 || toIndex >= d.bands.length || from === toIndex) return
      const before = bandOffsets(d.bands)
      const [b] = d.bands.splice(from, 1)
      d.bands.splice(toIndex, 0, b)
      const after = bandOffsets(d.bands)
      for (const o of d.objects) {
        const dy = (after.get(o.band) ?? 0) - (before.get(o.band) ?? 0)
        if (dy) shiftObjY(o, dy)
      }
    }),

  duplicateBand: id => {
    let newId: string | null = null
    get().apply(d => {
      const i = d.bands.findIndex(b => b.id === id)
      if (i < 0) return
      const src = d.bands[i]
      const clone = JSON.parse(JSON.stringify(src)) as typeof src
      let n = 2
      while (d.bands.some(b => b.id === `${src.id}-${n}`)) n++
      clone.id = `${src.id}-${n}`
      clone.name = `${src.name} copy`
      newId = clone.id
      const before = bandOffsets(d.bands)
      d.bands.splice(i + 1, 0, clone)
      const after = bandOffsets(d.bands)
      // keep existing objects glued to their (possibly shifted) bands
      const objClones: AnyObj[] = []
      for (const o of d.objects) {
        if (o.band === src.id) {
          const c = JSON.parse(JSON.stringify(o)) as AnyObj
          const reId = (obj: AnyObj) => {
            obj.id = uid()
            if (obj.type === 'group') obj.objects.forEach(reId)
          }
          reId(c)
          c.band = clone.id
          shiftObjY(c, src.height)   // clone band sits directly below the source
          objClones.push(c)
        }
        const dy = (after.get(o.band) ?? 0) - (before.get(o.band) ?? 0)
        if (dy) shiftObjY(o, dy)
      }
      d.objects.push(...objClones)
    })
    return newId
  },

  reorder: (ids, dir) =>
    get().apply(d => {
      const idx = d.objects.map((o, i) => (ids.includes(o.id) ? i : -1)).filter(i => i >= 0)
      if (!idx.length) return
      const picked = idx.map(i => d.objects[i])
      const rest = d.objects.filter(o => !ids.includes(o.id))
      switch (dir) {
        case 'front': d.objects = [...rest, ...picked]; break
        case 'back': d.objects = [...picked, ...rest]; break
        case 'forward': {
          const at = Math.min(rest.length, Math.max(...idx) + 1 - (picked.length - 1))
          rest.splice(at, 0, ...picked); d.objects = rest; break
        }
        case 'backward': {
          const at = Math.max(0, Math.min(...idx) - 1)
          rest.splice(at, 0, ...picked); d.objects = rest; break
        }
      }
    }),

  groupObjects: ids => {
    if (ids.length < 2) return null
    const gid = uid('g')
    get().apply(d => {
      const members = d.objects.filter(o => ids.includes(o.id))
      if (members.length < 2) return
      const xs = members.flatMap(m => m.type === 'line' ? [m.x1, m.x2] : [m.x, m.x + (m as any).w || m.x])
      const ys = members.flatMap(m => m.type === 'line' ? [m.y1, m.y2] : [m.y, m.y + (m as any).h || m.y])
      const x = Math.min(...xs), y = Math.min(...ys)
      const group: GroupObj = {
        id: gid, type: 'group',
        x, y,
        w: Math.max(...xs) - x, h: Math.max(...ys) - y,
        scaleX: 1, scaleY: 1,
        opacity: 1, blend: 'source-over',
        band: members[0].band, angle: 0, flipX: false, flipY: false,
        name: 'Group', locked: false, hidden: false, custom: true, field: '',
        motion: 'static', anim: '', dur: 0, motionOpts: {},
        // export in the pipeline's native (Fabric center-relative) space
        childMode: 'center-relative',
        objects: members,
      }
      const firstIdx = d.objects.findIndex(o => ids.includes(o.id))
      d.objects = d.objects.filter(o => !ids.includes(o.id))
      d.objects.splice(firstIdx, 0, group)
    })
    return gid
  },

  ungroup: id => {
    let childIds: string[] = []
    get().apply(d => {
      const idx = d.objects.findIndex(o => o.id === id && o.type === 'group')
      if (idx < 0) return
      const g = d.objects[idx] as GroupObj
      childIds = g.objects.map(c => c.id)
      d.objects.splice(idx, 1, ...g.objects)
    })
    return childIds
  },
}))

/** Band vertical offset lookup for the current doc. */
export function useBandOffsets(): Map<string, number> {
  const doc = useDoc(s => s.doc)
  return doc ? bandOffsets(doc.bands) : new Map()
}

export { bandAtY } from '../types'
