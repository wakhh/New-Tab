import { computed } from 'vue'
import { sourceStates, visualSource,musicSource } from './usePersist'
import { currentWallpaper } from './useThemeWallpaper'
import { displayMode } from './useVisualState'

export function resolveOwnedItem(source) {
  if (!source) return null
  const st = sourceStates[source.src]?.[source.type]
  if (!st) return null
  return st.selectedItem.value || null
}

export const mediaVisualItem = computed(() => resolveOwnedItem(visualSource.value))

export const mediaImgOn = computed(() => mediaVisualItem.value?.type === 'image')
export const mediaVideoOn = computed(() => mediaVisualItem.value?.type === 'video')
export const mediaVisualOn = computed(() => !!(mediaImgOn.value || mediaVideoOn.value))

export const visualType = computed(() => {
  if (mediaVideoOn.value) return 'media-video'
  if (mediaImgOn.value) return 'media-img'
  const cur = currentWallpaper.value
  const mode = displayMode.value
  if (cur?.isVideo) return 'wallpaper-video'
  if (cur && !cur.isVideo && mode !== 'tile') return 'wallpaper-image'
  return 'none'
})

export const videoType = computed(() => {
  if (visualType.value === 'media-video') return 'media'
  if (visualType.value === 'wallpaper-video') return 'wallpaper'
  return null
})

export const imgType = computed(() => {
  if (visualType.value === 'media-img') return 'media'
  if (visualType.value === 'wallpaper-image') return 'wallpaper'
  return null
})

export const videoOn = computed(() => !!(videoType.value))
export const imageOn = computed(() => !!(imgType.value))

export const musicItem = computed(() => {
  const key = musicSource.value
  if (!key) return null
  return sourceStates[key.src]?.[key.type]?.selectedItem.value || null
})

export const musicOn = computed(() => musicItem.value?.type === 'music')