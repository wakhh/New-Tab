import {
  sourceStates, visualSourceKey, audioSourceKey, visualPaused, audioPaused,
  wpVideoPlaying, wpVideoProgress, wpVideoMuted, videoLoop, selectedSourceKey,
  wpVideoVolume, mediaVideoMuted, mediaVideoVolume, mediaAudioMuted, mediaAudioVolume,
  MEDIA_SOURCES, MEDIA_TYPES, networkFiles
} from './usePersist'
import { itemKey, itemSourceKeyOf } from '../utils/media'
import {
  MODES, DIR, PLAY_MODES, pickNextItem, pickPrioritySourceKey, stateOfItem, listOf, modeForKey
} from './usePlaybackEngine'
import { navigate, replay, stopSource } from './usePlaybackLifecycle'
import { mediaLocalFiles } from './useMediaLists'
import { centerIcon } from './useFloatIcon'
import { currentWallpaper } from './useWallpaper'

const _imagePlayModeCache = new Map()

function resolveTarget(which, { audioFirst = false } = {}) {
  if (which) return which
  const vsk = visualSourceKey.value
  const ask = audioSourceKey.value
  const visualCands = vsk ? ['media-visual'] : []
  if (currentWallpaper.value?.isVideo) visualCands.push('wp-video')
  const audioCands = ask ? ['media-audio'] : []
  const order = audioFirst ? [...audioCands, ...visualCands] : [...visualCands, ...audioCands]
  return order[0] || null
}

function navTargetSrcKey(which) {
  if (which === 'media-audio') return audioSourceKey.value
  if (which === 'media-visual') return visualSourceKey.value
  if (which === 'wp-video') return null
  return pickPrioritySourceKey({
    selectedKey: selectedSourceKey.value,
    visualKey: visualSourceKey.value,
    audioKey: audioSourceKey.value
  })
}

function _stateOfSrcKey(srcKey) {
  if (!srcKey) return null
  const [src, type] = srcKey.split('-')
  return sourceStates[src]?.[type] || null
}

export function playbackToggle(which, opts = {}) {
  const target = resolveTarget(which, opts)
  if (!target) return

  if (target === 'wp-video') {
    wpVideoPlaying.set(!wpVideoPlaying.value)
    if (!opts.skipIcon) {
      centerIcon.value = wpVideoPlaying.value ? '⏸' : '▶'
      setTimeout(() => { centerIcon.value = null }, 300)
    }
    return
  }

  const isAudio = target === 'media-audio'
  const srcKey = isAudio ? audioSourceKey.value : visualSourceKey.value
  if (!srcKey) return
  const st = _stateOfSrcKey(srcKey)
  if (!st) return

  const [, type] = srcKey.split('-')

  if (!isAudio && type === 'image') {
    const curMode = st.playMode.value
    if (curMode === MODES.SINGLE_PLAY) {
      const restored = _imagePlayModeCache.get(srcKey) || MODES.ORDER_LOOP
      st.playMode.set(restored)
      visualPaused.set(false)
      if (!opts.skipIcon) centerIcon.value = '⏸'
    } else {
      _imagePlayModeCache.set(srcKey, curMode)
      st.playMode.set(MODES.SINGLE_PLAY)
      visualPaused.set(true)
      if (!opts.skipIcon) centerIcon.value = '▶'
    }
    if (!opts.skipIcon) setTimeout(() => { centerIcon.value = null }, 300)
    return
  }

  const pausedRef = isAudio ? audioPaused : visualPaused
  pausedRef.set(!pausedRef.value)
  if (!opts.skipIcon) {
    centerIcon.value = pausedRef.value ? '▶' : '⏸'
    setTimeout(() => { centerIcon.value = null }, 300)
  }
}

export function playbackStop(which) {
  const doStop = (pausedRef, srcKeyRef) => {
    const srcKey = srcKeyRef.value
    if (!srcKey) return false
    stopSource(srcKey)
    srcKeyRef.set(null)
    return true
  }

  if (which === 'media-visual' || which === 'visual') {
    const ok = doStop(visualPaused, visualSourceKey)
    if (ok) { centerIcon.value = '⏹'; setTimeout(() => { centerIcon.value = null }, 300); return true }
  }
  if (which === 'media-audio' || which === 'audio') {
    const ok = doStop(audioPaused, audioSourceKey)
    if (ok) { centerIcon.value = '⏹'; setTimeout(() => { centerIcon.value = null }, 300); return true }
  }
  if (which === 'wp-video' || which === 'wp') {
    if (!currentWallpaper.value?.isVideo) return false
    wpVideoPlaying.set(false)
    wpVideoProgress.set({ key: '', time: 0 })
    centerIcon.value = '⏹'
    setTimeout(() => { centerIcon.value = null }, 300)
    return true
  }

  let stopped = false
  if (audioSourceKey.value) stopped = playbackStop('media-audio') || stopped
  if (visualSourceKey.value) stopped = playbackStop('media-visual') || stopped
  if (!stopped && currentWallpaper.value?.isVideo) stopped = playbackStop('wp-video')
  return stopped
}

export function playbackNav(dir, which) {
  const srcKey = navTargetSrcKey(which)
  if (!srcKey) return false

  const st = _stateOfSrcKey(srcKey)
  if (!st) return false

  const curItem = st.selectedItem.value
  const target = pickNextItem(srcKey, curItem, dir, st.playMode.value, st.playDirection.value)
  if (!target) return false

  st.playDirection.set(dir === 'prev' ? DIR.BACKWARD : DIR.FORWARD)

  navigate(srcKey, target)
  return true
}

export function playbackCycleMode(which) {
  const cycleKey = (srcKey) => {
    const st = _stateOfSrcKey(srcKey)
    if (!st) return false
    const cur = st.playMode.value || MODES.ORDER_LOOP
    const idx = PLAY_MODES.indexOf(cur)
    const next = PLAY_MODES[(idx + 1) % PLAY_MODES.length]
    st.playMode.set(next)
    const [, type] = srcKey.split('-')
    if (type === 'image' && next !== MODES.SINGLE_PLAY) {
      _imagePlayModeCache.set(srcKey, next)
    }
    return true
  }

  if (which === 'wp-video' || which === 'wp') {
    if (currentWallpaper.value?.isVideo) { videoLoop.set(!videoLoop.value); return true }
    return false
  }
  if (which === 'media-visual' || which === 'visual') return cycleKey(visualSourceKey.value)
  if (which === 'media-audio' || which === 'audio') return cycleKey(audioSourceKey.value)

  if (cycleKey(visualSourceKey.value)) return true
  if (cycleKey(audioSourceKey.value)) return true
  if (currentWallpaper.value?.isVideo) { videoLoop.set(!videoLoop.value); return true }
  return false
}

export function playbackCycleDirection(which) {
  const flip = (srcKey) => {
    const st = _stateOfSrcKey(srcKey)
    if (!st) return false
    st.playDirection.set(st.playDirection.value === DIR.BACKWARD ? DIR.FORWARD : DIR.BACKWARD)
    return true
  }

  if (which === 'media-visual' || which === 'visual') return flip(visualSourceKey.value)
  if (which === 'media-audio' || which === 'audio') return flip(audioSourceKey.value)

  if (flip(visualSourceKey.value)) return true
  if (flip(audioSourceKey.value)) return true
  return false
}

export function playbackSeek(t, which) {
  let srcKey = null
  if (which === 'media-visual') srcKey = visualSourceKey.value
  else if (which === 'media-audio') srcKey = audioSourceKey.value
  else srcKey = visualSourceKey.value || audioSourceKey.value
  if (!srcKey) return
  const st = _stateOfSrcKey(srcKey)
  if (!st) return
  const item = st.selectedItem.value
  if (!item || !Number.isFinite(t)) return
  st.currentTime.set({ key: itemKey(item), time: Math.max(0, Math.round(t)) })
}

const lastVolume = { wp: null, 'media-video': null, 'media-audio': null }
const VOLUME_BINDINGS = {
  'wp': { muted: wpVideoMuted, volume: wpVideoVolume },
  'media-video': { muted: mediaVideoMuted, volume: mediaVideoVolume },
  'media-audio': { muted: mediaAudioMuted, volume: mediaAudioVolume }
}

export function playbackToggleMute(which) {
  const b = VOLUME_BINDINGS[which]
  if (!b) return
  if (!b.muted.value) {
    lastVolume[which] = b.volume.value
    b.volume.set(0); b.muted.set(true)
  } else {
    b.volume.set(lastVolume[which] ?? 30); b.muted.set(false)
  }
}

export function playbackSetVolume(val, which) {
  const b = VOLUME_BINDINGS[which]
  if (!b) return
  const n = Math.max(0, Math.min(100, Math.round(Number(val) || 0)))
  if (n === 0) b.muted.set(true); else if (b.muted.value) b.muted.set(false)
  b.volume.set(n); return n
}

export function playbackMuteAll(muted) {
  wpVideoMuted.set(muted); mediaVideoMuted.set(muted); mediaAudioMuted.set(muted)
}

export function playbackAdjustVolume(delta) {
  wpVideoVolume.set(Math.max(0, Math.min(100, wpVideoVolume.value + delta)))
  mediaVideoVolume.set(Math.max(0, Math.min(100, mediaVideoVolume.value + delta)))
  mediaAudioVolume.set(Math.max(0, Math.min(100, mediaAudioVolume.value + delta)))
}

export function playbackCycleMediaType() {
  const key = selectedSourceKey.value || 'local-image'
  const [src, type] = key.split('-')
  const nextType = MEDIA_TYPES[(MEDIA_TYPES.indexOf(type) + 1) % MEDIA_TYPES.length]
  const nextKey = `${src}-${nextType}`
  if (sourceStates[src]?.[nextType]) selectedSourceKey.set(nextKey)
}

export function playbackCycleMediaSource() {
  const key = selectedSourceKey.value || 'local-image'
  const [src, type] = key.split('-')
  const nextSrc = MEDIA_SOURCES[(MEDIA_SOURCES.indexOf(src) + 1) % MEDIA_SOURCES.length]
  const nextKey = `${nextSrc}-${type}`
  if (sourceStates[nextSrc]?.[type]) selectedSourceKey.set(nextKey)
}

export function playbackCycleFolder() {
  const key = selectedSourceKey.value || 'local-image'
  const [src, type] = key.split('-')
  const st = sourceStates[src]?.[type]
  if (!st) return

  const raw = src === 'local' ? mediaLocalFiles.value : networkFiles.value
  const list = raw.filter((f) => f.type === type)
  let folders
  if (src === 'local') {
    const roots = [], subs = []
    for (const f of list) {
      const k = f.path2 ? f.path1 + '/' + f.path2 : f.path1
      const arr = f.path2 ? subs : roots
      if (!arr.includes(k)) arr.push(k)
    }
    folders = ['all', ...roots, ...subs]
  } else {
    const sites = []
    for (const f of list) {
      if (f.site && !sites.includes(f.site)) sites.push(f.site)
    }
    folders = ['all', ...sites]
  }

  if (folders.length <= 1) return
  const cur = st.folder.value
  const idx = folders.indexOf(cur)
  st.folder.set(folders[(idx + 1) % folders.length])
}

export function playbackSelectItem(item) {
  if (!item) return
  const srcKey = itemSourceKeyOf(item)
  if (!srcKey) return
  const [src, type] = srcKey.split('-')
  const st = sourceStates[src]?.[type]
  if (!st) return
  const curItem = st.selectedItem.value
  const sameItem = curItem && itemKey(curItem) === itemKey(item)

  if (sameItem) {
    if (type === 'music') audioPaused.set(false)
    else visualPaused.set(false)
  } else {
    if (st.playMode.value !== MODES.SHUFFLE && curItem) {
      const list = listOf(srcKey)
      const curIdx = list.findIndex(it => itemKey(it) === itemKey(curItem))
      const tgtIdx = list.findIndex(it => itemKey(it) === itemKey(item))
      if (curIdx >= 0 && tgtIdx >= 0 && Math.abs(tgtIdx - curIdx) === 1) {
        st.playDirection.set(tgtIdx > curIdx ? DIR.FORWARD : DIR.BACKWARD)
      }
    }
    navigate(srcKey, item)
  }

  if (type === 'image' || type === 'video') visualSourceKey.set(srcKey)
  else audioSourceKey.set(srcKey)
}

export function playbackResetForWallpaper() {
  visualSourceKey.set(null)
}