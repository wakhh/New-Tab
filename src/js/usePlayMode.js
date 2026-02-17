import { sourceStates, videoLoop, visualSource, musicSource } from './usePersist'
import { _stateOfSource } from './useSourceHelpers'
import { showCenterIcon } from './useFloatIcon'
import { currentWallpaper } from './useThemeWallpaper'

export const MODES = {
  ORDER: 'order',
  ORDER_LOOP: 'order-loop',
  SHUFFLE: 'shuffle',
  SINGLE_PLAY: 'single-play',
  SINGLE_LOOP: 'single-loop'
}

export const DIR = { FORWARD: 'forward', BACKWARD: 'backward' }

export const PLAY_MODES_VIDEO = [
  MODES.ORDER_LOOP,
  MODES.SHUFFLE,
  MODES.ORDER,
  MODES.SINGLE_LOOP,
  MODES.SINGLE_PLAY
]

export const PLAY_MODES_IMAGE = [
  MODES.ORDER_LOOP,
  MODES.SHUFFLE,
  MODES.ORDER,
  MODES.SINGLE_PLAY
]

export const PLAY_MODES = PLAY_MODES_VIDEO

export function getMode(key) {
  if (!key) return MODES.ORDER_LOOP
  return sourceStates?.[key.src]?.[key.type]?.playMode?.value || MODES.ORDER_LOOP
}

export function getDirection(key) {
  if (!key) return DIR.FORWARD
  return sourceStates?.[key.src]?.[key.type]?.playDirection?.value || DIR.FORWARD
}

export function playbackCycleMode(which) {
  const cycleKey = (source) => {
    const st = _stateOfSource(source)
    if (!st) return false
    const cur = st.playMode.value || MODES.ORDER_LOOP
    const type = source.type
    const modes = type === 'image' ? PLAY_MODES_IMAGE : PLAY_MODES_VIDEO
    const idx = modes.indexOf(cur)
    const next = modes[(idx + 1) % modes.length]
    st.playMode.set(next)
    return true
  }

  if (which === 'wp-video' || which === 'wp') {
    if (currentWallpaper.value?.isVideo) { videoLoop.set(!videoLoop.value); return true }
    return false
  }
  if (which === 'media-visual' || which === 'visual') return cycleKey(visualSource.value)
  if (which === 'media-music' || which === 'music') return cycleKey(musicSource.value)

  if (cycleKey(visualSource.value)) return true
  if (cycleKey(musicSource.value)) return true
  if (currentWallpaper.value?.isVideo) { videoLoop.set(!videoLoop.value); return true }
  return false
}

export function playbackCycleDirection(which) {
  const flip = (source) => {
    const st = _stateOfSource(source)
    if (!st) return false
    st.playDirection.set(st.playDirection.value === DIR.BACKWARD ? DIR.FORWARD : DIR.BACKWARD)
    return true
  }

  if (which === 'media-visual' || which === 'visual') return flip(visualSource.value)
  if (which === 'media-music' || which === 'music') return flip(musicSource.value)

  if (flip(visualSource.value)) return true
  if (flip(musicSource.value)) return true
  return false
}