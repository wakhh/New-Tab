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