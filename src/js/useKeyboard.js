import {
  settingsOpen,
  selectedSourceKey,
  visualSourceKey,
  audioSourceKey,
  wpVideoPlaying, wpVideoProgress,
  visualPaused, audioPaused,
  wpVideoMuted, mediaVideoMuted, mediaAudioMuted,
  autoHide,
  sourceStates
} from './usePersist'
import { mediaVideoEl, mediaAudioEl } from './usePlaybackState'
import { currentWallpaper, wpVideoKey } from './useWallpaper'
import { cycleTheme } from './useTheme'
import { centerIcon, seekIcon } from './useFloatIcon'
import { displayMode } from './useVisualOwner'
import {
  playbackToggle, playbackStop, playbackNav, playbackCycleMode, playbackCycleDirection,
  playbackMuteAll, playbackAdjustVolume, playbackSeek,
  playbackCycleMediaType, playbackCycleMediaSource, playbackCycleFolder, playbackSelectItem
} from './usePlaybackActions'
import { setDisplayMode } from './useLayoutMode'

function isSeekableEl(el) {
  if (!el) return false
  if (!Number.isFinite(el.duration) || el.duration <= 0) return false
  if (el.error) return false
  return true
}

function getSeekTarget() {
  const sel = selectedSourceKey.value
  if (sel) {
    const [src, type] = sel.split('-')
    if (type === 'video' || type === 'music') {
      const el = type === 'video' ? mediaVideoEl.value : mediaAudioEl.value
      if (isSeekableEl(el)) return { which: type === 'video' ? 'media-visual' : 'media-audio', el }
    }
  }
  const vsk = visualSourceKey.value
  if (vsk) {
    const [, vtype] = vsk.split('-')
    if (vtype === 'video') {
      const el = mediaVideoEl.value
      if (isSeekableEl(el)) return { which: 'media-visual', el }
    }
  }
  const ask = audioSourceKey.value
  if (ask) {
    const el = mediaAudioEl.value
    if (isSeekableEl(el)) return { which: 'media-audio', el }
  }
  if (currentWallpaper.value?.isVideo) {
    const el = mediaVideoEl.value
    if (el && !el.error && Number.isFinite(el.duration)) return { which: 'wp-video', el }
  }
  return null
}

function showSeekIcon(dir) {
  seekIcon.value = { dir, key: Date.now() }
}

function doSeek(target, delta) {
  const el = target.el
  if (!el) return { ok: false, hitBoundary: false }
  const dur = el.duration
  const cur = el.currentTime
  if (delta > 0 && (!Number.isFinite(dur) || dur <= 0)) return { ok: false, hitBoundary: false }
  let next = cur + delta
  const hitBoundary = delta < 0 ? next <= 0 : next >= dur
  if (delta < 0) next = Math.max(0, next)
  else next = Math.min(next, dur)
  if (next === cur) return { ok: false, hitBoundary }

  if (target.which === 'wp-video') {
    el.currentTime = next
    wpVideoProgress.set({ key: wpVideoKey(), time: next })
  } else {
    playbackSeek(next, target.which)
  }
  return { ok: true, hitBoundary }
}

let _seekStepL = 0
let _seekStepR = 0
let _seekResetTimerL = 0
let _seekResetTimerR = 0

function _seekDeltaFromStep(step) {
  let d = 2
  let acc = 2
  while (step >= acc) { d++; acc += d }
  return d
}

function _doSeekStep(tgt, dir) {
  const isLeft = dir < 0
  const el = tgt.el
  if (!el) return
  const cur = el.currentTime || 0
  const dur = el.duration || 0
  const step = isLeft ? _seekStepL++ : _seekStepR++
  let delta = dir < 0 ? -_seekDeltaFromStep(step) : _seekDeltaFromStep(step)
  if (isLeft && Math.abs(delta) > cur) delta = -cur
  if (!isLeft && Number.isFinite(dur) && delta > dur - cur) delta = dur - cur
  if (delta === 0) {
    if (isLeft) _seekStepL = 0; else _seekStepR = 0
    showSeekIcon(dir); return
  }
  const res = doSeek(tgt, delta)
  showSeekIcon(dir)
  if (isLeft) clearTimeout(_seekResetTimerL); else clearTimeout(_seekResetTimerR)
  if (res.hitBoundary) {
    if (isLeft) _seekStepL = 0; else _seekStepR = 0
  }
}

function _scheduleSeekReset(dir) {
  const isLeft = dir < 0
  if (isLeft) clearTimeout(_seekResetTimerL); else clearTimeout(_seekResetTimerR)
  const t = setTimeout(() => {
    if (isLeft) _seekStepL = 0; else _seekStepR = 0
  }, 1000)
  if (isLeft) _seekResetTimerL = t; else _seekResetTimerR = t
}

let _seekThrottleLeft = 0
let _seekThrottleRight = 0

function onKeyDown(e) {
  const target = e.target
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return

  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    const tgt = getSeekTarget()
    if (!tgt) return
    const now = performance.now()
    if (!e.repeat) {
      _doSeekStep(tgt, -1)
    } else if (now - _seekThrottleLeft >= 500) {
      _seekThrottleLeft = now
      _doSeekStep(tgt, -1)
    }
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    const tgt = getSeekTarget()
    if (!tgt) return
    const now = performance.now()
    if (!e.repeat) {
      _doSeekStep(tgt, 1)
    } else if (now - _seekThrottleRight >= 500) {
      _seekThrottleRight = now
      _doSeekStep(tgt, 1)
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    playbackNav('prev')
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    playbackNav('next')
  } else if (e.key === ' ') {
    e.preventDefault(); playbackToggle(null, { audioFirst: false })
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (!visualSourceKey.value && !audioSourceKey.value) {
      const key = selectedSourceKey.value
      if (key) {
        const [src, type] = key.split('-')
        const item = sourceStates[src]?.[type]?.selectedItem.value
        if (item) playbackSelectItem(item)
      }
    } else {
      playbackToggle(null, { audioFirst: true })
    }
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault(); settingsOpen.value = !settingsOpen.value
  } else if (e.key === 'h' || e.key === 'H') {
    if (settingsOpen.value) { e.preventDefault(); autoHide.value = !autoHide.value }
  } else if (e.key === 'k' || e.key === 'K') {
    if (settingsOpen.value) { e.preventDefault(); playbackCycleMode() }
  } else if (e.key === 'j' || e.key === 'J') {
    if (settingsOpen.value) { e.preventDefault(); playbackCycleDirection() }
  } else if (e.key === 'm' || e.key === 'M') {
    e.preventDefault()
    const anyUnmuted = !wpVideoMuted.value || !mediaVideoMuted.value || !mediaAudioMuted.value
    playbackMuteAll(anyUnmuted)
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault()
    playbackAdjustVolume(-5)
  } else if (e.key === '=' || e.key === '+') {
    e.preventDefault()
    playbackAdjustVolume(5)
  } else if (e.key === 'd' || e.key === 'D') {
    e.preventDefault(); cycleTheme()
  } else if (e.key === 'z' || e.key === 'Z') {
    e.preventDefault()
    const modes = ['fill', 'fit', 'center', 'tile', 'stretch']
    const cur = displayMode.value
    const idx = modes.indexOf(cur)
    const next = modes[(idx + 1) % modes.length]
    setDisplayMode(next, false)
  } else if (e.key === 'o' || e.key === 'O') {
    e.preventDefault(); document.getElementById('wallpaper-file-input')?.click()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    if (audioSourceKey.value) playbackStop('media-audio')
    else if (visualSourceKey.value) playbackStop('media-visual')
    else if (currentWallpaper.value?.isVideo && wpVideoPlaying.value) playbackStop('wp-video')
    else if (settingsOpen.value) settingsOpen.value = false
  } else if (e.key === 'l' || e.key === 'L') {
    if (settingsOpen.value) { e.preventDefault(); playbackCycleMediaType() }
  } else if (e.key === 'f' || e.key === 'F') {
    if (settingsOpen.value) { e.preventDefault(); playbackCycleFolder() }
  } else if (e.key === 'n' || e.key === 'N') {
    if (settingsOpen.value) { e.preventDefault(); playbackCycleMediaSource() }
  }
}

window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') _scheduleSeekReset(-1)
  else if (e.key === 'ArrowRight') _scheduleSeekReset(1)
})