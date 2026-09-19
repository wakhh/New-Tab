import { videoProgress, musicProgress, mediaVisualSource, musicSource, videoPaused, musicPaused } from './usePersist'
import { videoEl, videoElProgress, videoElDuration } from './useVideoElement'
import { musicEl, musicElProgress, musicElDuration } from './useAudioElement'
import { musicItem } from './useSourceState'
import { itemId } from '../utils/media'

export function getVideoProgress(key) {
  if (!key) return 0
  return videoProgress.value?.key === key ? (videoProgress.value.time || 0) : 0
}
export function getMusicProgress(key) {
  if (!key) return 0
  return musicProgress.value?.key === key ? (musicProgress.value.time || 0) : 0
}
export function clearVideoProgress() { videoProgress.set(null) }
export function clearMusicProgress() { musicProgress.set(null) }

let _lastVideoSaveAt = 0
let _lastMusicSaveAt = 0

export function saveVideoProgress() {
  const el = videoEl.value
  if (!el) return
  const t = el.currentTime || 0
  const d = el.duration || 0
  videoElProgress.value = t
  if (!d) return
  if (d < 90 || t < 30 || (d - t) < 30) return
  if (Date.now() - _lastVideoSaveAt < 1000) return
  _lastVideoSaveAt = Date.now()
  const src = el.src
  if (!src) return
  videoProgress.set({ key: src, time: t })
}

export function saveMusicProgress() {
  const el = musicEl.value
  if (!el) return
  const t = el.currentTime || 0
  const d = el.duration || 0
  musicElProgress.value = t
  const item = musicItem.value
  if (!item) return
  if (!d) return
  if (d < 90 || t < 30 || (d - t) < 30) return
  if (Date.now() - _lastMusicSaveAt < 1000) return
  _lastMusicSaveAt = Date.now()
  musicProgress.set({ key: itemId(item), time: t })
}

export function restoreVideoProgress(el) {
  if (!el || !el.src) return
  const t = getVideoProgress(el.src)
  if (t > 0) el.currentTime = t
}
export function restoreMusicProgress(el, key) {
  if (!el || !key) return
  const t = getMusicProgress(key)
  if (t > 0) el.currentTime = t
}

export function playbackSeek(t, which) {
  const time = Math.max(0, Math.round(t))
  if (which === 'wp-video') {
    if (videoEl.value) videoEl.value.currentTime = time
    return
  }
  if (which === 'media-visual') {
    if (videoEl.value) videoEl.value.currentTime = time
  } else if (which === 'media-music') {
    if (musicEl.value) musicEl.value.currentTime = time
  }
}