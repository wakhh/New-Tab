import { ref, watch, nextTick } from 'vue'
import {
  sourceStates, mediaVisualSource, videoPaused,
  mediaVideoMuted, mediaVideoVolume, wpVideoMuted, wpVideoVolume, videoLoop
} from './usePersist'
import { videoEl, videoElProgress, videoElDuration, videoPlaying } from './usePlaybackState'
export { videoEl, videoElProgress, videoElDuration, videoPlaying }
import { currentWallpaper, wpMediaInfo } from './useThemeWallpaper'
import { displayMode } from './useVisualState'
import { videoType, mediaVisualItem, mediaVisualOn } from './useSourceState'
import { mediaUrl } from '../utils/media'
import { saveVideoProgress, restoreVideoProgress, clearVideoProgress } from './useProgressStore'
import { stopMediaImgTimer } from './useMediaImg'

export const visualItemW = ref(0)
export const visualItemH = ref(0)
export const videoSnapshots = ref({ wallpaper: '', media: '' })

function applyVideoProps(el, owner) {
  if (owner === 'media') {
    el.volume = mediaVideoVolume.value / 100
    el.muted = mediaVideoMuted.value
    el.loop = false
  } else if (owner === 'wallpaper') {
    el.volume = wpVideoVolume.value / 100
    el.muted = wpVideoMuted.value
    el.loop = videoLoop.value
  }
}

function trySyncVideoPlay() {
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

function syncVideoEls() {
  const el = videoEl.value
  if (!el) return
  const owner = videoType.value
  applyVideoProps(el, owner)
  if (videoPaused.value) el.pause()
  else el.play()?.catch(() => {})
}

export function loadVisualVideo(item) {
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
  el.loop = false
}

watch(videoType, (owner, prevOwner) => {
  if (!owner) return
  nextTick(() => {
    const curEl = videoEl.value
    if (!curEl) return
    const w = curEl.videoWidth || curEl.naturalWidth || 0
    const h = curEl.videoHeight || curEl.naturalHeight || 0
    applyVideoProps(curEl, owner)
    if (owner === 'media') {
      videoElDuration.value = curEl.duration || 0
      if (w && h) visualItemW.value = w; visualItemH.value = h
    } else {
      if (w && h) { visualItemW.value = w; visualItemH.value = h; wpMediaInfo.value = { w, h } }
    }
    trySyncVideoPlay()
  })
}, { immediate: true })

watch([videoPaused, mediaVideoVolume, mediaVideoMuted], () => {
  const el = videoEl.value
  if (!el || videoType.value !== 'media') return
  el.volume = mediaVideoVolume.value / 100
  el.muted = mediaVideoMuted.value
  el.loop = false
  if (videoPaused.value) el.pause()
  else el.play()?.catch(() => {})
})

watch([videoPaused, wpVideoVolume, wpVideoMuted, videoLoop], () => {
  const el = videoEl.value
  if (!el || videoType.value !== 'wallpaper') return
  el.volume = wpVideoVolume.value / 100
  el.muted = wpVideoMuted.value
  el.loop = videoLoop.value
  if (videoPaused.value) el.pause()
  else el.play()?.catch(() => {})
})

watch(
  videoEl,
  (el) => {
    if (!el) return
    el.addEventListener('timeupdate', saveVideoProgress)
    el.addEventListener('loadedmetadata', () => {
      videoElDuration.value = el.duration || 0
      restoreVideoProgress(el)
    })
    el.addEventListener('loadeddata', trySyncVideoPlay)
    el.addEventListener('canplay', trySyncVideoPlay)
    el.addEventListener('playing', () => { videoPlaying.value = true })
    const syncPlayState = () => { videoPlaying.value = !el.paused }
    el.addEventListener('play', syncPlayState)
    el.addEventListener('pause', syncPlayState)
    el.addEventListener('ended', () => { videoPlaying.value = false })
    el.addEventListener('error', () => { videoPlaying.value = false })
    el.addEventListener('volumechange', () => {
      const owner = videoType.value
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
  () => currentWallpaper.value?.url,
  () => {
    if (!mediaVisualOn.value) {
      visualItemW.value = 0
      visualItemH.value = 0
    }
    videoSnapshots.value = { ...videoSnapshots.value, wallpaper: '', wallpaper_url: '' }
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
  if (toWp || toMedia) {
    videoSnapshots.value = { ...videoSnapshots.value, media: '', media_url: '' }
    return
  }
  visualItemW.value = 0
  visualItemH.value = 0
  videoSnapshots.value = { ...videoSnapshots.value, media: '', media_url: '' }
})

watch(
  () => [videoType.value, displayMode.value],
  ([owner, dm]) => {
    if (owner === 'media' && dm === 'stretch') displayMode.value = 'fill'
  },
  { immediate: true }
)

watch(
  [mediaVisualSource, () => mediaVisualItem.value],
  ([newKey]) => {
    if (!newKey) { stopMediaImgTimer(); return }
    const src = newKey.src
    const type = newKey.type
    const item = sourceStates[src]?.[type]?.selectedItem.value
    if (!item) return
    if (type === 'video') loadVisualVideo(item)
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
    clearVideoProgress()
    const el = videoEl.value
    if (el) el.currentTime = 0
  }
)