import { displayMode, isPortrait } from './useVisualState'
import { imgType, imageOn, mediaVisualOn, mediaVisualItem } from './useSourceState'
import { videoType } from './useSourceState'
import { getMode, MODES } from './usePlayMode'
import { mediaVisualSource, videoPaused } from './usePersist'
import { playbackNav } from './useItemNav'
import { playbackToggle } from './usePlayToggle'
import { showFloatIcon } from './useFloatIcon'
import { everZoomed, dragState, resetZoom, zoomAt, startDrag, moveDrag, endDrag, imgBaseRect } from './useImageZoom'

export function canZoomNow() {
  const isImg = imageOn.value
  const isTileMode = displayMode.value === 'tile'
  if (!isImg || isTileMode) return false
  if (imgType.value === 'wallpaper') return true
  if (imgType.value === 'media') {
    const m = getMode(mediaVisualSource.value)
    return m === MODES.SINGLE_PLAY
  }
  return false
}

export function handleLayerWheel(e, containerEl) {
  if (e.ctrlKey) {
    const isImg = imageOn.value
    const isTileMode = displayMode.value === 'tile'
    if (isImg && !isTileMode) {
      let canZoom = false
      if (imgType.value === 'wallpaper') {
        canZoom = true
      } else if (imgType.value === 'media') {
        const m = getMode(mediaVisualSource.value)
        canZoom = m === MODES.SINGLE_PLAY
      }
      if (canZoom) {
        e.preventDefault()
        const rect = (containerEl || e.currentTarget).getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const r = imgBaseRect.value
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
        zoomAt(mx, my, factor, r.x, r.y)
      }
    }
    e.preventDefault()
    return
  }
  return true
}

let _dragMoved = false

export function onLayerMouseDown(e, containerEl) {
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

export function onLayerClick(e) {
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
      const ok = playbackNav(zone, 'media-visual')
      if (ok) showFloatIcon(zone === 'prev' ? '⏮' : '⏭', e.clientX, e.clientY)
      return
    }
    const isPaused = getMode(mediaVisualSource.value) === MODES.SINGLE_PLAY
    if (isPaused) return
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