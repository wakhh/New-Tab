import { ref, computed } from 'vue'
import { containerW, containerH, displayMode } from './useVisualState'

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 8

export const scale = ref(1)
export const tx = ref(0)
export const ty = ref(0)
export const everZoomed = ref(false)

export const dragState = ref({ active: false, startX: 0, startY: 0, startTx: 0, startTy: 0 })

export const imgNatural = ref({ w: 0, h: 0 })

export const imgBaseRect = computed(() => {
  const cw = containerW.value, ch = containerH.value
  const iw = imgNatural.value.w, ih = imgNatural.value.h
  if (!iw || !ih || !cw || !ch) return { x: 0, y: 0, w: cw, h: ch }
  const mode = displayMode.value
  if (mode === 'stretch') return { x: 0, y: 0, w: cw, h: ch }
  if (mode === 'fit') {
    const s = Math.min(cw / iw, ch / ih)
    const w = iw * s, h = ih * s
    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
  }
  if (mode === 'fill') {
    const s = Math.max(cw / iw, ch / ih)
    const w = iw * s, h = ih * s
    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
  }
  if (mode === 'center') {
    return { x: (cw - iw) / 2, y: (ch - ih) / 2, w: iw, h: ih }
  }
  return { x: 0, y: 0, w: cw, h: ch }
})

export function resetZoom() {
  scale.value = 1
  tx.value = 0
  ty.value = 0
  everZoomed.value = false
}

export function zoomAt(mx, my, factor, baseX, baseY) {
  const old = scale.value
  const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, old * factor))
  if (next === old) return false
  scale.value = next
  everZoomed.value = true
  tx.value = mx - baseX - (mx - baseX - tx.value) * (next / old)
  ty.value = my - baseY - (my - baseY - ty.value) * (next / old)
  return true
}

export function startDrag(mx, my) {
  dragState.value = { active: true, startX: mx, startY: my, startTx: tx.value, startTy: ty.value }
}

export function moveDrag(mx, my) {
  const d = dragState.value
  if (!d.active) return
  everZoomed.value = true
  tx.value = d.startTx + (mx - d.startX)
  ty.value = d.startTy + (my - d.startY)
}

export function endDrag() {
  dragState.value.active = false
}