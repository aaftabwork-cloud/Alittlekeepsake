import { useDoc, bandAtY } from '../store/doc'
import { useUi } from '../store/ui'
import { DEFAULT_ADJUST, ImgObj, uid } from '../types'

/** MIME type used to drag an asset from the panel onto the canvas. */
export const ASSET_DRAG_MIME = 'application/x-invite-asset'

/** Place an image object on the canvas. `at` = doc coords of the drop/center
 *  point; when omitted the viewport centre is used (click-to-place). */
export function placeImageAt(url: string, name: string, at?: { x: number; y: number }) {
  const img = new Image()
  img.onload = () => {
    const docState = useDoc.getState()
    const doc = docState.doc
    if (!doc) return
    const { zoom, panX, panY, vpW, vpH } = useUi.getState()
    const cx = at ? at.x : ((vpW || window.innerWidth) / 2 - panX) / zoom
    const cy = at ? at.y : ((vpH || window.innerHeight) / 2 - panY) / zoom
    const maxW = doc.width * 0.6
    const w = Math.min(img.naturalWidth, maxW)
    const h = w * (img.naturalHeight / img.naturalWidth)
    const obj: ImgObj = {
      id: uid(), type: 'img', src: url,
      x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h),
      opacity: 1, blend: 'source-over', band: bandAtY(doc.bands, cy), angle: 0,
      flipX: false, flipY: false, name, locked: false, hidden: false,
      custom: true, field: '', motion: 'static', anim: '', dur: 0, motionOpts: {},
      crop: null, shadow: null,
      adjust: { ...DEFAULT_ADJUST },
    }
    docState.addObject(obj)
    useUi.getState().select([obj.id])
  }
  img.src = url
}
