import { ref, watch } from 'vue'
import { sourceStates, musicSource, musicPaused, mediaMusicVolume, mediaMusicMuted } from './usePersist'
import { musicEl, musicElProgress, musicElDuration, musicPlaying } from './usePlaybackState'
export { musicEl, musicElProgress, musicElDuration, musicPlaying }
import { musicItem } from './useSourceState'
import { saveMusicProgress, restoreMusicProgress, clearMusicProgress } from './useProgressStore'
import { itemId, sourceOf } from '../utils/media'

export function syncMusicEls(el) {
  if (!el) el = musicEl.value
  if (!el) return
  el.volume = mediaMusicVolume.value / 100
  el.muted = mediaMusicMuted.value
  if (musicPaused.value) el.pause()
  else el.play()?.catch(() => {})
}

export function loadMusicMusic(item) {
  if (!item || item.type !== 'music') return
  musicElProgress.value = 0
  musicElDuration.value = 0
}

watch(
  musicEl,
  (el) => {
    if (!el) return
    const syncPlayState = () => {
      musicPlaying.value = !el.paused
    }
    el.addEventListener('timeupdate', saveMusicProgress)
    el.addEventListener('loadedmetadata', () => {
      musicElDuration.value = el.duration || 0
      const item = musicItem.value
      if (item) restoreMusicProgress(el, itemId(item))
    })
    el.addEventListener('loadeddata', () => {
      if (!musicPaused.value) el.play()?.catch(() => {})
    })
    el.addEventListener('canplay', () => {
      if (!musicPaused.value && el.paused) el.play()?.catch(() => {})
    })
    el.addEventListener('play', syncPlayState)
    el.addEventListener('pause', syncPlayState)
    el.addEventListener('ended', () => {
      musicPlaying.value = false
    })
    el.addEventListener('error', () => {
      musicPlaying.value = false
    })
    el.addEventListener('volumechange', () => {
      mediaMusicVolume.value = Math.round(el.volume * 100)
      mediaMusicMuted.value = el.muted
    })
    syncMusicEls(el)
  }
)

watch(musicPaused, () => {
  if (!musicItem.value) return
  syncMusicEls()
})

watch(mediaMusicVolume, () => {
  if (musicEl.value) musicEl.value.volume = mediaMusicVolume.value / 100
})

watch(mediaMusicMuted, () => {
  if (musicEl.value) musicEl.value.muted = mediaMusicMuted.value
})

watch(
  [musicSource, () => musicItem.value],
  ([newKey]) => {
    if (!newKey) return
    const src = newKey.src
    const type = newKey.type
    const item = sourceStates[src]?.[type]?.selectedItem.value
    if (!item) return
    if (type === 'music') loadMusicMusic(item)
  },
  { immediate: true }
)

watch(
  () => musicItem.value ? { key: itemId(musicItem.value), source: sourceOf(musicItem.value) } : null,
  (cur, prev) => {
    if (!cur || !prev || cur.key === prev.key) return
    clearMusicProgress()
    const el = musicEl.value
    if (el) el.currentTime = 0
  }
)