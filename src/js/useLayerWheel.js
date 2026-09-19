import { videoEl } from './useVideoElement'
import { musicEl } from './useAudioElement'
import { videoType } from './useSourceState'
import { playbackNav } from './useItemNav'
import { playbackSeek } from './useProgressStore'
import { selectedSource, mediaVisualSource, musicSource } from './usePersist'
import { currentWallpaper, wpVideoKey } from './useThemeWallpaper'
import { showFloatIcon } from './useFloatIcon'
import { sourceEquals } from '../utils/media'

let wheelCooldown = false

function _seekOrNav(el, which, delta, navWhich) {
  const dur = el.duration || 0
  const cur = el.currentTime || 0
  if (dur <= 0) return

  if (delta > 0) {
    const remain = dur - cur
    if (remain <= 30) { playbackNav('next', navWhich); return }
    playbackSeek(Math.min(dur - 0.1, cur + 30), which)
    showFloatIcon('»')
  } else {
    if (cur <= 30) { playbackNav('prev', navWhich); return }
    playbackSeek(Math.max(0, cur - 30), which)
    showFloatIcon('«')
  }
}

export function onLayerWheel(e) {
  const isNext = e.deltaY > 0

  e.preventDefault()
  if (wheelCooldown) return
  wheelCooldown = true
  setTimeout(() => { wheelCooldown = false }, 150)

  if (videoType.value === 'media') {
    const el = videoEl.value
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      _seekOrNav(el, 'media-visual', isNext ? 30 : -30, 'media-visual')
      return
    }
  }

  const sel = selectedSource.value
  if (sel) {
    const type = sel.type
    if (type === 'video' && sourceEquals(sel, mediaVisualSource.value)) {
      const el = videoEl.value
      if (el && Number.isFinite(el.duration) && el.duration > 0) {
        _seekOrNav(el, 'media-visual', isNext ? 30 : -30, 'media-visual')
        return
      }
    }
    if (type === 'music' && sourceEquals(sel, musicSource.value)) {
      const el = musicEl.value
      if (el && Number.isFinite(el.duration) && el.duration > 0) {
        _seekOrNav(el, 'media-music', isNext ? 30 : -30, 'media-music')
        return
      }
    }
  }

  if (musicSource.value) {
    const el = musicEl.value
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      _seekOrNav(el, 'media-music', isNext ? 30 : -30, 'media-music')
      return
    }
  }

  if (mediaVisualSource.value) {
    const vtype = mediaVisualSource.value.type
    if (vtype === 'image') {
      playbackNav(isNext ? 'next' : 'prev', 'media-visual')
      return
    }
  }

  if (currentWallpaper.value?.isVideo) {
    const el = videoEl.value
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      const dur = el.duration
      const cur = el.currentTime
      const delta = isNext ? 3 : -3
      let next = cur + delta
      if (delta < 0) next = Math.max(0, next)
      else next = Math.min(next, dur)
      if (next !== cur) {
        el.currentTime = next
        showFloatIcon(isNext ? '»' : '«')
      }
    }
  }
}