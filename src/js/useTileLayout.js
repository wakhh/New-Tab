import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { videoType } from './useSourceState.js'
import { displayMode,desktopAlign } from './useVisualState'
import { videoEl } from './useVideoElement'
import { containerW, containerH } from './useVisualState'
import { visualItemW, visualItemH } from './useVideoElement'
import { getBlurBgCache } from './useBlurBg.js'

export const tileVideoCount = ref(3)

export const videoTileMode = computed(() => {
  return (videoType.value === 'media' || videoType.value === 'wallpaper') && displayMode.value === 'tile'
})
export const videoTileCount = computed(() => {
  if (!videoTileMode.value) return 1
  return tileVideoCount.value
})

export const videoTileArea = computed(() => ({
  w: containerW.value,
  h: containerH.value
}))

export const videoTileScaled = computed(() => {
  const lw = visualItemW.value
  const lh = visualItemH.value
  const area = videoTileArea.value
  if (!lw || !lh || !area.w || !area.h) return null
  const vR = lw / lh
  const aR = area.w / area.h
  let scaledW, scaledH, top
  if (Math.abs(vR - aR) < 1e-4) {
    scaledW = area.w
    scaledH = area.h
    top = 0
  } else if (vR > aR) {
    scaledW = area.w
    scaledH = scaledW / vR
    top = Math.round((area.h - scaledH) / 2)
  } else {
    scaledH = area.h
    scaledW = scaledH * vR
    top = 0
  }
  return { scaledW, scaledH, top, videoRatio: vR, areaRatio: aR }
})

export const videoTileMax = computed(() => {
  const s = videoTileScaled.value
  if (!s) return 1
  const area = videoTileArea.value
  if (!s.scaledW) return 1
  if (s.videoRatio >= s.areaRatio) return 1
  const exact = area.w / s.scaledW
  const floorVal = Math.floor(exact)
  if (floorVal === 2 && exact - floorVal >= 0.4) return Math.min(9, 3)
  return Math.min(9, floorVal)
})

export const videoTileLayout = computed(() => {
  const s = videoTileScaled.value
  if (!s) return null
  const area = videoTileArea.value
  const count = videoTileCount.value
  const maxN = videoTileMax.value
  const atMax = count >= maxN
  const fullyFills = s.scaledW * count >= area.w - 1
  const startX = (area.w - s.scaledW * count) / 2
  const videoIdx = Math.floor((count - 1) / 2)
  return { ...s, count, startX, atMax, fullyFills, videoIdx, maxN }
})

export const videoTileStyle = computed(() => {
  if (!videoTileMode.value) return {}
  if (!visualItemW.value || !visualItemH.value) {
    return { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }
  }
  const base = {
    position: 'absolute',
    visibility: 'visible',
    pointerEvents: 'auto',
    objectFit: 'fill',
    zIndex: 2,
  }
  const l = videoTileLayout.value
  if (!l) return base
  const idx = l.videoIdx
  return {
    ...base,
    left: (l.startX + idx * l.scaledW) + 'px',
    top: l.top + 'px',
    width: l.scaledW + 'px',
    height: l.scaledH + 'px',
  }
})

export const tileCanvasStyle = computed(() => {
  const area = videoTileArea.value
  return {
    position: 'absolute',
    top: '0',
    left: '0',
    right: 'auto',
    bottom: 'auto',
    width: Math.round(area.w) + 'px',
    height: Math.round(area.h) + 'px',
  }
})

let tileRafId = 0

export function drawTileCanvas(tileCanvasRef) {
  const canvas = tileCanvasRef.value
  const el = videoEl.value
  if (!canvas || !el || !el.isConnected) return
  if (!videoTileMode.value) return

  const area = videoTileArea.value
  const layout = videoTileLayout.value
  if (!layout || !area.w || !area.h) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cssW = Math.round(area.w)
  const cssH = Math.round(area.h)
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr
    canvas.height = cssH * dpr
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  const needTopBg = layout.top > 0
  const totalW = layout.scaledW * layout.count
  const needSideBg = totalW < area.w - 0.5
  if (needTopBg || needSideBg) {
    const blurCanvas = getBlurBgCache(el, visualItemW.value, visualItemH.value, cssW, cssH, dpr)

    ctx.save()
    ctx.beginPath()
    if (needTopBg) {
      ctx.rect(0, 0, cssW, layout.top)
      ctx.rect(0, layout.top + layout.scaledH, cssW, cssH - layout.top - layout.scaledH)
    } else if (needSideBg) {
      const gapLeft = layout.startX
      const gapRight = cssW - layout.startX - totalW
      if (gapLeft > 0.5) ctx.rect(0, 0, gapLeft, cssH)
      if (gapRight > 0.5) ctx.rect(layout.startX + totalW, 0, gapRight, cssH)
    }
    ctx.clip('evenodd')
    ctx.drawImage(blurCanvas, 0, 0)
    ctx.restore()
  }

  for (let i = 0; i < layout.count; i++) {
    if (i === layout.videoIdx) continue
    try {
      ctx.drawImage(el, layout.startX + i * layout.scaledW, layout.top, layout.scaledW, layout.scaledH)
    } catch (e) {}
  }
}

export function startTileCanvas(tileCanvasRef) {
  stopTileCanvas()
  const tick = () => {
    if (!videoTileMode.value || document.hidden) {
      tileRafId = 0; return
    }
    drawTileCanvas(tileCanvasRef)
    tileRafId = requestAnimationFrame(tick)
  }
  tileRafId = requestAnimationFrame(tick)
}

export function stopTileCanvas() {
  if (tileRafId) { cancelAnimationFrame(tileRafId); tileRafId = 0 }
}

export function onVisChange(tileCanvasRef) {
  if (document.hidden) stopTileCanvas()
  else if (videoTileMode.value) startTileCanvas(tileCanvasRef)
}

export function setupTileCanvas(tileCanvasRef) {
  const cleanup = () => stopTileCanvas()

  const stop = watch(
    [videoTileMode, () => videoTileCount.value, () => desktopAlign.value, visualItemW, visualItemH, () => videoTileArea.value.w, () => videoTileArea.value.h],
    ([on]) => {
      if (on) {
        nextTick(() => {
          const canvas = tileCanvasRef.value
          if (canvas) {
            const area = videoTileArea.value
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            canvas.width = Math.round(area.w) * dpr
            canvas.height = Math.round(area.h) * dpr
          }
          startTileCanvas(tileCanvasRef)
        })
      } else {
        stopTileCanvas()
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(cleanup)
  return () => { stop(); cleanup() }
}