import { watch } from 'vue'
import {
  sourceStates, visualSourceKey, audioSourceKey, audioPaused,
  mediaAudioVolume, mediaAudioMuted
} from './usePersist'
import { applySeek, stopSlideTimer, loadAudioMusic, loadVisualVideo, loadVisualSlideshow } from './usePlaybackLifecycle'
import { visualItem } from './useVisualOwner'
import { audioItem } from './useAudioOwner'
import { syncAudioEls } from './useVideoElement'
import { mediaVideoEl, mediaAudioEl } from './usePlaybackState'

watch([visualSourceKey, () => visualItem.value], ([newKey]) => {
  if (!newKey) { stopSlideTimer(); return }
  const [src, type] = newKey.split('-')
  const item = sourceStates[src]?.[type]?.selectedItem.value
  if (!item) return
  if (type === 'video') loadVisualVideo(item)
  else if (type === 'image') loadVisualSlideshow(item)
}, { immediate: true })

watch([audioSourceKey, () => audioItem.value], ([newKey]) => {
  if (!newKey) return
  const [src, type] = newKey.split('-')
  const item = sourceStates[src]?.[type]?.selectedItem.value
  if (!item) return
  if (type === 'music') loadAudioMusic(item)
}, { immediate: true })

watch(audioPaused, () => {
  if (!audioItem.value) return
  syncAudioEls()
})

watch(mediaAudioVolume, () => {
  if (mediaAudioEl.value) mediaAudioEl.value.volume = mediaAudioVolume.value / 100
})
watch(mediaAudioMuted, () => {
  if (mediaAudioEl.value) mediaAudioEl.value.muted = mediaAudioMuted.value
})

function watchProg(srcKey, elRef) {
  watch(
    [() => srcKey.value, () => {
      if (!srcKey.value) return null
      const [src, type] = srcKey.value.split('-')
      return sourceStates[src]?.[type]?.currentTime?.value || null
    }],
    ([key, prog]) => {
      if (!key || !prog || !prog.time || prog.time <= 0) return
      const el = elRef.value
      if (!el) return
      if (el.currentTime && Math.abs(el.currentTime - prog.time) < 1) return
      if (!Number.isFinite(el.duration) || el.duration <= 0) {
        const h = () => { applySeek(el, prog, false); el.removeEventListener('loadedmetadata', h) }
        el.addEventListener('loadedmetadata', h)
        return
      }
      applySeek(el, prog, false)
    }
  )
}
watchProg(visualSourceKey, mediaVideoEl)
watchProg(audioSourceKey, mediaAudioEl)