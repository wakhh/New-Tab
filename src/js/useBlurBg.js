import { computed } from 'vue'
import { videoPaused, musicPaused, displayOptimize } from './usePersist'
import { containerW, containerH, displayMode } from './useVisualState'
import { imgType, videoOn, mediaVisualOn, mediaVisualItem } from './useSourceState'
import { currentWallpaper } from './useThemeWallpaper'
import { mediaUrl } from '../utils/media'
import { videoEl, visualItemW, visualItemH, videoSnapshots } from './useVideoElement'
import { musicEl } from './useAudioElement'
import { everZoomed, imgNatural } from './useImageZoom'

let cacheCanvas = null

export function getBlurBgCache(sourceEl, srcW, srcH, cssW, cssH, dpr) {
  if (!cacheCanvas) cacheCanvas = document.createElement('canvas')
  const targetW = Math.round(cssW * dpr)
  const targetH = Math.round(cssH * dpr)
  if (cacheCanvas.width !== targetW) cacheCanvas.width = targetW
  if (cacheCanvas.height !== targetH) cacheCanvas.height = targetH

  const bctx = cacheCanvas.getContext('2d')
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  bctx.clearRect(0, 0, cssW, cssH)
  bctx.filter = 'blur(24px)'
  if (srcW && srcH) {
    const scale = Math.max(cssW / srcW, cssH / srcH)
    const dw = srcW * scale
    const dh = srcH * scale
    bctx.drawImage(sourceEl, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh)
  } else {
    bctx.drawImage(sourceEl, 0, 0, cssW, cssH)
  }
  bctx.filter = 'none'
  return cacheCanvas
}

export function resetBlurBgCache() {
  cacheCanvas = null
}

let vfcActive = false
let blurLoopId = 0
export function startVideoBlurLoop(videoEl, tickFn) {
  stopVideoBlurLoop()
  vfcActive = true
  const rVFC = videoEl && typeof videoEl.requestVideoFrameCallback === 'function'
  if (rVFC) {
    const schedule = () => {
      if (!vfcActive) return
      if (document.hidden) { return }
      videoEl.requestVideoFrameCallback(() => {
        if (!vfcActive) return
        tickFn()
        schedule()
      })
    }
    schedule()
  } else {
    const raf = () => {
      if (!vfcActive) { blurLoopId = 0; return }
      if (document.hidden) { blurLoopId = 0; return }
      tickFn()
      blurLoopId = requestAnimationFrame(raf)
    }
    blurLoopId = requestAnimationFrame(raf)
  }
}

export function stopVideoBlurLoop() {
  vfcActive = false
  if (blurLoopId) { cancelAnimationFrame(blurLoopId); blurLoopId = 0 }
}

function _canSkipBlur() {
  let lw = visualItemW.value
  let lh = visualItemH.value
  if (!lw || !lh) {
    if (imgType.value === 'media' || imgType.value === 'wallpaper') {
      lw = imgNatural.value.w
      lh = imgNatural.value.h
    }
  }
  const cw = containerW.value
  const ch = containerH.value
  if (!lw || !lh || !cw || !ch) return false
  if (displayMode.value === 'fit') {
    return Math.abs(lw / lh - cw / ch) < 1e-4
  }
  if (displayMode.value === 'center') {
    return lw >= cw && lh >= ch
  }
  return false
}

function getShowBlur() {
  if (!displayOptimize.value) return false
  const m = displayMode.value
  const scaled = everZoomed.value && m !== 'tile'

  if (mediaVisualOn.value) {
    if (videoOn.value) {
      if (m !== 'fit' && m !== 'center') return false
      if (_canSkipBlur()) return false
      return !!(videoSnapshots.value.media || videoSnapshots.value.media_url)
    }
  } else if (currentWallpaper.value?.isVideo) {
    if (m !== 'fit' && m !== 'center') return false
    if (_canSkipBlur()) return false
    return !!videoSnapshots.value.wallpaper
  }

  if (!scaled) {
    if (m !== 'fit' && m !== 'center') return false
    if (_canSkipBlur()) return false
  }

  if (mediaVisualOn.value) {
    return (imgNatural.value.w > 0 && imgNatural.value.h > 0) || (visualItemW.value > 0 || visualItemH.value > 0)
  }
  return currentWallpaper.value && ((imgNatural.value.w > 0 && imgNatural.value.h > 0) || (visualItemW.value > 0 || visualItemH.value > 0))
}

export const showDynamicBlur = computed(() => {
  if (!displayOptimize.value) return false
  const m = displayMode.value
  if (m !== 'fit' && m !== 'center') return false
  if (_canSkipBlur()) return false
  if (mediaVisualOn.value) return videoOn.value
  return !!currentWallpaper.value?.isVideo
})

export function getBlurSrc() {
  if (!getShowBlur()) return ''
  if (mediaVisualOn.value) {
    if (videoOn.value) return videoSnapshots.value.media || videoSnapshots.value.media_url
    return (imgType.value === 'media') ? mediaUrl(mediaVisualItem.value) : ''
  }
  return currentWallpaper.value?.isVideo ? videoSnapshots.value.wallpaper : currentWallpaper.value?.url || ''
}

let _fitBlurRunning = false

export function startFitBlurLoop(canvas) {
  if (!canvas) return
  _fitBlurRunning = true
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cssW = Math.round(containerW.value)
  const cssH = Math.round(containerH.value)
  if (canvas.width !== cssW * dpr) canvas.width = cssW * dpr
  if (canvas.height !== cssH * dpr) canvas.height = cssH * dpr
  startVideoBlurLoop(videoEl.value, () => {
    if (!_fitBlurRunning) return
    if (!showDynamicBlur.value) return
    const w = Math.round(containerW.value)
    const h = Math.round(containerH.value)
    const d = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas.width !== w * d) canvas.width = w * d
    if (canvas.height !== h * d) canvas.height = h * d
    const blur = getBlurBgCache(videoEl.value, visualItemW.value, visualItemH.value, w, h, d)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(blur, 0, 0)
  })
}

export function stopFitBlurLoop() {
  _fitBlurRunning = false
  stopVideoBlurLoop()
}

export function onVisChange(tileOnVisChange, tileCanvasRef) {
  tileOnVisChange(tileCanvasRef)
  if (document.hidden) {
    stopFitBlurLoop()
    return
  }
  setTimeout(() => {
    const vEl = videoEl.value
    if (vEl && !videoPaused.value && vEl.paused && !vEl.ended) vEl.play()?.catch(() => {})
    const mEl = musicEl.value
    if (mEl && !musicPaused.value && mEl.paused && !mEl.ended) mEl.play()?.catch(() => {})
  }, 300)
}