import { computed, ref, watch } from 'vue'
import { viewportW, viewportH, containerW, containerH } from './useVisualState'
import { currentWallpaper, wpMediaInfo } from './useThemeWallpaper'
import { visualItemW, visualItemH } from './useVideoElement'
import { displayMode } from './useVisualState'
import { tileVideoCount } from './useTileLayout'
import { videoOn, mediaVisualOn, mediaVisualItem } from './useSourceState'

const tileDirUp = ref(true)

export function defaultTileCount(max) {
  if (max <= 3) return max
  if (max % 2 === 0) return max - 1
  return max
}

export function ratioType(w, h) {
  if (!w || !h) return null
  const r = w / h
  if (r >= (4 / 3) * 0.99 && r <= (21 / 9) * 1.01) return 'landscape'
  if (r >= (9 / 21) * 0.99 && r <= (3 / 4) * 1.01) return 'portrait'
  return null
}

export const viewportRatio = computed(() => ratioType(viewportW.value, viewportH.value))

export const areaRatio = computed(() => ratioType(containerW.value, containerH.value))

export const curW = computed(() => mediaVisualOn.value ? visualItemW.value : wpMediaInfo.value.w)
export const curH = computed(() => mediaVisualOn.value ? visualItemH.value : wpMediaInfo.value.h)
export const curRatio = computed(() => curW.value && curH.value ? ratioType(curW.value, curH.value) : null)

export const isvideoType = computed(() => videoOn.value)

export const curExcess = computed(() => {
  const w = curW.value
  const h = curH.value
  const vw = containerW.value
  const vh = containerH.value
  if (!w || !h) return null
  const wr = w / h
  const vr = vw / vh
  if (Math.abs(wr - vr) / vr <= 0.01) return null
  const wideTall = wr >= vr
  const bigEnough = w >= vw || h >= vh
  if (wideTall) return bigEnough ? 'tooWide' : 'tooShort'
  return bigEnough ? 'tooHigh' : 'tooNarrow'
})

function videoScaledWidth() {
  const vh = containerH.value
  const vw = containerW.value
  const w = curW.value
  const h = curH.value
  if (!w || !h || !vh || !vw) return Infinity
  const vR = w / h
  const aR = vw / vh
  if (vR >= aR) return vw
  return vh * vR
}

export const maxTileCount = computed(() => {
  const vw = containerW.value
  if (!curW.value || !curH.value) return 1
  const per = videoScaledWidth()
  if (!per || per >= vw) return 1
  const exact = vw / per
  const floorVal = Math.floor(exact)
  if (floorVal === 2 && exact - floorVal >= 0.4) return Math.min(9, 3)
  return Math.min(9, floorVal)
})

export function setDisplayMode(v, repeat) {
  if (v !== 'tile') {
    tileVideoCount.value = 1
    displayMode.value = v
    return
  }
  if (!isvideoType.value) { displayMode.value = v; return }

  const max = maxTileCount.value
  if (max <= 1) { tileVideoCount.value = 1; displayMode.value = 'tile'; return }

  if (!repeat) {
    tileVideoCount.value = defaultTileCount(max)
    tileDirUp.value = true
    displayMode.value = 'tile'
    return
  }

  if (tileDirUp.value) {
    if (tileVideoCount.value >= max) { tileDirUp.value = false; tileVideoCount.value = max - 1 }
    else { tileVideoCount.value++ }
  } else {
    if (tileVideoCount.value <= 1) { tileDirUp.value = true; tileVideoCount.value = 2 }
    else { tileVideoCount.value-- }
  }
}

watch([() => mediaVisualItem.value?.key, () => currentWallpaper.value?.url, () => curW.value, () => curH.value], () => {
  const m = maxTileCount.value
  tileVideoCount.value = defaultTileCount(m)
  tileDirUp.value = true
})

watch(maxTileCount, (max) => {
  if (!curW.value || !curH.value) return
  if (tileVideoCount.value !== max) tileVideoCount.value = defaultTileCount(max)
})