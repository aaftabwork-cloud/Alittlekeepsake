import { create } from 'zustand'
import { SnapLine } from '../lib/geometry'

export type Tool = 'select' | 'hand' | 'text' | 'rect' | 'ellipse' | 'line' | 'image'
export type LeftTab = 'layers' | 'assets' | 'fields'

interface UiState {
  tool: Tool
  selection: string[]
  /** a page/section selected by clicking its background on the canvas */
  selectedBandId: string | null
  editingTextId: string | null
  zoom: number
  panX: number
  panY: number
  snapEnabled: boolean
  snapLines: SnapLine[]
  leftTab: LeftTab
  previewMode: boolean
  cropTargetId: string | null
  marquee: { x: number; y: number; w: number; h: number } | null
  /** measured on-screen sizes (esp. text auto-height), doc px */
  sizes: Record<string, { w: number; h: number }>
  spaceHeld: boolean
  /** canvas viewport + artboard dims, for pan clamping */
  vpW: number
  vpH: number
  docW: number
  docH: number

  setViewportSize(w: number, h: number): void
  setDocSize(w: number, h: number): void
  setTool(t: Tool): void
  select(ids: string[], additive?: boolean): void
  selectBand(id: string | null): void
  clearSelection(): void
  setEditingText(id: string | null): void
  setZoom(z: number, cx?: number, cy?: number): void
  setPan(x: number, y: number): void
  setSnapLines(l: SnapLine[]): void
  toggleSnap(): void
  setLeftTab(t: LeftTab): void
  setPreview(v: boolean): void
  setCropTarget(id: string | null): void
  setMarquee(m: UiState['marquee']): void
  reportSize(id: string, w: number, h: number): void
  setSpaceHeld(v: boolean): void
}

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 6

/** Keep the artboard reachable: never let it fully leave the viewport. */
function clampPan(x: number, y: number, s: { zoom: number; vpW: number; vpH: number; docW: number; docH: number }) {
  if (!s.vpW || !s.docW) return { x, y }
  const slackX = Math.max(120, s.vpW * 0.4)
  const slackY = Math.max(120, s.vpH * 0.4)
  return {
    x: Math.min(s.vpW - slackX * 0.5, Math.max(slackX - s.docW * s.zoom, x)),
    y: Math.min(s.vpH - slackY * 0.5, Math.max(slackY - s.docH * s.zoom, y)),
  }
}

export const useUi = create<UiState>((set, get) => ({
  tool: 'select',
  selection: [],
  selectedBandId: null,
  editingTextId: null,
  zoom: 0.5,
  panX: 0,
  panY: 0,
  snapEnabled: true,
  snapLines: [],
  leftTab: 'layers',
  previewMode: false,
  cropTargetId: null,
  marquee: null,
  sizes: {},
  spaceHeld: false,
  vpW: 0,
  vpH: 0,
  docW: 0,
  docH: 0,

  setViewportSize: (vpW, vpH) => set({ vpW, vpH }),
  setDocSize: (docW, docH) => set({ docW, docH }),
  setTool: tool => set({ tool, editingTextId: null }),
  select: (ids, additive) => {
    if (additive) {
      const cur = new Set(get().selection)
      for (const id of ids) cur.has(id) ? cur.delete(id) : cur.add(id)
      set({ selection: [...cur], selectedBandId: null })
    } else {
      set({ selection: ids, selectedBandId: ids.length ? null : get().selectedBandId })
    }
  },
  selectBand: id => set({ selectedBandId: id, selection: [], editingTextId: null }),
  clearSelection: () => set({ selection: [], selectedBandId: null, editingTextId: null }),
  setEditingText: id => set({ editingTextId: id }),
  setZoom: (z, cx, cy) => {
    const s = get()
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
    if (cx !== undefined && cy !== undefined) {
      // keep the point under the cursor fixed
      const p = clampPan(
        cx - ((cx - s.panX) / s.zoom) * nz,
        cy - ((cy - s.panY) / s.zoom) * nz,
        { ...s, zoom: nz },
      )
      set({ zoom: nz, panX: p.x, panY: p.y })
    } else {
      const p = clampPan(s.panX, s.panY, { ...s, zoom: nz })
      set({ zoom: nz, panX: p.x, panY: p.y })
    }
  },
  setPan: (x, y) => {
    const p = clampPan(x, y, get())
    set({ panX: p.x, panY: p.y })
  },
  setSnapLines: snapLines => set({ snapLines }),
  toggleSnap: () => set(s => ({ snapEnabled: !s.snapEnabled })),
  setLeftTab: leftTab => set({ leftTab }),
  setPreview: previewMode => set({ previewMode }),
  setCropTarget: cropTargetId => set({ cropTargetId }),
  setMarquee: marquee => set({ marquee }),
  reportSize: (id, w, h) => {
    const cur = get().sizes[id]
    if (cur && Math.abs(cur.w - w) < 0.5 && Math.abs(cur.h - h) < 0.5) return
    set(s => ({ sizes: { ...s.sizes, [id]: { w, h } } }))
  },
  setSpaceHeld: spaceHeld => set({ spaceHeld }),
}))
