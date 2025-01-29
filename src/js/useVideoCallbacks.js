import {
  visualPaused, wpVideoPlaying, wpVideoProgress
} from './usePersist'
import { onVideoEnded as triggerVideoEnded, handleError, restoreVideo, restoreAudio } from './usePlaybackLifecycle'
import { playbackToggle } from './usePlaybackActions'
import { mediaVideoEl, mediaAudioEl } from './usePlaybackState'
import { videoOwner, visualItem } from './useVisualOwner'
import {
  mediaItemW, mediaItemH, videoPosters
} from './useVideoElement'
import { wpVideoKey, wpMediaInfo, currentWallpaper } from './useWallpaper'

function captureVideoFrame(el, owner) {
  if (!el || el.readyState < 2) return
  const w = el.videoWidth, h = el.videoHeight
  if (!w || !h) return
  const url = el.getAttribute('src')
  if (!url) return
  requestAnimationFrame(() => {
    if (videoPosters.value[owner] && videoPosters.value[owner + '_url'] === url) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(el, 0, 0, w, h)
      videoPosters.value = {
        ...videoPosters.value,
        [owner]: canvas.toDataURL('image/jpeg', 0.7),
        [owner + '_url']: url
      }
    } catch (e) {}
  })
}

export function onMediaLoad(e) {
  const el = e?.target
  if (!el) return
  const w = el.videoWidth || el.naturalWidth || 0
  const h = el.videoHeight || el.naturalHeight || 0
  mediaItemW.value = w; mediaItemH.value = h; wpMediaInfo.value = { w, h }
  if (videoOwner.value === 'media' && visualItem.value?.type === 'video') captureVideoFrame(el, 'media')
  if (currentWallpaper.value?.isVideo) captureVideoFrame(el, 'wallpaper')
}

export function onVideoEndedLocal(e) {
  const el = e?.target || mediaVideoEl.value
  if (el && el.currentTime === 0 && (el.duration === 0 || el.readyState < 2)) return
  const owner = videoOwner.value
  if (owner === 'media') {
    triggerVideoEnded()
    return
  }
  if (wpVideoPlaying.value) playbackToggle('wp-video')
}

export function onVideoTimeUpdate() {
  if (videoOwner.value !== 'wallpaper') return
  const el = mediaVideoEl.value
  if (!el) return
  const k = wpVideoKey()
  if (!k) return
  const dur = el.duration || 0
  if (!dur) return
  const cur = el.currentTime || 0
  if (dur < 30 || cur < 30 || (dur - cur) < 30) {
    if (wpVideoProgress.value.time !== 0) wpVideoProgress.set({ key: '', time: 0 })
    return
  }
  if (Math.abs(cur - wpVideoProgress.value.time) < 1 && k === wpVideoProgress.value.key) return
  wpVideoProgress.set({ key: k, time: cur })
}

export function onVideoLoadedMeta() { restoreVideo(mediaVideoEl.value) }

export function onVideoError() {
  if (videoOwner.value === 'media') handleError('video', visualItem.value)
}

export function onImageError() {
  if (visualItem.value?.type === 'image') handleError('image', visualItem.value)
}

export function bindAudioEl(el) {
  mediaAudioEl.value = el
}

export function onAudioLoadedMeta() { restoreAudio(mediaAudioEl.value) }