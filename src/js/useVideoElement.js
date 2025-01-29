import { ref, watch, nextTick } from 'vue'
import { mediaVideoMuted, mediaVideoVolume, wpVideoMuted, wpVideoVolume, wpVideoPlaying, videoLoop, visualPaused, audioPaused, mediaAudioVolume, mediaAudioMuted } from './usePersist'
import { mediaVideoEl, mediaAudioEl, mediaVisualTimeDur, mediaAudioTimeDur, mediaVideoPlaying, mediaAudioPlaying } from './usePlaybackState'
import { saveVideoProgress, saveAudioProgress } from './usePlaybackLifecycle'
import { currentWallpaper, wpMediaInfo } from './useWallpaper'
import { visualItem, videoOwner, displayMode, mediaActive } from './useVisualOwner'
import { mediaUrl } from '../utils/media'

export const mediaItemW = ref(0)
export const mediaItemH = ref(0)
export const inited = ref(false)
export const videoPosters = ref({ wallpaper: '', media: '' })

let _suppressVideoRefWrite = false

export function syncVideoEls() {
  const el = mediaVideoEl.value
  if (!el) return
  const owner = videoOwner.value
  if (owner === 'media') {
    el.volume = mediaVideoVolume.value / 100
    el.muted = mediaVideoMuted.value
    el.loop = false
    if (visualPaused.value) el.pause()
    else el.play()?.catch(() => {})
  } else if (owner === 'wallpaper') {
    el.volume = wpVideoVolume.value / 100
    el.muted = wpVideoMuted.value
    el.loop = videoLoop.value
    if (wpVideoPlaying.value) el.play()?.catch(() => {})
    else el.pause()
  }
}

export function syncAudioEls(el) {
  if (!el) el = mediaAudioEl.value
  if (!el) return
  el.volume = mediaAudioVolume.value / 100
  el.muted = mediaAudioMuted.value
  if (audioPaused.value) el.pause()
  else el.play()?.catch(() => {})
}

export function bindMediaVideo(el) {
  mediaVideoEl.value = el
}

watch(videoOwner, (owner, prevOwner) => {
  _suppressVideoRefWrite = true
  if (owner) {
    if (!inited.value) inited.value = true
    nextTick(() => {
      const el = mediaVideoEl.value
      if (el && prevOwner) {
        const newSrc = owner === 'media' ? mediaUrl(visualItem.value) : currentWallpaper.value?.url
        if (el.src === newSrc) {
          const w = el.videoWidth || el.naturalWidth || 0
          const h = el.videoHeight || el.naturalHeight || 0
          if (owner === 'media') {
            el.volume = mediaVideoVolume.value / 100
            el.muted = mediaVideoMuted.value
            el.loop = false
            visualPaused.value = el.paused
            mediaVisualTimeDur.value = el.duration || 0
            if (w && h) mediaItemW.value = w; mediaItemH.value = h
          } else {
            el.volume = wpVideoVolume.value / 100
            el.muted = wpVideoMuted.value
            el.loop = videoLoop.value
            wpVideoPlaying.value = !el.paused
            if (w && h) { mediaItemW.value = w; mediaItemH.value = h; wpMediaInfo.value = { w, h } }
          }
          _suppressVideoRefWrite = false
          return
        }
      }
      syncVideoEls()
      _suppressVideoRefWrite = false
    })
  } else {
    _suppressVideoRefWrite = false
  }
}, { immediate: true })

watch([visualPaused, mediaVideoVolume, mediaVideoMuted], () => {
  const el = mediaVideoEl.value
  if (!el || videoOwner.value !== 'media') return
  el.volume = mediaVideoVolume.value / 100
  el.muted = mediaVideoMuted.value
  el.loop = false
  if (visualPaused.value) el.pause()
  else el.play()?.catch(() => {})
})

watch([wpVideoPlaying, wpVideoVolume, wpVideoMuted, videoLoop], () => {
  const el = mediaVideoEl.value
  if (!el || videoOwner.value !== 'wallpaper') return
  el.volume = wpVideoVolume.value / 100
  el.muted = wpVideoMuted.value
  el.loop = videoLoop.value
  if (wpVideoPlaying.value) el.play()?.catch(() => {})
  else el.pause()
})

watch(
  mediaVideoEl,
  (el) => {
    if (!el) return
    el.addEventListener('timeupdate', saveVideoProgress)
    el.addEventListener('loadedmetadata', () => { mediaVisualTimeDur.value = el.duration || 0 })
    const syncPlayState = () => {
      const playing = !el.paused
      mediaVideoPlaying.value = playing
      if (_suppressVideoRefWrite) return
      const owner = videoOwner.value
      if (owner === 'media') visualPaused.value = !playing
      else if (owner === 'wallpaper') wpVideoPlaying.value = playing
    }
    el.addEventListener('play', syncPlayState)
    el.addEventListener('pause', syncPlayState)
    el.addEventListener('ended', () => {
      mediaVideoPlaying.value = false
    })
    el.addEventListener('error', () => {
      mediaVideoPlaying.value = false
    })
    el.addEventListener('volumechange', () => {
      const owner = videoOwner.value
      if (owner === 'media') {
        mediaVideoVolume.value = Math.round(el.volume * 100)
        mediaVideoMuted.value = el.muted
      } else if (owner === 'wallpaper') {
        wpVideoVolume.value = Math.round(el.volume * 100)
        wpVideoMuted.value = el.muted
      }
    })
    syncVideoEls()
  }
)

watch(
  mediaAudioEl,
  (el) => {
    if (!el) return
    const syncPlayState = () => {
      const playing = !el.paused
      mediaAudioPlaying.value = playing
      audioPaused.value = !playing
    }
    el.addEventListener('timeupdate', saveAudioProgress)
    el.addEventListener('loadedmetadata', () => { mediaAudioTimeDur.value = el.duration || 0 })
    el.addEventListener('play', syncPlayState)
    el.addEventListener('pause', syncPlayState)
    el.addEventListener('ended', () => {
      mediaAudioPlaying.value = false
    })
    el.addEventListener('error', () => {
      mediaAudioPlaying.value = false
    })
    el.addEventListener('volumechange', () => {
      mediaAudioVolume.value = Math.round(el.volume * 100)
      mediaAudioMuted.value = el.muted
    })
    syncAudioEls(el)
  }
)

watch(
  () => currentWallpaper.value?.url,
  () => {
    if (!mediaActive.value) {
      mediaItemW.value = 0
      mediaItemH.value = 0
    }
    videoPosters.value = { ...videoPosters.value, wallpaper: '', wallpaper_url: '' }
    if (currentWallpaper.value?.isVideo && displayMode.value === 'stretch') {
      displayMode.value = 'fill'
    }
  }
)

watch(visualItem, (newItem, oldItem) => {
  const newUrl = newItem ? mediaUrl(newItem) : null
  const oldUrl = oldItem ? mediaUrl(oldItem) : null
  const wpUrl = currentWallpaper.value?.url
  const wpIsVideo = currentWallpaper.value?.isVideo
  const toWp = !newItem && wpIsVideo && oldUrl === wpUrl
  const toMedia = !oldItem && newUrl && wpIsVideo && newUrl === wpUrl
  if (toWp || toMedia) {
    videoPosters.value = { ...videoPosters.value, media: '', media_url: '' }
    return
  }
  mediaItemW.value = 0
  mediaItemH.value = 0
  videoPosters.value = { ...videoPosters.value, media: '', media_url: '' }
})

watch(
  () => [videoOwner.value, displayMode.value],
  ([owner, dm]) => {
    if (owner === 'media' && dm === 'stretch') displayMode.value = 'fill'
  },
  { immediate: true }
)

export * from './useVideoCallbacks'