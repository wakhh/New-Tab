import { ref, computed } from 'vue'
import { updateScreenSize } from './useScreen'
import { throttle } from '../utils/common'

export const viewportW = ref(window.innerWidth)
export const viewportH = ref(window.innerHeight)
export const maximized = ref(false)
export const isPortrait = computed(() => viewportW.value <= viewportH.value)

function detectMaximized() {
  const s = window.screen
  const availW = s?.availWidth || 0
  const availH = s?.availHeight || 0
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!availW || !availH || !vw || !vh) return false
  return vw >= availW - 60 && vh >= availH - 120
}

viewportW.value = window.innerWidth
viewportH.value = window.innerHeight
maximized.value = detectMaximized()
updateScreenSize()

const onResize = throttle(() => {
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight
  maximized.value = detectMaximized()
  updateScreenSize()
}, 100)

window.addEventListener('resize', onResize)

export const mouseX = ref(0)
export const mouseY = ref(0)
export const mouseInited = ref(false)

function onMouseMove(e) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
  if (!mouseInited.value) mouseInited.value = true
}
window.addEventListener('mousemove', onMouseMove)

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

export const hoveredPanel = ref(null)
export const panelActive = ref(null)

import { autoHide, settingsOpen, portraitPanel } from './usePersist'

const EDGE_MAP = {
  tl: edgeTL, tr: edgeTR, bl: edgeBL, br: edgeBR, bottom: edgeBottom
}

const PANEL_TO_KEY = {
  tl: 'wallpaper',
  br: 'media',
  bl: 'display',
  ctrl: 'control'
}

export function usePanelVisibility(panelId, opts = {}) {
  const { edge } = opts
  const edgeRef = edge ? EDGE_MAP[edge] : null
  return computed(() => {
    if (isPortrait.value) {
      if (!settingsOpen.value) return false
      const key = PANEL_TO_KEY[panelId]
      if (key) return portraitPanel.value === key
      return true
    }
    if (!settingsOpen.value) return false
    if (!autoHide.value) return true
    if (panelActive.value === panelId) return true
    return (edgeRef?.value ?? false) || hoveredPanel.value === panelId
  })
}