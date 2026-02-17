import { ref, watch, nextTick } from 'vue'
import { mediaImgDuration } from './usePersist'
import { mediaImgOn, mediaVisualItem } from './useSourceState'
import { MODES, getMode } from './usePlayMode'
import { sourceOf } from '../utils/media'
import { navigate, pickNextItem } from './useItemNav'

export const mediaImgTimer = ref(null)

let _ticking = false

function mediaImgTick() {
  const item = mediaVisualItem.value
  if (!item || item.type !== 'image') return
  const source = sourceOf(item)
  const mode = getMode(source)

  if (mode === MODES.SINGLE_LOOP) return
  if (mode === MODES.SINGLE_PLAY) return

  const target = pickNextItem(source, item, null, mode)
  if (!target) {
    navigate(source, null)
    stopMediaImgTimer()
    return
  }
  _ticking = true
  navigate(source, target)
  _ticking = false
}

export function stopMediaImgTimer() {
  if (mediaImgTimer.value) { clearInterval(mediaImgTimer.value); mediaImgTimer.value = null }
}

function _startIfEligible() {
  if (!mediaImgOn.value) return false
  if (mediaImgDuration.value <= 0) return false
  const item = mediaVisualItem.value
  if (!item || item.type !== 'image') return false
  const source = sourceOf(item)
  if (!source) return false
  const mode = getMode(source)
  if (mode === MODES.SINGLE_LOOP || mode === MODES.SINGLE_PLAY) return false
  startMediaImgTimer()
  return true
}

export function startMediaImgTimer() {
  stopMediaImgTimer()
  mediaImgTimer.value = setInterval(mediaImgTick, Math.max(0.1, mediaImgDuration.value) * 1000)
}

export function loadMediaImg(item) {
  if (!item || item.type !== 'image') return
  _startIfEligible()
}

watch(mediaImgOn, (on) => {
  if (!on) { stopMediaImgTimer(); return }
  nextTick(_startIfEligible)
}, { immediate: true })

watch(mediaImgDuration, () => {
  if (mediaImgDuration.value <= 0) { stopMediaImgTimer(); return }
  _startIfEligible()
})

watch(mediaVisualItem, () => {
  if (_ticking) return
  nextTick(_startIfEligible)
}, { immediate: true })