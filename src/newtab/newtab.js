import { createApp } from 'vue'
import { watch } from 'vue'
import App from './newtab.vue'
import '../css/app.css'
import '../css/ui.css'
import {
  themeSystemDark, cycleTheme, currentWallpaper, displayMode, videoEl, musicEl, setDisplayMode, showSeekIcon, mediaImgOn, mediaVisualOn,
  playbackNav, playbackSelectItem,
  playbackCycleMediaType, playbackCycleMediaSource, playbackCycleFolder, displayLists,
  playbackToggle, playbackStop, playbackCycleMode, playbackCycleDirection,
  playbackSeek, playbackMuteAll, playbackAdjustVolume, itemId,
  tileVideoCount, maxTileCount, clearOldTileVideoCount, videoOn
} from '../js/core'
import {
  settingsOpen, _settingsSkipPersist, selectedSource, mediaVisualSource,
  IS_POPUP, musicSource, autoHide, sourceStates
} from '../js/persist'

// ====== 扩展图标绘制 ======
const SIZES = [16, 32, 48, 128]

function draw(size, fg) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  const pad = size * 0.13
  const inner = size - pad * 2
  const cell = inner / 3
  const r = cell * 0.34
  ctx.fillStyle = fg
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = pad + col * cell + cell / 2
      const y = pad + row * cell + cell / 2
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return c
}

function applyExtIcon() {
  const fg = themeSystemDark.value ? '#f5f5f5' : '#1a1a1a'
  const details = {}
  for (const s of SIZES) {
    details[s] = draw(s, fg).getContext('2d').getImageData(0, 0, s, s)
  }
  if (typeof chrome !== 'undefined' && chrome.action) {
    try { chrome.action.setIcon({ imageData: details }) } catch {}
  }
  try {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.href = draw(32, fg).toDataURL('image/png')
    const old = document.querySelector('link[rel="icon"]')
    if (old) old.remove()
    document.head.appendChild(link)
  } catch {}
}

watch(themeSystemDark, applyExtIcon, { immediate: true })

// ====== 媒体 seek（带加速步进） ======
function isSeekableEl(el) {
  if (!el) return false
  if (!Number.isFinite(el.duration) || el.duration <= 0) return false
  if (el.error) return false
  return true
}

function getSeekTarget() {
  const sel = selectedSource.value
  if (sel) {
    const type = sel.type
    if (type === 'video' || type === 'music') {
      const el = type === 'video' ? videoEl.value : musicEl.value
      if (isSeekableEl(el)) return { which: type === 'video' ? 'media-visual' : 'media-music', el }
    }
  }
  const vsk = mediaVisualSource.value
  if (vsk) {
    if (vsk.type === 'video') {
      const el = videoEl.value
      if (isSeekableEl(el)) return { which: 'media-visual', el }
    }
  }
  const ask = musicSource.value
  if (ask) {
    const el = musicEl.value
    if (isSeekableEl(el)) return { which: 'media-music', el }
  }
  if (currentWallpaper.value?.isVideo) {
    const el = videoEl.value
    if (el && !el.error && Number.isFinite(el.duration)) return { which: 'wp-video', el }
  }
  return null
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

// ====== 全局键盘监听 ======
function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  const target = e.target
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return

  // ====== 播放控制（全局） ======
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    playbackNav('next')
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    playbackNav('prev')
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    if (mediaImgOn.value) { playbackNav('prev'); return }
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
    if (mediaImgOn.value) { playbackNav('next'); return }
    const tgt = getSeekTarget()
    if (!tgt) return
    const now = performance.now()
    if (!e.repeat) {
      _doSeekStep(tgt, 1)
    } else if (now - _seekThrottleRight >= 500) {
      _seekThrottleRight = now
      _doSeekStep(tgt, 1)
    }
  } else if (e.key === ' ') {
    e.preventDefault(); playbackToggle(null, { musicFirst: false })
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (!mediaVisualSource.value && !musicSource.value) {
      const key = selectedSource.value
      if (key) {
        const item = sourceStates[key.src]?.[key.type]?.selectedItem.value
        if (item) playbackSelectItem(item)
      }
    } else {
      playbackToggle(null, { musicFirst: true })
    }
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault()
    if (musicSource.value) playbackStop('media-music')
    else if (mediaVisualOn.value) playbackStop('media-visual')
    else if (currentWallpaper.value?.isVideo) playbackStop('wp-video')
  } else if (e.key === 'Escape') {
    if (_settingsSkipPersist.value) return
    e.preventDefault(); settingsOpen.value = !settingsOpen.value
  } else if (e.key === 'k' || e.key === 'K') {
    if (settingsOpen.value) { e.preventDefault(); playbackCycleMode() }
  } else if (e.key === 'j' || e.key === 'J') {
    if (settingsOpen.value) { e.preventDefault(); playbackCycleDirection() }
  } else if (e.key === 'm' || e.key === 'M') {
    e.preventDefault()
    playbackMuteAll()
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault()
    playbackAdjustVolume(-5)
  } else if (e.key === '=' || e.key === '+') {
    e.preventDefault()
    playbackAdjustVolume(5)

  // ====== 主题 / 显示（WallpaperBar + DisplayBar） ======
  } else if (e.key === 'd' || e.key === 'D') {
    e.preventDefault(); cycleTheme()
  } else if (e.key === 'z' || e.key === 'Z') {
    e.preventDefault()
    const modes = ['fill', 'fit', 'center', 'tile', 'stretch']
    const cur = displayMode.value
    const idx = modes.indexOf(cur)
    const next = modes[(idx + 1) % modes.length]
    setDisplayMode(next, false)

  // ====== 媒体栏（MediaBar） ======
  } else if (e.key === 'n' || e.key === 'N') {
    if (settingsOpen.value) { e.preventDefault(); playbackCycleMediaSource() }
  } else if (e.key === 'l' || e.key === 'L') {
    if (settingsOpen.value) { e.preventDefault(); playbackCycleMediaType() }
  } else if (e.key === 'f' || e.key === 'F') {
    if (settingsOpen.value) { e.preventDefault(); playbackCycleFolder() }
  } else if (e.key === 'p' || e.key === 'P') {
    e.preventDefault()
    switchVisualMediaType('image')
  } else if (e.key === 'v' || e.key === 'V') {
    e.preventDefault()
    switchVisualMediaType('video')

  // ====== 设置栏（SettingsBar） ======
  } else if (e.key === 'h' || e.key === 'H') {
    if (settingsOpen.value) { e.preventDefault(); autoHide.value = !autoHide.value }
  } else if (e.key === 'o' || e.key === 'O') {
    e.preventDefault(); document.getElementById('wallpaper-file-input')?.click()

  } else if (/^[1-9]$/.test(e.key)) {
    if (displayMode.value === 'tile' && videoOn.value) {
      const n = Number(e.key)
      const max = maxTileCount.value
      const target = Math.min(n, max)
      if (tileVideoCount.value !== target) {
        e.preventDefault()
        tileVideoCount.value = target
        clearOldTileVideoCount()
      }
    }
  }
}

// ====== 视觉源切换（快捷键 P/V） ======
function switchVisualMediaType(type) {
  const cur = selectedSource.value
  if (!cur) return
  const target = { src: cur.src, type }
  const st = sourceStates[target.src]?.[target.type]
  if (!st) return
  if (cur.type !== type) selectedSource.set(target)

  let item = st.selectedItem.value
  if (!item) {
    const list = displayLists[target.src]?.[target.type]?.value
    item = list && list.length ? list[0] : null
  }
  if (!item) return

  const curVS = mediaVisualSource.value
  if (curVS && curVS.src === target.src && curVS.type === target.type) {
    const curItem = sourceStates[curVS.src]?.[curVS.type]?.selectedItem.value
    if (curItem && itemId(curItem) === itemId(item)) return
  }
  playbackSelectItem(item)
}

// ====== 挂载 & 键盘监听注册 ======
if (!IS_POPUP) {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
    if (e.key === 'ArrowLeft') _scheduleSeekReset(-1)
    else if (e.key === 'ArrowRight') _scheduleSeekReset(1)
  })
}

createApp(App).mount('#app')