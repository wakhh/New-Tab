import { computed } from 'vue'
import { sourceStates, visualSourceKey, _displayModeVideo, _displayModeImage, _desktopAlignVideo, _desktopAlignImage, _desktopAnchorVideo, _desktopAnchorImage } from './usePersist'
import { currentWallpaper } from './useWallpaper'

function _isVideoVisual() {
  const k = visualSourceKey.value
  if (k) return k.endsWith('-video')
  return !!currentWallpaper.value?.isVideo
}

export const displayMode = computed({
  get() {
    return _isVideoVisual() ? _displayModeVideo.value : _displayModeImage.value
  },
  set(v) {
    if (_isVideoVisual()) _displayModeVideo.value = v
    else _displayModeImage.value = v
  }
})

export const desktopAlign = computed({
  get() {
    return _isVideoVisual() ? _desktopAlignVideo.value : _desktopAlignImage.value
  },
  set(v) {
    if (_isVideoVisual()) _desktopAlignVideo.value = v
    else _desktopAlignImage.value = v
  }
})

export const desktopAnchor = computed({
  get() {
    return _isVideoVisual() ? _desktopAnchorVideo.value : _desktopAnchorImage.value
  },
  set(v) {
    if (_isVideoVisual()) _desktopAnchorVideo.value = v
    else _desktopAnchorImage.value = v
  }
})

export function resolveOwnedItem(srcKey) {
  if (!srcKey) return null
  const [src, type] = srcKey.split('-')
  const st = sourceStates[src]?.[type]
  if (!st) return null
  return st.selectedItem.value || null
}

export const visualItem = computed(() => resolveOwnedItem(visualSourceKey.value))

export const slideshowOn = computed(() => visualItem.value?.type === 'image')
export const videoOn = computed(() => visualItem.value?.type === 'video')
export const mediaActive = computed(() => !!(slideshowOn.value || videoOn.value))

export const visualOwner = computed(() => {
  if (videoOn.value) return 'media-video'
  if (slideshowOn.value) return 'slideshow'
  const cur = currentWallpaper.value
  const mode = displayMode.value
  if (cur?.isVideo) return 'wallpaper-video'
  if (cur && !cur.isVideo && mode !== 'tile') return 'wallpaper-image'
  return 'none'
})

export const videoOwner = computed(() => {
  if (visualOwner.value === 'media-video') return 'media'
  if (visualOwner.value === 'wallpaper-video') return 'wallpaper'
  return null
})

export const imageOwner = computed(() => {
  if (visualOwner.value === 'slideshow') return 'slideshow'
  if (visualOwner.value === 'wallpaper-image') return 'wallpaper'
  return null
})

export const visualIsVideo = computed(() => !!(videoOwner.value))
export const visualIsImage = computed(() => !!(imageOwner.value))