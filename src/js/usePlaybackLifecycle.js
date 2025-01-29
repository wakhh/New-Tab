import { watch, nextTick } from 'vue'
import {
  sourceStates, visualPaused, audioPaused, slideSeconds, mediaVideoVolume, mediaAudioVolume,
  wpVideoProgress, wpVideoPlaying
} from './usePersist'
import { itemKey, itemSourceKeyOf, mediaUrl } from '../utils/media'
import { visualItem, videoOn, slideshowOn } from './useVisualOwner'
import { audioItem, musicOn } from './useAudioOwner'
import { wpVideoKey, currentWallpaper } from './useWallpaper'
import {
  mediaVideoEl, mediaAudioEl, mediaSlideTimer,
  mediaVisualTimeCur, mediaVisualTimeDur, mediaAudioTimeCur, mediaAudioTimeDur
} from './usePlaybackState'
import {
  MODES, modeForKey, stateOfItem, pickNextItem
} from './usePlaybackEngine'

export function navigate(srcKey, target, opts = {}) {
  if (!srcKey) return
  const autoPlay = opts.autoPlay !== false
  const [src, type] = srcKey.split('-')
  const st = sourceStates[src]?.[type]
  if (!st) return

  if (!target) {
    stopSource(srcKey)
    return
  }

  st.selectedItem.set(target)
  st.currentTime.set({ key: itemKey(target), time: 0 })
  if (autoPlay) {
    if (type === 'music') audioPaused.set(false)
    else visualPaused.set(false)
  } else {
    if (type === 'music') audioPaused.set(true)
    else visualPaused.set(true)
  }
}

export function replay(type, item) {
  if (!item) return
  const st = stateOfItem(item)
  if (!st) return
  st.currentTime.set({ key: itemKey(item), time: 0 })
  if (type === 'music') audioPaused.set(false)
  else visualPaused.set(false)
}

export function stopSource(srcKey) {
  if (!srcKey) return
  const [src, type] = srcKey.split('-')
  const st = sourceStates[src]?.[type]
  if (!st) return
  if (type === 'music') audioPaused.set(true)
  else visualPaused.set(true)
  const item = st.selectedItem.value
  if (item) st.currentTime.set({ key: itemKey(item), time: 0 })
}

function handleEnded(type, item) {
  if (!item) return

  const srcKey = itemSourceKeyOf(item)
  const mode = modeForKey(srcKey)

  if (mode === MODES.SINGLE_LOOP) { replay(type, item); return }

  const target = pickNextItem(srcKey, item, null, mode)
  if (!target) {
    if (mode === MODES.SINGLE_PLAY) { stopSource(srcKey); return }
    navigate(srcKey, null)
    return
  }
  navigate(srcKey, target)
}

export function applySeek(el, prog, guard = true) {
  if (!prog || !prog.time || prog.time <= 0 || !el) return false
  if (!Number.isFinite(el.duration) || el.duration <= 0) return false
  if (guard) {
    if (el.duration < 30) return false
    if (prog.time < 30) return false
    if ((el.duration - prog.time) < 30) return false
  }
  el.currentTime = Math.max(0, Math.min(prog.time, el.duration - 0.5))
  return true
}

export function restoreVideo(el) {
  if (!el) return
  const wpK = wpVideoKey()
  if (wpK) {
    const saved = wpVideoProgress.value
    if (saved.key === wpK && saved.time > 0 && saved.time < (el.duration || 1) - 1) {
      applySeek(el, saved, true)
    }
  } else {
    const item = visualItem.value
    if (item) {
      const st = stateOfItem(item)
      if (st) {
        const prog = st.currentTime.value
        if (prog && prog.key === itemKey(item)) applySeek(el, prog, true)
      }
    }
  }
}

export function restoreAudio(el) {
  if (!el) return
  const item = audioItem.value
  if (item) {
    const st = stateOfItem(item)
    if (st) {
      const prog = st.currentTime.value
      if (prog && prog.key === itemKey(item)) applySeek(el, prog, true)
    }
  }
}

export function loadAudioMusic(item) {
  if (!item || item.type !== 'music') return
  mediaAudioTimeCur.value = 0; mediaAudioTimeDur.value = 0
  nextTick(() => {
    const el = mediaAudioEl.value
    if (!el) return
    if (audioPaused.value) el.pause()
    else el.play()?.catch(() => {})
  })
}

export function loadVisualVideo(item) {
  if (!item || item.type !== 'video') return
  stopSlideTimer()
  const el = mediaVideoEl.value
  const url = mediaUrl(item)
  const sameEl = el && el.src && (el.src === url || el.src.endsWith(url))
  if (!sameEl) {
    mediaVisualTimeCur.value = 0
    mediaVisualTimeDur.value = 0
  }
  if (!el) return
  el.loop = false
  nextTick(() => {
    const e = mediaVideoEl.value
    if (!e) return
    if (visualPaused.value) e.pause()
    else e.play()?.catch(() => {})
  })
}

export function loadVisualSlideshow(item) {
  if (!item || item.type !== 'image') return
  mediaVideoEl.value?.pause()
  if (!visualPaused.value) startSlideTimer()
}

let lastVideoSaveAt = 0
let lastAudioSaveAt = 0

export function saveVideoProgress() {
  const el = mediaVideoEl.value
  if (!el) return
  const t = el.currentTime || 0
  const d = el.duration || 0
  mediaVisualTimeCur.value = t
  const item = visualItem.value
  if (!item) return
  const st = stateOfItem(item)
  if (!st || !d) return
  if (d < 30 || t < 30 || (d - t) < 30) return
  if (Date.now() - lastVideoSaveAt < 1000) return
  lastVideoSaveAt = Date.now()
  st.currentTime.set({ key: itemKey(item), time: t })
}

export function saveAudioProgress() {
  const el = mediaAudioEl.value
  if (!el) return
  const t = el.currentTime || 0
  const d = el.duration || 0
  mediaAudioTimeCur.value = t
  const item = audioItem.value
  if (!item) return
  const st = stateOfItem(item)
  if (!st || !d) return
  if (d < 30 || t < 30 || (d - t) < 30) return
  if (Date.now() - lastAudioSaveAt < 1000) return
  lastAudioSaveAt = Date.now()
  st.currentTime.set({ key: itemKey(item), time: t })
}

function slideTick() {
  const item = visualItem.value
  if (!item || item.type !== 'image') return
  const srcKey = itemSourceKeyOf(item)
  const mode = modeForKey(srcKey)

  if (mode === MODES.SINGLE_LOOP) return

  const target = pickNextItem(srcKey, item, null, mode)
  if (!target) {
    if (mode === MODES.SINGLE_PLAY) return
    navigate(srcKey, null)
    stopSlideTimer()
    return
  }
  navigate(srcKey, target)
}

export function stopSlideTimer() {
  if (mediaSlideTimer.value) { clearInterval(mediaSlideTimer.value); mediaSlideTimer.value = null }
}
export function startSlideTimer() {
  stopSlideTimer()
  mediaSlideTimer.value = setInterval(slideTick, Math.max(0.1, slideSeconds.value) * 1000)
}

export function onVideoEnded() {
  if (videoOn.value) handleEnded('video', visualItem.value)
}
export function onAudioEnded() {
  if (musicOn.value) handleEnded('music', audioItem.value)
}

export function handleError(type, item) {
  if (!item) return
  const srcKey = itemSourceKeyOf(item)
  const mode = modeForKey(srcKey)
  if (mode === MODES.SINGLE_PLAY || mode === MODES.SINGLE_LOOP) { stopSource(srcKey); return }
  handleEnded(type, item)
}

watch(
  [slideshowOn, visualPaused],
  ([on, paused]) => {
    if (on && !paused) startSlideTimer()
    else stopSlideTimer()
  }
)
watch(slideSeconds, () => {
  if (slideshowOn.value && !visualPaused.value) startSlideTimer()
})