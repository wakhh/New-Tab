import {
  sourceStates, visualSource, musicSource, videoPaused, musicPaused
} from './usePersist'
import { videoEl } from './useVideoElement'
import { musicEl } from './useAudioElement'
import { mediaVisualItem, musicItem } from './useSourceState'
import { MODES } from './usePlayMode'
import { _stateOfSource, resolveTarget } from './useSourceHelpers'
import { navigate } from './useItemNav'
import { showCenterIcon } from './useFloatIcon'
import { currentWallpaper } from './useThemeWallpaper'

const _imagePlayModeCache = new Map()

export function playbackToggle(which, opts = {}) {
  const target = resolveTarget(which, opts)
  if (!target) return

  if (target === 'wp-video') {
    const el = videoEl.value
    if (el && el.ended) {
      el.currentTime = 0
      videoPaused.value = false
      el.play()?.catch(() => {})
      if (!opts.skipIcon) showCenterIcon('⏸')
      return
    }
    videoPaused.value = !videoPaused.value
    if (!opts.skipIcon) showCenterIcon(videoPaused.value ? '▶' : '⏸')
    return
  }

  const isMusic = target === 'media-music'
  const source = isMusic ? musicSource.value : visualSource.value
  if (!source) return
  const st = _stateOfSource(source)
  if (!st) return

  const type = source.type

  if (!isMusic && type === 'image') {
    const cacheKey = `${source.src}-${source.type}`
    const curMode = st.playMode.value
    if (opts.forcePause) {
      if (curMode !== MODES.SINGLE_PLAY) {
        _imagePlayModeCache.set(cacheKey, curMode)
        st.playMode.set(MODES.SINGLE_PLAY)
      }
      if (!opts.skipIcon) showCenterIcon('▶')
      return
    }
    if (curMode === MODES.SINGLE_PLAY) {
      const restored = _imagePlayModeCache.get(cacheKey) || MODES.ORDER_LOOP
      st.playMode.set(restored)
      if (!opts.skipIcon) showCenterIcon('⏸')
    } else {
      _imagePlayModeCache.set(cacheKey, curMode)
      st.playMode.set(MODES.SINGLE_PLAY)
      if (!opts.skipIcon) showCenterIcon('▶')
    }
    return
  }

  const pausedRef = isMusic ? musicPaused : videoPaused
  const el = isMusic ? musicEl.value : videoEl.value
  if (el && el.ended) {
    _replayEnded(type, isMusic ? musicItem.value : mediaVisualItem.value)
    if (!opts.skipIcon) showCenterIcon('▶')
    return
  }
  pausedRef.value = !pausedRef.value
  if (!opts.skipIcon) showCenterIcon(pausedRef.value ? '▶' : '⏸')
}

function _replayEnded(type, item) {
  if (!item) return
  if (type === 'music') {
    musicPaused.value = false
    if (musicEl.value) { musicEl.value.currentTime = 0; musicEl.value.play()?.catch(() => {}) }
  } else if (type === 'video') {
    videoPaused.value = false
    if (videoEl.value) { videoEl.value.currentTime = 0; videoEl.value.play()?.catch(() => {}) }
  }
}

export function playbackStop(which) {
  const doStop = (sourceRef) => {
    const source = sourceRef.value
    if (!source) return false
    const st = sourceStates[source.src]?.[source.type]
    if (!st) return false
    sourceRef.set(null)
    return true
  }

  if (which === 'media-visual' || which === 'visual') {
    const ok = doStop(visualSource)
    if (ok) { showCenterIcon('⏹'); return true }
  }
  if (which === 'media-music' || which === 'music') {
    const ok = doStop(musicSource)
    if (ok) { showCenterIcon('⏹'); return true }
  }
  if (which === 'wp-video' || which === 'wp') {
    if (!currentWallpaper.value?.isVideo) return false
    if (videoPaused.value) return true
    videoPaused.value = true
    showCenterIcon('⏹')
    return true
  }

  let stopped = false
  if (musicSource.value) stopped = playbackStop('media-music') || stopped
  if (visualSource.value) stopped = playbackStop('media-visual') || stopped
  if (!stopped && currentWallpaper.value?.isVideo) stopped = playbackStop('wp-video')
  return stopped
}