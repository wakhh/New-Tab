<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  mediaMusicMuted, mediaVideoMuted, wpVideoMuted,
  mediaVideoVolume, wpVideoVolume, mediaMusicVolume,
  videoLoop, videoPaused, musicPaused, mediaVisualSource,
  sourceStates, musicSource, mediaImgDuration, selectedSource,
  _desktopAlignImage, _desktopAlignVideo, displayOptimize,
  videoProgress, musicProgress
} from '../js/persist'
import {
  containerW, containerH, isPortrait, displayMode,
  desktopAlign, desktopAnchor, currentWallpaper, wpMediaInfo,
  videoEl, musicEl, visualItemW, visualItemH,
  videoPlaying, musicPlaying, videoElProgress, videoElDuration,
  musicElProgress, musicElDuration, showSeekIcon, showFloatIcon, showMainIcon,
  everZoomed, imgNatural,
  mediaVisualOn, mediaImgOn, videoType, imgType, videoOn, imageOn, musicOn, tileVideoCount,
  mediaVisualItem, musicItem,
  curVisualRotate,
  maxTileCount, defaultTileCount, tileDirUp, pickNextItem, navigate, playbackNav,
  getLoop, playbackToggle, playbackSeek,
  mediaUrl, sourceOf, itemId, sourceEquals, markErrored, markNoErrored
} from '../js/core'

// ====== 源载入 ======


const imgElRef = ref(null)
const layerEl = ref(null)
const canvasRef = ref(null)

const mediaImgTimer = ref(null)
const videoReady = ref(false)

const imgSrc = computed(() => {
  if (imgType.value === 'media') return mediaUrl(mediaVisualItem.value) || null
  if (imgType.value === 'wallpaper') return currentWallpaper.value.url || null
  return null
})

const musicElemLoop = computed(() => !getLoop(musicSource.value))

const videoSrc = computed(() => {
  const owner = videoType.value
  if (owner === 'media') return mediaUrl(mediaVisualItem.value) || null
  if (owner === 'wallpaper') return currentWallpaper.value.url || null
  return null
})
const videoMuted = computed(() => {
  const owner = videoType.value
  if (owner === 'media') return mediaVideoMuted.value
  if (owner === 'wallpaper') return wpVideoMuted.value
  return true
})
const videoElemLoop = computed(() => {
  const owner = videoType.value
  if (owner === 'wallpaper') return videoLoop.value
  return !getLoop(mediaVisualSource.value)
})

const videoFrameReady = ref(false)
const videoBottomGrace = ref(false)
let videoBottomGraceTimer = null
function startVideoBottomGrace() {
  if (videoBottomGraceTimer) clearTimeout(videoBottomGraceTimer)
  videoBottomGrace.value = true
  videoBottomGraceTimer = setTimeout(() => { videoBottomGrace.value = false; videoBottomGraceTimer = null }, 1000)
}
function stopVideoBottomGrace() {
  if (videoBottomGraceTimer) { clearTimeout(videoBottomGraceTimer); videoBottomGraceTimer = null }
  videoBottomGrace.value = false
}
const docHidden = ref(false)

// ====== 媒体事件回调 ======

function onMediaLoad(e) {
  const el = e?.target
  if (!el) return
  const rw = el.videoWidth || el.naturalWidth || 0
  const rh = el.videoHeight || el.naturalHeight || 0
  rawMediaW.value = rw; rawMediaH.value = rh
  let w = rw, h = rh
  const rot = curVisualRotate.value
  if (rot === 90 || rot === 270) { const t = w; w = h; h = t }
  visualItemW.value = w; visualItemH.value = h; wpMediaInfo.value = { w, h }
}

// ---- 播放结束 / 错误处理 ----

function _handleEnded(type, item) {
  if (!item) return
  const source = sourceOf(item)
  const target = pickNextItem(source, item, null)
  if (!target) return
  navigate(source, target)
}

function _handleError(type, item, event) {
  console.log(type,itemId(item), event?.target?.error)
  if (!item) return
  markErrored(item)
  showMainIcon('⚠', 1000, true)
  setTimeout(() => {
    if (type == "image" && !imageOn.value) return
    if (type == "music" && !musicOn.value) return
    if (type == "video" && !videoOn.value) return
    const source = sourceOf(item)
    const target = pickNextItem(source, item, null)
    if (!target) return
    navigate(source, target)
  }, 500)
}

function onVideoEndedLocal(e) {
  videoPlaying.value = false
  const el = e?.target || videoEl.value
  if (el && el.currentTime === 0 && (el.duration === 0 || el.readyState < 2)) return
  const owner = videoType.value
  if (owner === 'media') _handleEnded('video', mediaVisualItem.value)
}

function onVideoError() {
  videoPlaying.value = false
  if (!videoOn.value) return
  _handleError('video', mediaVisualItem.value, ...arguments)
}

function onVideoLoadedMetadata() {
  const el = videoEl.value
  if (!el) return
  videoElDuration.value = el.duration || 0
  const item = mediaVisualItem.item
  if (item) restoreVideoProgress(el, itemId(item.value))
}

function onVideoLoadedData(e) {
  videoReady.value = true
  videoFrameReady.value = true
  startVideoBottomGrace()
  onMediaLoad(e)
  _trySyncVideoPlay()
  if (videoOn.value && !hideVideoBg.value) startCanvasLoop()
}

function onVideoPlayState() {
  const el = videoEl.value
  if (el) videoPlaying.value = !el.paused
}

function onVideoVolumeChange() {
  const el = videoEl.value
  if (!el) return
  const owner = videoType.value
  if (owner === 'media') {
    mediaVideoVolume.value = Math.round(el.volume * 100)
    mediaVideoMuted.value = el.muted
  } else if (owner === 'wallpaper') {
    wpVideoVolume.value = Math.round(el.volume * 100)
    wpVideoMuted.value = el.muted
  }
}

function onImageError() {
  if (!imageOn.value) return
  _handleError('image', mediaVisualItem.value, ...arguments)
}

function onMusicEnded() {
  musicPlaying.value = false
  if (musicItem.value) _handleEnded('music', musicItem.value)
}

function onMusicError() {
  musicPlaying.value = false
  if (!musicOn.value) return
  _handleError('music', musicItem.value, ...arguments)
}

function onMusicLoadedMetadata() {
  const el = musicEl.value
  if (!el) return
  musicElDuration.value = el.duration || 0
  const item = musicItem.value
  if (item) restoreMusicProgress(el, itemId(item))
}

function onMusicLoadedDataAutoPlay() {
  const el = musicEl.value
  if (el && !musicPaused.value) el.play()?.catch(() => {})
}

function onMusicCanPlayAutoPlay() {
  const el = musicEl.value
  if (el && !musicPaused.value && el.paused) el.play()?.catch(() => {})
}

function onMusicPlayState() {
  const el = musicEl.value
  if (el) musicPlaying.value = !el.paused
}

function onMusicVolumeChange() {
  const el = musicEl.value
  if (!el) return
  mediaMusicVolume.value = Math.round(el.volume * 100)
  mediaMusicMuted.value = el.muted
}

// ====== 进度读写 ======
let _lastVideoSaveAt = 0, _lastMusicSaveAt = 0
function getVideoProgress(key) { if (!key) return 0; return videoProgress.value?.key === key ? (videoProgress.value.time || 0) : 0 }
function getMusicProgress(key) { if (!key) return 0; return musicProgress.value?.key === key ? (musicProgress.value.time || 0) : 0 }
function clearVideoProgress() { videoProgress.set(null) }
function clearMusicProgress() { musicProgress.set(null) }
function saveVideoProgress() {
  const el = videoEl.value
  if (!el) return
  if (!el.src) return
  const t = el.currentTime || 0, d = el.duration || 0
  videoElProgress.value = t
  const item = mediaVisualItem.value
  if (!item || !d || d < 90 || t < 30 || (d - t) < 30) return
  if (Date.now() - _lastVideoSaveAt < 1000) return
  _lastVideoSaveAt = Date.now()
  videoProgress.set({ key: itemId(item), time: t })
}
function saveMusicProgress() {
  const el = musicEl.value
  if (!el) return
  if (!el.src) return
  const t = el.currentTime || 0, d = el.duration || 0
  musicElProgress.value = t
  const item = musicItem.value
  if (!item || !d || d < 90 || t < 30 || (d - t) < 30) return
  if (Date.now() - _lastMusicSaveAt < 1000) return
  _lastMusicSaveAt = Date.now()
  musicProgress.set({ key: itemId(item), time: t })
}
function restoreVideoProgress(el, key) { if (!el || !key) return; const t = getVideoProgress(key); if (t > 0) el.currentTime = t }
function restoreMusicProgress(el, key) { if (!el || !key) return; const t = getMusicProgress(key); if (t > 0) el.currentTime = t }

// ====== 图片缩放拖拽 ======
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)

// ====== 图片模糊背景 ====== 

const showImageBg = computed(() => {
  if (!displayOptimize.value || videoOn.value || !imageOn.value) return false
  if (!everZoomed.value && displayMode.value !== 'fit' && displayMode.value !== 'center') return false
  return imgNatural.value.w > 0 || visualItemW.value > 0
})

const imageBgSrc = computed(() => {
  if (!showImageBg.value) return ''
  if (mediaVisualOn.value) return mediaUrl(mediaVisualItem.value)
  return currentWallpaper.value?.url || ''
})

// ====== 视频平铺布局 ======

const videoTileMode = computed(() => {
  return (videoType.value === 'media' || videoType.value === 'wallpaper') && displayMode.value === 'tile'
})

const videoTileLayout = computed(() => {
  const lw = visualItemW.value
  const lh = visualItemH.value
  const aw = containerW.value
  const ah = containerH.value
  if (!lw || !lh || !aw || !ah) return null
  const vR = lw / lh
  const aR = aw / ah
  let scaledW, scaledH, top
  if (Math.abs(vR - aR) < 1e-4) {
    scaledW = aw
    scaledH = ah
    top = 0
  } else if (vR > aR) {
    scaledW = aw
    scaledH = scaledW / vR
    top = Math.round((ah - scaledH) / 2)
  } else {
    scaledH = ah
    scaledW = scaledH * vR
    top = 0
  }
  const count = videoTileMode.value ? tileVideoCount.value : 1
  const maxN = maxTileCount.value
  const fullyFills = scaledW * count >= aw - 1
  const startX = (aw - scaledW * count) / 2
  const videoIdx = Math.floor((count - 1) / 2)
  return { scaledW, scaledH, top, count, startX, fullyFills, videoIdx, maxN }
})

const hideVideoBg = computed(() => {
  if (imageOn.value || !videoOn.value) return true
  const mode = displayMode.value
  if (mode === 'fill' || mode === 'stretch') return true
  const cw = containerW.value
  const ch = containerH.value
  if (!cw || !ch) return true
  if (!videoOnTop.value) return false
  if (videoTileMode.value) {
    const layout = videoTileLayout.value
    if (!layout) return false
    if (layout.count > 1) return false
    if (!displayOptimize.value) return true
    if (!layout.fullyFills) return false
    return true
  }
  if (!displayOptimize.value) return true
  const lw = visualItemW.value
  const lh = visualItemH.value
  if (!lw || !lh) return false
  if (mode === 'fit') {
    return Math.abs(lw / lh - cw / ch) < 1e-4
  }
  if (mode === 'center') {
    return lw >= cw && lh >= ch
  }
  return true
})

const videoBaseRect = computed(() => {
  const cw = containerW.value, ch = containerH.value
  const el = videoEl.value
  const vw = visualItemW.value || el?.videoWidth || 0
  const vh = visualItemH.value || el?.videoHeight || 0
  if (!cw || !ch || !vw || !vh) return { x: 0, y: 0, w: 0, h: 0 }
  const mode = displayMode.value
  if (mode === 'stretch') return { x: 0, y: 0, w: cw, h: ch }
  if (mode === 'fit') {
    const s = Math.min(cw / vw, ch / vh)
    const w = vw * s, h = vh * s
    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
  }
  if (mode === 'fill') {
    const s = Math.max(cw / vw, ch / vh)
    const w = vw * s, h = vh * s
    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
  }
  if (mode === 'center') {
    return { x: (cw - vw) / 2, y: (ch - vh) / 2, w: vw, h: vh }
  }
  return { x: 0, y: 0, w: cw, h: ch }
})

const videoStyle = computed(() => {
  const vZ = videoOnTop.value ? 2 : 0
  const pos = { position: 'absolute', objectFit: 'fill', zIndex: vZ }
  const r = curVisualRotate.value
  const needSwap = r === 90 || r === 270
  const rot = r ? { transform: `rotate(${-r}deg)`, transformOrigin: 'center' } : {}
  if (videoTileMode.value) {
    const l = videoTileLayout.value
    if (!l) return { ...pos, width: '0px', height: '0px', pointerEvents: 'none', ...rot }
    const idx = l.videoIdx
    const tw = needSwap ? l.scaledH : l.scaledW
    const th = needSwap ? l.scaledW : l.scaledH
    let left = l.startX + idx * l.scaledW
    let top = l.top
    if (needSwap) {
      left = l.startX + idx * l.scaledW + (l.scaledW - l.scaledH) / 2
      top = l.top + (l.scaledH - l.scaledW) / 2
    }
    return {
      ...pos,
      left: Math.round(left) + 'px',
      top: Math.round(top) + 'px',
      width: Math.round(tw) + 'px',
      height: Math.round(th) + 'px',
      pointerEvents: 'none',
      ...rot
    }
  }
  const rb = videoBaseRect.value
  let vw = rb.w, vh = rb.h
  let vl = rb.x, vt = rb.y
  if (needSwap && rb.w && rb.h) {
    vw = rb.h
    vh = rb.w
    vl = rb.x + (rb.w - vw) / 2
    vt = rb.y + (rb.h - vh) / 2
  }
  return {
    ...pos,
    left: Math.round(vl) + 'px',
    top: Math.round(vt) + 'px',
    width: Math.round(vw) + 'px',
    height: Math.round(vh) + 'px',
    pointerEvents: 'none',
    ...rot
  }
})

function onVisChange() {
  docHidden.value = document.hidden
  if (document.hidden) {
    videoFrameReady.value = false
    stopVideoBottomGrace()
    stopCanvasLoop()
    return
  }
  startVideoBottomGrace()
  const mEl = musicEl.value
  if (mEl && !musicPaused.value && !mEl.ended) mEl.play()?.catch(() => {})
  const vEl = videoEl.value
  if (videoOn.value && vEl && !videoPaused.value && !vEl.ended) vEl.play()?.catch(() => {})
  if (videoOn.value && !hideVideoBg.value) startCanvasLoop()
}


const videoOnTop = computed(() => {
  if (!videoOn.value) return true
  if (videoBottomGrace.value) return false
  if (!videoFrameReady.value) return false
  const dur = videoElDuration.value
  if (!dur || dur <= 2) return false
  const cur = videoElProgress.value
  if (!cur) return false
  return cur > 1 && (dur - cur) > 1
})

const canvasStyle = computed(() => {
  const cZ = videoOnTop.value ? 0 : 2
  return {
    width: Math.round(containerW.value) + 'px',
    height: Math.round(containerH.value) + 'px',
    zIndex: cZ,
  }
})

let canvasRafId = 0

function drawImageRotated(ctx, el, dx, dy, dw, dh, angleDeg) {
  if (!angleDeg) { ctx.drawImage(el, dx, dy, dw, dh); return }
  ctx.save()
  ctx.translate(dx + dw / 2, dy + dh / 2)
  ctx.rotate(angleDeg * Math.PI / 180)
  ctx.drawImage(el, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
}

function drawCanvas(forceIncludeVideo = false) {
  const canvas = canvasRef.value
  if (!canvas || hideVideoBg.value) return
  const el = videoEl.value
  const cssW = Math.round(containerW.value)
  const cssH = Math.round(containerH.value)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr
    canvas.height = cssH * dpr
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const srcW = visualItemW.value || el.videoWidth || 0
  const srcH = visualItemH.value || el.videoHeight || 0

  const drawIncludeVideo = videoOn.value && !videoOnTop.value

  const tiles = []
  if (videoTileMode.value) {
    const layout = videoTileLayout.value
    if (layout) {
      const lx = layout.startX
      for (let i = 0; i < layout.count; i++) {
        tiles.push({
          x: Math.round(lx + i * layout.scaledW),
          y: Math.round(layout.top),
          w: Math.round(layout.scaledW),
          h: Math.round(layout.scaledH),
          isVideo: i === layout.videoIdx,
        })
      }
    }
  } else if (srcW && srcH) {
    const r = videoBaseRect.value
    tiles.push({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h), isVideo: true })
  }

  if (!tiles.length) return

  ctx.clearRect(0, 0, cssW, cssH)

  const hasGap = displayOptimize.value && (tiles[0].x > 0 || tiles[0].y > 0 || tiles[tiles.length - 1].x + tiles[tiles.length - 1].w < cssW || tiles[tiles.length - 1].y + tiles[tiles.length - 1].h < cssH)

  if (hasGap) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, cssW, cssH)
    for (const t of tiles) {
      ctx.rect(t.x, t.y, t.w, t.h)
    }
    ctx.clip('evenodd')
    drawBlurOnCtx(ctx, el, cssW, cssH)
    ctx.restore()
  }

  const needSwap = curVisualRotate.value === 90 || curVisualRotate.value === 270
  for (const t of tiles) {
    if (t.isVideo && videoOnTop.value && !forceIncludeVideo) continue
    let dx = t.x, dy = t.y, dw = t.w, dh = t.h
    if (needSwap && t.w && t.h) {
      dw = t.h; dh = t.w
      dx = t.x + (t.w - dw) / 2
      dy = t.y + (t.h - dh) / 2
    }
    try {
      drawImageRotated(ctx, el, dx, dy, dw, dh, -curVisualRotate.value)
    } catch (e) { }
  }
}

function drawBlurOnCtx(ctx, el, cssW, cssH) {
  ctx.save()
  ctx.filter = 'blur(16px)'
  const rot = -curVisualRotate.value
  const needSwap = rot === 90 || rot === 270 || rot === -90 || rot === -270
  const sW = needSwap ? cssH : cssW
  const sH = needSwap ? cssW : cssH
  const rw = el.videoWidth || el.naturalWidth || 0
  const rh = el.videoHeight || el.naturalHeight || 0
  if (rw && rh) {
    const s = Math.max(sW / rw, sH / rh)
    const dw = rw * s
    const dh = rh * s
    drawImageRotated(ctx, el, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh, rot)
  } else {
    drawImageRotated(ctx, el, 0, 0, cssW, cssH, rot)
  }
  ctx.restore()
}

function startCanvasLoop() {
  stopCanvasLoop()
  drawCanvas()
  const tick = () => {
    if (hideVideoBg.value) { canvasRafId = 0; return }
    if (docHidden.value || !videoPlaying.value) { canvasRafId = 0; return }
    drawCanvas()
    canvasRafId = requestAnimationFrame(tick)
  }
  canvasRafId = requestAnimationFrame(tick)
}

function stopCanvasLoop() {
  if (canvasRafId) { cancelAnimationFrame(canvasRafId); canvasRafId = 0 }
}

watch([videoOn, hideVideoBg], ([on, hide]) => {
  if (on && !hide) startCanvasLoop()
  else stopCanvasLoop()
}, { immediate: true })

watch(videoPlaying, (playing) => {
  if (playing && videoOn.value && !hideVideoBg.value && !canvasRafId) startCanvasLoop()
})

// ====== 图片缩放拖拽 ======
const ZOOM_MAX = computed(() => {
  const cw = containerW.value, ch = containerH.value
  const r = imgBaseRect.value
  if (!cw || !ch || !r.w || !r.h) return 20
  return Math.max(cw / r.w, ch / r.h) * 20
})
const ZOOM_MIN = computed(() => {
  const cw = containerW.value, ch = containerH.value
  const r = imgBaseRect.value
  if (!cw || !ch || !r.w || !r.h) return 0.05
  return Math.min(cw / (20 * r.w), ch / (20 * r.h))
})
const dragState = ref({ active: false, startX: 0, startY: 0, startTx: 0, startTy: 0 })

const imgBaseRect = computed(() => {
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

function resetZoom() { scale.value = 1; tx.value = 0; ty.value = 0; everZoomed.value = false }
function zoomAt(mx, my, factor, baseX, baseY) {
  const old = scale.value
  const next = Math.max(ZOOM_MIN.value, Math.min(ZOOM_MAX.value, old * factor))
  if (next === old) return false
  scale.value = next
  everZoomed.value = true
  tx.value = mx - baseX - (mx - baseX - tx.value) * (next / old)
  ty.value = my - baseY - (my - baseY - ty.value) * (next / old)
  return true
}
function startDrag(mx, my) {
  dragState.value = { active: true, startX: mx, startY: my, startTx: tx.value, startTy: ty.value }
}
function moveDrag(mx, my) {
  const d = dragState.value
  if (!d.active) return
  everZoomed.value = true
  tx.value = d.startTx + (mx - d.startX)
  ty.value = d.startTy + (my - d.startY)
}
function endDrag() { dragState.value.active = false }

const imgZoomWrapStyle = computed(() => {
  const isimgType = imgType.value === 'media' || imgType.value === 'wallpaper'
  if (!isimgType) return ''
  const r = imgBaseRect.value
  return {
    position: 'absolute',
    left: r.x + 'px',
    top: r.y + 'px',
    width: r.w + 'px',
    height: r.h + 'px',
    transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`,
    transformOrigin: '0 0'
  }
})

const imgRotateStyle = computed(() => {
  const r = curVisualRotate.value
  if (!r) return {}
  const needSwap = r === 90 || r === 270
  const rect = imgBaseRect.value
  const base = { 
    transform: `rotate(${-r}deg)`, 
    transformOrigin: 'center',
    inset: 'auto'
  }
  if (needSwap && rect.w && rect.h) {
    base.width = rect.h + 'px'
    base.height = rect.w + 'px'
    base.left = ((rect.w - rect.h) / 2) + 'px'
    base.top = ((rect.h - rect.w) / 2) + 'px'
  }
  return base
})

const blurBgStyle = computed(() => {
  const r = curVisualRotate.value
  if (!r) return {}
  const cw = containerW.value, ch = containerH.value
  const needSwap = r === 90 || r === 270
  return { 
    width: (needSwap ? ch : cw) * 1.15 + 'px',
    height: (needSwap ? cw : ch) * 1.15 + 'px',
    transform: `translate(-50%, -50%) rotate(${-r}deg)`
  }
})

function handleLayerWheel(e) {
  if (interactHandleLayerWheel(e) === true) onLayerWheel(e)
}

// ====== 全局事件拦截 ======

const _UI_SELECTORS = ['.icon-cell', '.ctx-menu', '.dialog-overlay', '.ui-widget', '.float-icon']
function _isUiTarget(t) {
  if (!t || typeof t.closest !== 'function') return false
  return _UI_SELECTORS.some((s) => t.closest(s))
}

function _windowWheelCapture(e) {
  if (e.ctrlKey) {
    e.preventDefault()
    if (_isUiTarget(e.target)) return
    const layer = layerEl.value
    if (!layer) return
    if (interactHandleLayerWheel(e, layer) === true) onLayerWheel(e)
    return
  }
  if (_isUiTarget(e.target)) return
  const layer = layerEl.value
  if (!layer) return
  if (interactHandleLayerWheel(e, layer) === true) onLayerWheel(e)
}

function _windowMouseDownCapture(e) {
  if (e.button !== 0) return
  if (_isUiTarget(e.target)) return
  const layer = layerEl.value
  if (!layer) return
  onLayerMouseDown(e, layer)
}

function onLayerClick(e) { interactOnLayerClick(e) }

function onImgLoad() {
  const el = imgElRef.value
  if (!el) return
  const rw = el.naturalWidth
  const rh = el.naturalHeight
  rawMediaW.value = rw; rawMediaH.value = rh
  let w = rw, h = rh
  const rot = curVisualRotate.value
  if (rot === 90 || rot === 270) { const t = w; w = h; h = t }
  imgNatural.value = { w, h }
  if (mediaVisualOn.value && imageOn.value) {
    visualItemW.value = w
    visualItemH.value = h
  } else if (imgType.value === 'wallpaper') {
    wpMediaInfo.value = { w, h }
  }
}

// ====== 图片背景平铺 ======

const tileSrc = ref('')

const tileLayerStyle = computed(() => {
  const src = tileSrc.value
  if (!src) return {}
  const useContain = displayOptimize.value
  let bgSize = 'auto'
  if (useContain) {
    const iw = imgNatural.value.w
    const ih = imgNatural.value.h
    const cw = containerW.value
    const ch = containerH.value
    if (iw && ih && cw && ch) {
      const scale = Math.min(cw / iw, ch / ih)
      bgSize = `${Math.round(iw * scale)}px ${Math.round(ih * scale)}px`
    }
  }
  const rot = curVisualRotate.value
  const base = {
    backgroundImage: `url(${src})`,
    backgroundRepeat: 'repeat',
    backgroundPosition: useContain ? 'center' : '0 0',
    backgroundSize: bgSize
  }
  if (!rot) return base
  const cw = containerW.value, ch = containerH.value
  const size = Math.max(cw, ch)
  return {
    ...base,
    left: `${(cw - size) / 2}px`,
    top: `${(ch - size) / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    transform: `rotate(${-rot}deg)`,
    transformOrigin: 'center center'
  }
})

watch(
  () => {
    if (mediaVisualOn.value) {
      return imageOn.value && displayMode.value === 'tile' ? mediaUrl(mediaVisualItem.value) : ''
    }
    const c = currentWallpaper.value
    return c && !c.isVideo && displayMode.value === 'tile' ? c.url : ''
  },
  (url) => { tileSrc.value = url || '' },
  { immediate: true }
)

watch(desktopAlign, () => {
  tileSrc.value = tileSrc.value ? tileSrc.value + ' ' : tileSrc.value
  tileSrc.value = tileSrc.value.trim()
})

// ====== 桌面对齐层 ======

const LAYER_OFF_X = 3.5
const LAYER_OFF_Y = 5.5

const layerStyle = computed(() => {
  if (!desktopAlign.value) return {}
  const w = containerW.value
  const h = containerH.value
  const ox = -LAYER_OFF_X + 'px'
  const oy = -LAYER_OFF_Y + 'px'
  const area = { inset: 'auto', width: `${w}px`, height: `${h}px` }
  switch (desktopAnchor.value) {
    case 'lb': return { ...area, left: ox, bottom: oy }
    case 'lt': return { ...area, left: ox, top: oy }
    case 'rt': return { ...area, right: ox, top: oy }
    default: return { ...area, right: ox, bottom: oy }
  }
})

// ====== 视频同步 ======

function _applyVideoProps(el, owner) {
  if (owner === 'media') {
    el.volume = mediaVideoVolume.value / 100
    el.muted = mediaVideoMuted.value
    el.loop = !getLoop(mediaVisualSource.value)
  } else if (owner === 'wallpaper') {
    el.volume = wpVideoVolume.value / 100
    el.muted = wpVideoMuted.value
    el.loop = videoLoop.value
  }
}

function _trySyncVideoPlay() {
  const el = videoEl.value
  if (!el) return
  const wantPlay = !videoPaused.value
  if (wantPlay) {
    if (el.paused) el.play()?.catch(() => {})
    videoPlaying.value = true
  } else {
    if (!el.paused) el.pause()
    videoPlaying.value = false
  }
}

function _loadVisualVideo(item) {
  if (!item || item.type !== 'video') return
  stopMediaImgTimer()
  const el = videoEl.value
  const url = mediaUrl(item)
  const sameEl = el && el.src && (el.src === url || el.src.endsWith(url))
  if (!sameEl) {
    videoElProgress.value = 0
    videoElDuration.value = 0
  }
  if (!el) return
  el.loop = !getLoop(mediaVisualSource.value)
}

// ====== 视频同步 watch ======

watch(videoSrc, () => {
  videoReady.value = false
  videoFrameReady.value = false
  startVideoBottomGrace()
  stopCanvasLoop()
  drawCanvas(true)
})

watch(videoType, (owner, prevOwner) => {
  if (!owner) return
  nextTick(() => {
    const curEl = videoEl.value
    if (!curEl) return
    const rw = curEl.videoWidth || curEl.naturalWidth || 0
    const rh = curEl.videoHeight || curEl.naturalHeight || 0
    rawMediaW.value = rw; rawMediaH.value = rh
    let w = rw, h = rh
    const rot = curVisualRotate.value
    if (rot === 90 || rot === 270) { const t = w; w = h; h = t }
    _applyVideoProps(curEl, owner)
    if (owner === 'media') {
      videoElDuration.value = curEl.duration || 0
      if (w && h) visualItemW.value = w; visualItemH.value = h
    } else {
      if (w && h) { visualItemW.value = w; visualItemH.value = h; wpMediaInfo.value = { w, h } }
    }
    _trySyncVideoPlay()
  })
}, { immediate: true })

watch([mediaVideoVolume, mediaVideoMuted, wpVideoVolume, wpVideoMuted, videoLoop], () => {
  const el = videoEl.value
  if (!el) return
  const owner = videoType.value
  if (owner === 'media') {
    el.volume = mediaVideoVolume.value / 100
    el.muted = mediaVideoMuted.value
    el.loop = !getLoop(mediaVisualSource.value)
  } else if (owner === 'wallpaper') {
    el.volume = wpVideoVolume.value / 100
    el.muted = wpVideoMuted.value
    el.loop = videoLoop.value
  }
})

watch(videoPaused, (paused) => {
  const el = videoEl.value
  if (!el || !videoType.value) return
  if (paused) el.pause()
  else el.play()?.catch(() => {})
})

watch(
  () => currentWallpaper.value?.url,
  () => {
    if (currentWallpaper.value?.isVideo && displayMode.value === 'stretch') {
      displayMode.value = 'fill'
    }
  }
)

watch(mediaVisualItem, (newItem, oldItem) => {
  const newUrl = newItem ? mediaUrl(newItem) : null
  const oldUrl = oldItem ? mediaUrl(oldItem) : null
  const wpUrl = currentWallpaper.value?.url
  const wpIsVideo = currentWallpaper.value?.isVideo
  const toWp = !newItem && wpIsVideo && oldUrl === wpUrl
  const toMedia = !oldItem && newUrl && wpIsVideo && newUrl === wpUrl
  if (toWp || toMedia) return
})

watch(
  () => [videoType.value, displayMode.value],
  ([owner, dm]) => {
    if (owner === 'media' && dm === 'stretch') displayMode.value = 'fill'
  },
  { immediate: true }
)

watch(
  [mediaVisualSource, mediaVisualItem],
  ([newKey]) => {
    if (!newKey) { stopMediaImgTimer(); return }
    const src = newKey.src
    const type = newKey.type
    const item = sourceStates[src]?.[type]?.selectedItem.value
    if (!item) return
    if (type === 'video') _loadVisualVideo(item)
    else if (type === 'image') {
      videoEl.value?.pause()
    }
  },
  { immediate: true }
)

watch(
  () => {
    const owner = videoType.value
    if (owner === 'wallpaper') {
      const c = currentWallpaper.value
      return { owner, url: c?.isVideo ? c.url || null : null }
    }
    if (owner === 'media' && mediaVisualItem.value) {
      return { owner, url: mediaUrl(mediaVisualItem.value) || null }
    }
    return { owner, url: null }
  },
  (cur, prev) => {
    if (!cur || !prev) return
    if (cur.owner !== prev.owner) return
    if (!cur.url || !prev.url || cur.url === prev.url) return
    const el = videoEl.value
    if (el) el.currentTime = 0
  }
)

// ====== 音乐同步 ======

function _syncMusicEls(el) {
  if (!el) el = musicEl.value
  if (!el) return
  el.volume = mediaMusicVolume.value / 100
  el.muted = mediaMusicMuted.value
  if (musicPaused.value) el.pause()
  else el.play()?.catch(() => {})
}

function _loadMusicMusic(item) {
  if (!item || item.type !== 'music') return
  musicElProgress.value = 0
  musicElDuration.value = 0
}

// ====== 音乐同步 watch ======

watch(musicPaused, () => {
  if (!musicItem.value) return
  _syncMusicEls()
})

watch(mediaMusicVolume, () => {
  if (musicEl.value) musicEl.value.volume = mediaMusicVolume.value / 100
})

watch(mediaMusicMuted, () => {
  if (musicEl.value) musicEl.value.muted = mediaMusicMuted.value
})

watch(
  [musicSource, musicItem],
  ([newKey]) => {
    if (!newKey) return
    const src = newKey.src
    const type = newKey.type
    const item = sourceStates[src]?.[type]?.selectedItem.value
    if (!item) return
    if (type === 'music') _loadMusicMusic(item)
  },
  { immediate: true }
)

watch(
  () => musicItem.value ? { key: itemId(musicItem.value), source: sourceOf(musicItem.value) } : null,
  (cur, prev) => {
    if (!cur || !prev || cur.key === prev.key) return
    clearMusicProgress()
    const el = musicEl.value
    if (el) el.currentTime = 0
  }
)

// ====== 图片轮播 ======

let _mediaImgTicking = false

function mediaImgTick() {
  const item = mediaVisualItem.value
  if (!item || item.type !== 'image') return
  const source = sourceOf(item)
  const target = pickNextItem(source, item, null)
  if (!target) {
    navigate(source, null)
    stopMediaImgTimer()
    return
  }
  _mediaImgTicking = true
  navigate(source, target)
  _mediaImgTicking = false
}

function stopMediaImgTimer() {
  if (mediaImgTimer.value) { clearInterval(mediaImgTimer.value); mediaImgTimer.value = null }
}

function _mediaImgStartIfEligible() {
  if (!mediaImgOn.value) return false
  if (mediaImgDuration.value <= 0) return false
  const item = mediaVisualItem.value
  if (!item || item.type !== 'image') return false
  const source = sourceOf(item)
  if (!source) return false
  if (!getLoop(source)) return false
  startMediaImgTimer()
  return true
}

function startMediaImgTimer() {
  stopMediaImgTimer()
  mediaImgTimer.value = setInterval(mediaImgTick, Math.max(0.1, mediaImgDuration.value) * 1000)
}

function loadMediaImg(item) {
  if (!item || item.type !== 'image') return
  _mediaImgStartIfEligible()
}

watch(mediaImgOn, (on) => {
  if (!on) { stopMediaImgTimer(); return }
  nextTick(_mediaImgStartIfEligible)
}, { immediate: true })

watch(mediaImgDuration, () => {
  if (mediaImgDuration.value <= 0) { stopMediaImgTimer(); return }
  _mediaImgStartIfEligible()
})

watch(mediaVisualItem, () => {
  if (_mediaImgTicking) return
  nextTick(_mediaImgStartIfEligible)
}, { immediate: true })

watch(
  () => {
    if (!mediaImgOn.value) return null
    const item = mediaVisualItem.value
    if (!item || item.type !== 'image') return null
    const source = sourceOf(item)
    if (!source) return null
    return sourceStates[source.src]?.[source.type]?.loop?.value ?? null
  },
  () => {
    stopMediaImgTimer()
    nextTick(_mediaImgStartIfEligible)
  }
)

// ====== 图层wheel交互 ======

let wheelCooldown = false

function _seekOrNav(el, which, delta, navWhich) {
  const dur = el.duration || 0
  const cur = el.currentTime || 0
  if (dur <= 0) return
  if (delta > 0) {
    const remain = dur - cur
    if (remain <= 30) { playbackNav('next', navWhich); return }
    playbackSeek(Math.min(dur - 0.1, cur + 30), which)
    showSeekIcon(1)
  } else {
    if (cur <= 30) { playbackNav('prev', navWhich); return }
    playbackSeek(Math.max(0, cur - 30), which)
    showSeekIcon(-1)
  }
}

function onLayerWheel(e) {
  const isNext = e.deltaY > 0
  e.preventDefault()
  if (wheelCooldown) return
  wheelCooldown = true
  setTimeout(() => { wheelCooldown = false }, 150)

  if (videoType.value === 'media') {
    const el = videoEl.value
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      _seekOrNav(el, 'media-visual', isNext ? 30 : -30, 'media-visual')
      return
    }
  }
  const sel = selectedSource.value
  if (sel) {
    const type = sel.type
    if (type === 'video' && sourceEquals(sel, mediaVisualSource.value)) {
      const el = videoEl.value
      if (el && Number.isFinite(el.duration) && el.duration > 0) {
        _seekOrNav(el, 'media-visual', isNext ? 30 : -30, 'media-visual')
        return
      }
    }
    if (type === 'music' && sourceEquals(sel, musicSource.value)) {
      const el = musicEl.value
      if (el && Number.isFinite(el.duration) && el.duration > 0) {
        _seekOrNav(el, 'media-music', isNext ? 30 : -30, 'media-music')
        return
      }
    }
  }
  if (musicSource.value) {
    const el = musicEl.value
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      _seekOrNav(el, 'media-music', isNext ? 30 : -30, 'media-music')
      return
    }
  }
  if (mediaVisualSource.value) {
    const vtype = mediaVisualSource.value.type
    if (vtype === 'image') {
      playbackNav(isNext ? 'next' : 'prev', 'media-visual')
      return
    }
  }
  if (currentWallpaper.value?.isVideo) {
    const el = videoEl.value
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      const dur = el.duration
      const cur = el.currentTime
      const delta = isNext ? 3 : -3
      let next = cur + delta
      if (delta < 0) next = Math.max(0, next)
      else next = Math.min(next, dur)
      if (next !== cur) {
        el.currentTime = next
        showSeekIcon(isNext ? 1 : -1)
      }
    }
  }
}

// ---- 图片拖拽 ----

let _dragMoved = false

function onLayerMouseDown(e, containerEl) {
  if (!e.ctrlKey || !canZoomNow()) return
  if (e.button !== 0) return
  const rect = (containerEl || e.currentTarget).getBoundingClientRect()
  startDrag(e.clientX - rect.left, e.clientY - rect.top)
  _dragMoved = false
  document.addEventListener('mousemove', _onDocMouseMove)
  document.addEventListener('mouseup', _onDocMouseUp)
}

function _onDocMouseMove(e) {
  if (!dragState.value.active) return
  const el = document.querySelector('.player-container')
  if (!el) return
  const rect = el.getBoundingClientRect()
  const dx = e.clientX - rect.left - dragState.value.startX
  const dy = e.clientY - rect.top - dragState.value.startY
  if (!_dragMoved && Math.hypot(dx, dy) > 3) _dragMoved = true
  moveDrag(e.clientX - rect.left, e.clientY - rect.top)
}

function _onDocMouseUp() {
  if (!dragState.value.active) return
  endDrag()
  document.removeEventListener('mousemove', _onDocMouseMove)
  document.removeEventListener('mouseup', _onDocMouseUp)
}

// ---- 图片缩放 ----

function canZoomNow() {
  const isImg = imageOn.value
  const isTileMode = displayMode.value === 'tile'
  if (!isImg || isTileMode) return false
  if (imgType.value === 'wallpaper') return true
  if (imgType.value === 'media') {
    return !getLoop(mediaVisualSource.value)
  }
  return false
}

function interactHandleLayerWheel(e, containerEl) {
  if (e.ctrlKey) {
    if (canZoomNow()) {
      e.preventDefault()
      const rect = (containerEl || e.currentTarget).getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const r = imgBaseRect.value
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      zoomAt(mx, my, factor, r.x, r.y)
    }
    e.preventDefault()
    return
  }
  return true
}

watch([mediaVisualItem, imgType, () => currentWallpaper.value?.url, displayMode], () => {
  resetZoom()
})

const rawMediaW = ref(0)
const rawMediaH = ref(0)
watch(curVisualRotate, () => {
  const rot = curVisualRotate.value
  let w = rawMediaW.value, h = rawMediaH.value
  if (rot === 90 || rot === 270) { const t = w; w = h; h = t }
  if (w && h) {
    visualItemW.value = w; visualItemH.value = h; wpMediaInfo.value = { w, h }
    if (imgNatural.value.w && imgNatural.value.h) imgNatural.value = { w, h }
  }
  resetZoom()
  if (displayMode.value === 'tile') {
    tileDirUp.value = true
  }
  if (videoOn.value && !hideVideoBg.value) startCanvasLoop()
})

// ====== 图层click交互 ======

function interactOnLayerClick(e) {
  if (e.ctrlKey && canZoomNow()) return
  const isWallImage = imgType.value === 'wallpaper' && imageOn.value
  if (isWallImage && everZoomed.value) {
    resetZoom()
    return
  }
  const isMediaImage = mediaVisualOn.value && imageOn.value
  if (isMediaImage) {
    if (everZoomed.value) {
      resetZoom()
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    let zone
    if (isPortrait.value) {
      const y = e.clientY - rect.top
      const h = rect.height
      if (y < h / 3) zone = 'prev'
      else if (y > h * 2 / 3) zone = 'next'
    } else {
      const x = e.clientX - rect.left
      const w = rect.width
      if (x < w / 3) zone = 'prev'
      else if (x > w * 2 / 3) zone = 'next'
    }
    if (zone === 'prev' || zone === 'next') {
      if (mediaImgDuration.value <= 15) {
        playbackNav(zone, 'media-visual')
        return
      }
    }
    const isPaused = !getLoop(mediaVisualSource.value)
    if (isPaused || mediaImgDuration.value > 30) return
    playbackToggle('media-visual', { skipIcon: true, forcePause: true })
    showFloatIcon('▶', e.clientX, e.clientY)
    return
  }
  const owner = videoType.value
  let target = null
  let isPlaying = null
  if (owner === 'media') {
    target = 'media-visual'
    isPlaying = !videoPaused.value
  } else if (owner === 'wallpaper') {
    target = 'wp-video'
    isPlaying = !videoPaused.value
  }
  if (target) {
    playbackToggle(target, { skipIcon: true })
    const icon = isPlaying ? '▶' : '⏸'
    showFloatIcon(icon, e.clientX, e.clientY)
  }
}

// ====== 初始化 ======

onMounted(() => {
  document.addEventListener('visibilitychange', onVisChange)
  document.addEventListener('wheel', _windowWheelCapture, { capture: true, passive: false })
  window.addEventListener('mousedown', _windowMouseDownCapture, { capture: true })
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisChange)
  document.removeEventListener('wheel', _windowWheelCapture, { capture: true })
  window.removeEventListener('mousedown', _windowMouseDownCapture, { capture: true })
  stopVideoBottomGrace()
  stopCanvasLoop()
})
</script>

<template>
  <!-- 根容器，桌面对齐时偏移位置 -->
  <div ref="layerEl" class="player-container" :style="layerStyle" @click="onLayerClick">

    <!-- 图片模糊补边背景（图片场景专属，在图片显示层下面） -->
    <div v-if="showImageBg" class="blur-fill">
      <img :src="imageBgSrc" draggable="false" :style="blurBgStyle" />
    </div>

    <!-- 非tile图片：带transform的缩放拖拽层，scale/tx/ty由用户交互驱动 -->
    <div v-show="(imgType === 'wallpaper' || imgType === 'media') && displayMode !== 'tile'" :style="imgZoomWrapStyle">
      <img
        ref="imgElRef"
        :src="imgSrc"
        class="img-fit"
        :style="imgRotateStyle"
        draggable="false"
        @load="onImgLoad"
        @error="onImageError"
      />
    </div>

    <!-- tile图片：用CSS background-image平铺，无需canvas -->
    <div v-show="tileSrc" class="tile-bg" :style="tileLayerStyle" />

    <!-- 纯音频，隐藏 -->
    <audio
      ref="musicEl"
      class="media-music"
      :src="musicItem ? mediaUrl(musicItem) : null"
      :muted="mediaMusicMuted"
      :loop="musicElemLoop"
      @timeupdate="saveMusicProgress"
      @loadedmetadata="onMusicLoadedMetadata"
      @loadeddata="onMusicLoadedDataAutoPlay"
      @canplay="onMusicCanPlayAutoPlay"
      @play="onMusicPlayState"
      @pause="onMusicPlayState"
      @ended="onMusicEnded"
      @error="onMusicError"
      @volumechange="onMusicVolumeChange"
    />

    <video
      ref="videoEl"
      v-show="videoOn && videoReady"
      :style="videoStyle"
      :muted="videoMuted"
      :loop="videoElemLoop"
      :src="videoSrc"
      playsinline
      preload="auto"
      disablepictureinpicture
      controlslist="nodownload nofullscreen noremoteplayback"
      draggable="false"
      @timeupdate="saveVideoProgress"
      @loadedmetadata="onVideoLoadedMetadata"
      @loadeddata="onVideoLoadedData"
      @canplay="_trySyncVideoPlay"
      @playing="videoPlaying = true"
      @play="onVideoPlayState"
      @pause="onVideoPlayState"
      @ended="onVideoEndedLocal"
      @error="onVideoError"
      @volumechange="onVideoVolumeChange"
    />

    <!-- 视频场景背景层：tile模式绘制非video位置的平铺帧+补边，fit/center/stretch绘制模糊补边，始终在video下方 -->
    <canvas v-show="!hideVideoBg" ref="canvasRef" class="cavas-bg" :style="canvasStyle"></canvas>

  </div>
</template>

<style scoped>
.player-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 0;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.tile-bg {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  transition: none;
}

.blur-fill {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.cavas-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.blur-fill img {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: translate(-50%, -50%) scale(1.15);
  filter: blur(16px);
}

.img-fit {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.player-container .media-music {
  display: none;
}
</style>