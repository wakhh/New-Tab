import { ref, computed } from 'vue'
import { throttle } from '../utils/common'
import { autoHide, settingsOpen, portraitWidget } from './usePersist'
import {  mediaVisualSource, _displayModeVideo, _displayModeImage, _desktopAlignVideo, _desktopAlignImage, _desktopAnchorVideo, _desktopAnchorImage } from './usePersist'
import { currentWallpaper } from './useThemeWallpaper'

export const viewportW = ref(window.innerWidth)
export const viewportH = ref(window.innerHeight)
export const maximized = ref(false)
export const isPortrait = computed(() => viewportW.value <= viewportH.value)

export const screenW = ref(window.screen?.width || 1920)
export const screenH = ref(window.screen?.height || 1080)

export function updateScreenSize() {
  screenW.value = window.screen?.width || screenW.value
  screenH.value = window.screen?.height || screenH.value
}

function detectMaximized() {
  const vw = viewportW.value
  const vh = viewportH.value
  const sw = screenW.value
  const sh = screenH.value
  if (!vw || !vh || !sw || !sh) return false
  return vw >= sw - 60 && vh >= sh - 200
}

viewportW.value = window.innerWidth
viewportH.value = window.innerHeight
updateScreenSize()
maximized.value = detectMaximized()

const onResize = throttle(() => {
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight
  updateScreenSize()
  maximized.value = detectMaximized()
}, 100)

window.addEventListener('resize', onResize)

export const mouseX = ref(0)
export const mouseY = ref(0)
export const mouseInited = ref(false)
export const mouseInViewport = ref(true)

function onMouseMove(e) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
  if (!mouseInited.value) mouseInited.value = true
}
window.addEventListener('mousemove', onMouseMove)

document.addEventListener('mouseleave', () => { mouseInViewport.value = false })
document.addEventListener('mouseenter', () => { mouseInViewport.value = true })

const H = computed(() => viewportH.value / 3)
const W = computed(() => viewportW.value / 3)
const inTop = computed(() => mouseInited.value && mouseY.value <= H.value)
const inBottom = computed(() => mouseInited.value && mouseY.value >= viewportH.value - H.value)
const inLeft = computed(() => mouseInited.value && mouseX.value <= W.value)
const inRight = computed(() => mouseInited.value && mouseX.value >= viewportW.value - W.value)

export const edgeTL = computed(() => inTop.value && inLeft.value)
export const edgeTR = computed(() => inTop.value && inRight.value)
export const edgeBL = computed(() => inBottom.value && inLeft.value)
export const edgeBR = computed(() => inBottom.value && inRight.value)
export const edgeBottom = computed(() => inBottom.value)

export const hoveredWidget = ref(null)
export const widgetActive = ref(null)

const EDGE_MAP = {
  tl: edgeTL, tr: edgeTR, bl: edgeBL, br: edgeBR, bottom: edgeBottom
}

const PANEL_TO_KEY = {
  tl: 'wallpaper',
  br: 'media',
  bl: 'display',
  ctrl: 'control'
}

export function useWidgetVisibility(widgetId, opts = {}) {
  const { edge } = opts
  const edgeRef = edge ? EDGE_MAP[edge] : null
  return computed(() => {
    if (isPortrait.value) {
      if (!settingsOpen.value) return false
      const key = PANEL_TO_KEY[widgetId]
      if (key) return portraitWidget.value === key
      return true
    }
    if (!settingsOpen.value) return false
    if (!autoHide.value) return true
    if (!mouseInViewport.value) return false
    if (widgetActive.value === widgetId) return true
    return (edgeRef?.value ?? false) || hoveredWidget.value === widgetId
  })
}

export const viewportAreaDiffers = computed(() =>
  viewportW.value !== screenW.value || viewportH.value !== screenH.value
)

export const canDesktopAlign = computed(() =>
  viewportW.value > viewportH.value && maximized.value && viewportAreaDiffers.value
)

export const containerW = computed(() => desktopAlign.value ? screenW.value : viewportW.value)
export const containerH = computed(() => desktopAlign.value ? screenH.value : viewportH.value)

function _isVideoVisual() {
  const k = mediaVisualSource.value
  if (k) return k.type === 'video'
  return !!currentWallpaper.value?.isVideo
}

export const displayMode = computed({
  get() {
    return _isVideoVisual() ? _displayModeVideo.value : _displayModeImage.value
  },
  set(v) {
    if (_isVideoVisual()) _displayModeVideo.value = v
    else _displayModeImage.value = v
  }
})

export const desktopAlign = computed({
  get() {
    if (!canDesktopAlign.value) return false
    return _isVideoVisual() ? _desktopAlignVideo.value : _desktopAlignImage.value
  },
  set(v) {
    if (_isVideoVisual()) _desktopAlignVideo.value = v
    else _desktopAlignImage.value = v
  }
})

export const desktopAnchor = computed({
  get() {
    return _isVideoVisual() ? _desktopAnchorVideo.value : _desktopAnchorImage.value
  },
  set(v) {
    if (_isVideoVisual()) _desktopAnchorVideo.value = v
    else _desktopAnchorImage.value = v
  }
})