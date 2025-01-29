import { mediaVideoEl, mediaAudioEl } from './usePlaybackState'
import { videoOwner } from './useVisualOwner'
import { playbackNav, playbackSeek } from './usePlaybackActions'
import { visualSourceKey, audioSourceKey, selectedSourceKey, wpVideoProgress } from './usePersist'
import { currentWallpaper, wpVideoKey } from './useWallpaper'
import { showFloatIcon } from './useFloatIcon'

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
  e.preventDefault()
  if (wheelCooldown) return
  wheelCooldown = true
  setTimeout(() => { wheelCooldown = false }, 150)

  const isNext = e.deltaY > 0

  if (videoOwner.value === 'media') {
    const el = mediaVideoEl.value
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      _seekOrNav(el, 'media-visual', isNext ? 30 : -30, 'media-visual')
      return
    }
  }

  const sel = selectedSourceKey.value
  if (sel) {
    const [, type] = sel.split('-')
    if (type === 'video' && visualSourceKey.value === sel) {
      const el = mediaVideoEl.value
      if (el && Number.isFinite(el.duration) && el.duration > 0) {
        _seekOrNav(el, 'media-visual', isNext ? 30 : -30, 'media-visual')
        return
      }
    }
    if (type === 'music' && audioSourceKey.value === sel) {
      const el = mediaAudioEl.value
      if (el && Number.isFinite(el.duration) && el.duration > 0) {
        _seekOrNav(el, 'media-audio', isNext ? 30 : -30, 'media-audio')
        return
      }
    }
  }

  if (audioSourceKey.value) {
    const el = mediaAudioEl.value
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      _seekOrNav(el, 'media-audio', isNext ? 30 : -30, 'media-audio')
      return
    }
  }

  if (visualSourceKey.value) {
    const [, vtype] = visualSourceKey.value.split('-')
    if (vtype === 'image') {
      playbackNav(isNext ? 'next' : 'prev', 'media-visual')
      return
    }
  }

  if (currentWallpaper.value?.isVideo) {
    const el = mediaVideoEl.value
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      const dur = el.duration
      const cur = el.currentTime
      const delta = isNext ? 3 : -3
      let next = cur + delta
      if (delta < 0) next = Math.max(0, next)
      else next = Math.min(next, dur)
      if (next !== cur) {
        el.currentTime = next
        wpVideoProgress.set({ key: wpVideoKey(), time: next })
        showFloatIcon(isNext ? '»' : '«')
      }
    }
  }
}