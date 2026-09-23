import { ref, computed, watch } from 'vue'
import {
  autoHide, settingsOpen, portraitWidget,
  mediaVisualSource, musicSource,
  resolveOwnedItem,
  _displayModeVideo, _displayModeImage,
  _desktopAlignVideo, _desktopAlignImage,
  _desktopAnchorVideo, _desktopAnchorImage,
  followSystem, themeMode,
  followLight, followDark,
  currWallpapers, currBackgroundColors,
  sourceStates, selectedSource, selectedDirId,
  MEDIA_SOURCES, MEDIA_TYPES, networkFiles,
  musicPaused, videoPaused,
  videoLoop,
  wpVideoMuted, mediaVideoMuted, mediaMusicMuted,
  wpVideoVolume, mediaVideoVolume, mediaMusicVolume,
  mediaRotateMap
} from './persist'
import { getWallpaperFile, dirHandles, dirFiles, initDirStore, refreshDirValidity, scanAllDirs, resolveDirFile } from './storage'

//  ====== 视口窗口 ====== 
export const viewportW = ref(window.innerWidth)
export const viewportH = ref(window.innerHeight)
export const maximized = ref(false)
export const screenW = ref(window.screen?.width || 1920)
export const screenH = ref(window.screen?.height || 1080)

// ====== 鼠标 ======
export const mouseX = ref(0)
export const mouseY = ref(0)
export const mouseInited = ref(false)
export const mouseInViewport = ref(true)

// ====== 悬浮面板 ====== 
export const hoveredWidget = ref(null)
export const widgetActive = ref(null)

// ====== 主题 ======
export const themeSystemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)

// ====== 壁纸 ======
export const wpObjectUrls = ref({})

// ====== 播放运行时 ======
export const videoPlaying = ref(false)
export const musicPlaying = ref(false)
export const videoElProgress = ref(0)
export const videoElDuration = ref(0)
export const musicElProgress = ref(0)
export const musicElDuration = ref(0)
export const videoEl = ref(null)
export const musicEl = ref(null)
export const visualItemW = ref(0)
export const visualItemH = ref(0)
export const wpMediaInfo = ref({ w: 0, h: 0 })
export const everZoomed = ref(false)
export const imgNatural = ref({ w: 0, h: 0 })

// ====== 布局 ======
export const tileVideoCount = ref(3)
export const tileDirUp = ref(true)

// ====== 浮动图标 ======
export const floatIcon = ref(null)

// ====== 媒体索引 ======
export const mediaLocalFiles = ref([])

// ====== 错误项目（不持久化） ======
const _mkErroredStore = () => ({ image: [], video: [], music: [] })
export const erroredItems = ref({ local: _mkErroredStore(), network: _mkErroredStore(), dir: _mkErroredStore() })
export function markErrored(item) {
  if (!item) return
  const k = itemId(item)
  if (!k) return
  let src
  if (item?.url) src = 'network'
  else if (item?.dirId) src = 'dir'
  else src = 'local'
  const type = item.type
  const arr = erroredItems.value[src]?.[type]
  if (arr && !arr.includes(k)) arr.push(k)
}
export function markNoErrored(item) {
  if (!item) return
  const k = itemId(item)
  if (!k) return
  let src
  if (item?.url) src = 'network'
  else if (item?.dirId) src = 'dir'
  else src = 'local'
  const arr = erroredItems.value[src]?.[type]
  const idx = arr.findIndex(item => item === k)
  if (idx !== -1) {
    arr.splice(idx, 1)
  }
}
export function isErrored(item) {
  if (!item) return false
  const k = itemId(item)
  if (!k) return false
  let src
  if (item?.url) src = 'network'
  else if (item?.dirId) src = 'dir'
  else src = 'local'
  const type = item.type
  return erroredItems.value[src]?.[type]?.includes(k) || false
}

// ====== 视口 / 边缘区域 ======
export const isPortrait = computed(() => viewportW.value <= viewportH.value)
const _H = computed(() => viewportH.value / 3)
const _W = computed(() => viewportW.value / 3)
const _inTop = computed(() => mouseInited.value && mouseY.value <= _H.value)
const _inBottom = computed(() => mouseInited.value && mouseY.value >= viewportH.value - _H.value)
const _inLeft = computed(() => mouseInited.value && mouseX.value <= _W.value)
const _inRight = computed(() => mouseInited.value && mouseX.value >= viewportW.value - _W.value)
export const edgeTL = computed(() => _inTop.value && _inLeft.value)
export const edgeTR = computed(() => _inTop.value && _inRight.value)
export const edgeBL = computed(() => _inBottom.value && _inLeft.value)
export const edgeBR = computed(() => _inBottom.value && _inRight.value)
const _inCenterX = computed(() => mouseInited.value && mouseX.value >= _W.value && mouseX.value <= viewportW.value - _W.value)
export const edgeBottom = computed(() => _inBottom.value && _inCenterX.value)

// ====== 桌面对齐 / 容器尺寸 ======
export const viewportAreaDiffers = computed(() =>
  viewportW.value !== screenW.value || viewportH.value !== screenH.value
)
export const canDesktopAlign = computed(() =>
  viewportW.value > viewportH.value && maximized.value && viewportAreaDiffers.value
)
function _isVideoVisual() {
  const k = mediaVisualSource.value
  if (k) return k.type === 'video'
  return !!currentWallpaper.value?.isVideo
}
export const displayMode = computed({
  get() { return _isVideoVisual() ? _displayModeVideo.value : _displayModeImage.value },
  set(v) { if (_isVideoVisual()) _displayModeVideo.value = v; else _displayModeImage.value = v }
})
export const desktopAlign = computed({
  get() { if (!canDesktopAlign.value) return false; return _isVideoVisual() ? _desktopAlignVideo.value : _desktopAlignImage.value },
  set(v) { if (_isVideoVisual()) _desktopAlignVideo.value = v; else _desktopAlignImage.value = v }
})
export const desktopAnchor = computed({
  get() { return _isVideoVisual() ? _desktopAnchorVideo.value : _desktopAnchorImage.value },
  set(v) { if (_isVideoVisual()) _desktopAnchorVideo.value = v; else _desktopAnchorImage.value = v }
})
export const containerW = computed(() => desktopAlign.value ? screenW.value : viewportW.value)
export const containerH = computed(() => desktopAlign.value ? screenH.value : viewportH.value)

// ====== 壁纸派生 ======
export const wpDisplayTheme = computed(() => themeMode.value === 'dark' ? (followDark.value ? 'light' : 'dark') : (followLight.value ? 'dark' : 'light'))
export const currentWallpaper = computed(() => {
  const rec = currWallpapers.value[wpDisplayTheme.value]
  if (!rec) return null
  const url = rec.kind === 'file' ? wpObjectUrls.value[rec.fileId] : rec.url
  return url ? { ...rec, url } : null
})
export const currentBackgroundColor = computed(() => {
  const slot = wpDisplayTheme.value
  if (currWallpapers.value?.[slot]) return null
  return currBackgroundColors.value?.[slot] || null
})

// ====== 视觉类型判断链 ======
export const mediaImgOn = computed(() => {
  const src = mediaVisualSource.value
  if (!src || src.type !== 'image') return false
  return resolveOwnedItem(src)?.type === 'image'
})
export const mediaVideoOn = computed(() => {
  const src = mediaVisualSource.value
  if (!src || src.type !== 'video') return false
  return resolveOwnedItem(src)?.type === 'video'
})
export const mediaVisualOn = computed(() => !!(mediaImgOn.value || mediaVideoOn.value))
export const visualType = computed(() => {
  if (mediaVideoOn.value) return 'media-video'
  if (mediaImgOn.value) return 'media-img'
  const cur = currentWallpaper.value
  if (cur?.isVideo) return 'wallpaper-video'
  if (cur && !cur.isVideo) return 'wallpaper-image'
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
export const videoOn = computed(() => !!videoType.value)
export const imageOn = computed(() => !!imgType.value)

// ====== 布局派生 ======
export const viewportRatio = computed(() => ratioType(viewportW.value, viewportH.value))
export const areaRatio = computed(() => ratioType(containerW.value, containerH.value))
export const curW = computed(() => mediaVisualOn.value ? visualItemW.value : wpMediaInfo.value.w)
export const curH = computed(() => mediaVisualOn.value ? visualItemH.value : wpMediaInfo.value.h)
export const curRatio = computed(() => curW.value && curH.value ? ratioType(curW.value, curH.value) : null)
export const curExcess = computed(() => {
  const w = curW.value, h = curH.value
  const vw = containerW.value, vh = containerH.value
  if (!w || !h) return null
  const wr = w / h, vr = vw / vh
  if (Math.abs(wr - vr) / vr <= 0.01) return null
  const wideTall = wr >= vr
  const bigEnough = w >= vw || h >= vh
  if (wideTall) return bigEnough ? 'tooWide' : 'tooShort'
  return bigEnough ? 'tooHigh' : 'tooNarrow'
})
export const maxTileCount = computed(() => {
  if (!curW.value || !curH.value) return 1
  const vw = containerW.value
  const vh = containerH.value
  const vR = curW.value / curH.value, aR = vw / vh
  const per = vR >= aR ? vw : vh * vR
  if (!per || per >= vw) return 1
  const exact = vw / per
  const floorVal = Math.floor(exact)
  if (floorVal === 2 && exact - floorVal >= 0.4) return Math.min(9, 3)
  return Math.min(9, floorVal)
})

// ====== 选中项 ======
export const mediaVisualItem = computed(() => resolveOwnedItem(mediaVisualSource.value))
export function getRotateKey() {
  const vt = visualType.value
  if (vt === 'wallpaper-image' || vt === 'wallpaper-video') {
    const c = currentWallpaper.value
    if (!c) return ''
    return 'wp:' + (c.fileId || c.url || '')
  }
  if (vt === 'media-img' || vt === 'media-video') {
    const it = mediaVisualItem.value
    if (!it) return ''
    return 'media:' + (it.url || (it.path1 + '/' + (it.path2 || '') + '/' + it.filename))
  }
  return ''
}
export const curVisualRotate = computed(() => {
  const k = getRotateKey()
  if (!k) return 0
  const v = mediaRotateMap.value[k]
  return v === 90 || v === 180 || v === 270 ? v : 0
})
export const musicItem = computed(() => {
  const key = musicSource.value
  if (!key) return null
  return sourceStates[key.src]?.[key.type]?.selectedItem.value || null
})
export const musicOn = computed(() => musicItem.value?.type === 'music')

// ====== 列表派生 ======
export const sourceFiles = {}
for (const src of MEDIA_SOURCES) {
  sourceFiles[src] = {}
  for (const type of MEDIA_TYPES) {
    sourceFiles[src][type] = computed(() => {
      let list
      if (src === 'local') list = mediaLocalFiles.value
      else if (src === 'dir') {
        if (!selectedDirId.value) {
            list = []
            for (const dirid in dirFiles.value) {
              list = [...list, ...(dirFiles.value[dirid] || [])]
            }
        } else list = dirFiles.value[selectedDirId.value] || []
      }
      else list = networkFiles.value
      return list.filter((f) => f.type === type)
    })
  }
}
export const displayLists = {}
for (const src of MEDIA_SOURCES) {
  displayLists[src] = {}
  for (const type of MEDIA_TYPES) {
    displayLists[src][type] = computed(() => {
      const st = sourceStates[src][type]
      return buildList(src, type, st.folder.value, st.sortBy.value, st.sortDir.value, st.shuffleSeed.value)
    })
  }
}

// ====== 常量 ======

const EDGE_MAP = { tl: computed(() => edgeTL.value), tr: computed(() => edgeTR.value), bl: computed(() => edgeBL.value), br: computed(() => edgeBR.value), bottom: computed(() => edgeBottom.value) }
const PANEL_TO_KEY = { tl: 'wallpaper', br: 'media', bl: 'display', ctrl: 'control' }

const VOLUME_BINDINGS = {
  wp: { muted: wpVideoMuted, volume: wpVideoVolume },
  'media-video': { muted: mediaVideoMuted, volume: mediaVideoVolume },
  'media-music': { muted: mediaMusicMuted, volume: mediaMusicVolume }
}
const lastVolume = { wp: null, 'media-video': null, 'media-music': null }

// ====== 视口辅助 ======
export function updateScreenSize() {
  screenW.value = window.screen?.width || screenW.value
  screenH.value = window.screen?.height || screenH.value
}
function detectMaximized() {
  const vw = viewportW.value, vh = viewportH.value
  const sw = screenW.value, sh = screenH.value
  if (!vw || !vh || !sw || !sh) return false
  return vw >= sw - 60 && vh >= sh - 200
}

// ====== widget 可见性 hook ======
export function useWidgetVisibility(widgetId, opts = {}) {
  const { edge } = opts
  const edgeRef = edge ? EDGE_MAP[edge] : null
  return computed(() => {
    if (isPortrait.value) {
      if (!settingsOpen.value) return false
      const key = PANEL_TO_KEY[widgetId]
      if (key) return portraitWidget.value === key
      return true
    }
    if (!settingsOpen.value) return false
    if (!autoHide.value) return true
    if (!mouseInViewport.value) return false
    if (widgetActive.value === widgetId) return true
    return (edgeRef?.value ?? false) || hoveredWidget.value === widgetId
  })
}

// ====== 主题切换 ======
export function cycleTheme() { themeMode.set(themeMode.value === 'light' ? 'dark' : 'light') }

// ====== 布局辅助 ======
export function defaultTileCount(max) {
  if (max <= 3) return max
  if (max % 2 === 0) return max - 1
  return max
}
export function ratioType(w, h) {
  if (!w || !h) return null
  const r = w / h
  if (r >= (4 / 3) * 0.99 && r <= (21 / 9) * 1.01) return 'landscape'
  if (r >= (9 / 21) * 0.99 && r <= (3 / 4) * 1.01) return 'portrait'
  return null
}
export let _oldtileVideoCount = null
export function clearOldTileVideoCount() { _oldtileVideoCount = null }
export function setDisplayMode(v, repeat) {
  if (v !== 'tile') {
    tileVideoCount.value = 1
    clearOldTileVideoCount()
    displayMode.value = v
    return
  }
  if (!videoOn.value) { displayMode.value = v; return }
  const max = maxTileCount.value
  if (max <= 1) { tileVideoCount.value = 1; clearOldTileVideoCount(); displayMode.value = 'tile'; return }
  if (!repeat) {
    tileVideoCount.value = defaultTileCount(max)
    tileDirUp.value = true
    clearOldTileVideoCount()
    displayMode.value = 'tile'
    return
  }
  if (tileDirUp.value) {
    if (tileVideoCount.value >= max) { tileDirUp.value = false; tileVideoCount.value = max - 1 }
    else { tileVideoCount.value++ }
  } else {
    if (tileVideoCount.value <= 1) { tileDirUp.value = true; tileVideoCount.value = 2 }
    else { tileVideoCount.value-- }
  }
  clearOldTileVideoCount()
}
watch(maxTileCount, (max) => {
  if (!curW.value || !curH.value) return
  if (_oldtileVideoCount && _oldtileVideoCount <= max) {
    tileVideoCount.value = _oldtileVideoCount
    _oldtileVideoCount = null
  }
  if (tileVideoCount.value > max) {
    _oldtileVideoCount = tileVideoCount.value
    tileVideoCount.value = defaultTileCount(max)
  }
})

// ====== 浮动图标 ======
let _centerTimer = null, _seekTimer = null, _floatTimer = null
export function showMainIcon(icon, duration = 300, force = false, dir = 0) {
  if (!force && autoHide.value) return
  clearTimeout(_centerTimer)
  const vw = viewportW.value, vh = viewportH.value
  const minY = vh / 2
  const maxY = vh - 90
  const y = Math.max(minY, (minY + maxY) / 2)
  const x = vw / 2 + (dir < 0 ? -vw / 6 : dir > 0 ? vw / 6 : 0)
  floatIcon.value = { icon, x, y, key: Date.now() }
  _centerTimer = setTimeout(() => { floatIcon.value = null }, duration)
}
export function showSeekIcon(dir, duration = 300) {
  if (autoHide.value) return
  clearTimeout(_seekTimer)
  const vw = viewportW.value, vh = viewportH.value
  const x = vw / 2 + (dir < 0 ? -vw / 6 : vw / 6)
  const minY = vh / 2
  const maxY = vh - 90
  const y = Math.max(minY, (minY + maxY) / 2)
  floatIcon.value = { icon: dir < 0 ? '«' : '»', x, y, key: Date.now() }
  _seekTimer = setTimeout(() => { floatIcon.value = null }, duration)
}
export function showFloatIcon(icon, x, y) {
  if (autoHide.value) return
  clearTimeout(_floatTimer)
  floatIcon.value = { icon, x: x ?? mouseX.value, y: y ?? mouseY.value, key: Date.now() }
  _floatTimer = setTimeout(() => { floatIcon.value = null }, 250)
}

// ====== loop / reverse 访问 ======
export function getLoop(key) {
  if (!key) return true
  return sourceStates?.[key.src]?.[key.type]?.loop?.value ?? true
}
export function getReverse(key) {
  if (!key) return false
  return sourceStates?.[key.src]?.[key.type]?.reverse?.value ?? false
}
export function isShuffle(key) {
  if (!key) return false
  return sourceStates?.[key.src]?.[key.type]?.sortBy?.value === 'random'
}

// ====== 源状态访问 ======
export function _stateOfSource(source) {
  if (!source) return null
  return sourceStates[source.src]?.[source.type] || null
}

// ====== 列表工具 ======
export function listOf(source) {
  if (!source) return []
  return displayLists[source.src]?.[source.type]?.value || []
}
function _mulberry32(seed) {
  let t = seed >>> 0
  return function () {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
export function buildList(src, type, folderVal, sortByVal, sortDirVal, seed = 0) {
  let list = sourceFiles[src][type].value
  if (folderVal !== 'all') {
    if (src === 'local' || src === 'dir')
      list = list.filter((f) => (f.path2 ? f.path1 + '/' + f.path2 : f.path1) === folderVal)
    else
      list = list.filter((f) => f.site === folderVal)
  }
  const arr = [...list]
  if (sortByVal === 'random') {
    const rng = _mulberry32(seed)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
  const fileSrc = src === 'local' || src === 'dir'
  const key = sortByVal === 'name'
    ? (fileSrc ? 'filename' : 'pathname')
    : (fileSrc ? 'mtime' : 'ctime')
  const nameKey = fileSrc ? 'filename' : 'pathname'
  const dir = sortDirVal === 'asc' ? 1 : -1
  return arr.sort((a, b) => {
    const av = a[key], bv = b[key]
    let r
    if (typeof av === 'number' && typeof bv === 'number') r = (av - bv) * dir
    else r = String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true }) * dir
    if (r !== 0) return r
    return String(a[nameKey] || '').localeCompare(String(b[nameKey] || ''), undefined, { numeric: true })
  })
}

// ====== 导航目标解析 ======
export function pickPrioritySourceKey({ selectedKey, visualKey, musicKey }) {
  for (const k of [visualKey, musicKey]) {
    if (!k) continue
    if (listOf(k).length > 1) return k
  }
  if (selectedKey && (sourceEquals(selectedKey, visualKey) || sourceEquals(selectedKey, musicKey))) {
    if (listOf(selectedKey).length > 1) return selectedKey
  }
  if (selectedKey) return selectedKey
  return null
}
export function resolveTarget(which, { musicFirst = false } = {}) {
  if (which) return which
  const vsk = mediaVisualSource.value
  const ask = musicSource.value
  const visualCands = vsk ? ['media-visual'] : []
  if (currentWallpaper.value?.isVideo) visualCands.push('wp-video')
  const musicCands = ask ? ['media-music'] : []
  const order = musicFirst ? [...musicCands, ...visualCands] : [...visualCands, ...musicCands]
  return order[0] || null
}
export function navTargetSource(which) {
  if (which === 'media-music') return musicSource.value
  if (which === 'media-visual') return mediaVisualSource.value
  if (which === 'wp-video') return null
  return pickPrioritySourceKey({ selectedKey: selectedSource.value, visualKey: mediaVisualSource.value, musicKey: musicSource.value })
}

// ====== 导航内部算法 ======
function _pickLinear(source, item, userDir, isReverse, isLoop) {
  const list = listOf(source)
  if (!list.length) return null
  if (list.length === 1) return isLoop ? list[0] : null
  const autoNext = isReverse ? 'prev' : 'next'
  const effDir = userDir || autoNext
  const isNext = effDir !== 'prev'
  const k = itemId(item)
  const curIdx = list.findIndex((f) => itemId(f) === k)
  let nextIdx = isNext ? curIdx + 1 : curIdx - 1
  if (nextIdx < 0) { if (!isLoop) return null; nextIdx = list.length - 1 }
  else if (nextIdx >= list.length) { if (!isLoop) return null; nextIdx = 0 }
  return list[nextIdx] || null
}

// ====== 导航外部 API ======
export function pickNextItem(source, item, dir = 'next') {
  if (!source) return null
  const st = _stateOfSource(source)
  if (!st) return null
  const isLoop = st.loop.value
  const isAuto = dir === null
  if (isAuto && !isLoop) return null
  const isReverse = st.reverse.value
  return _pickLinear(source, item, dir, isReverse, isLoop)
}
export function navigate(source, target) {
  if (!source) return
  const st = sourceStates[source.src]?.[source.type]
  if (!st || !target) return
  st.selectedItem.set(target)
}
export function playbackNav(dir, which) {
  const source = navTargetSource(which)
  if (!source) return false
  const st = _stateOfSource(source)
  if (!st) return false
  const curItem = st.selectedItem.value
  const target = pickNextItem(source, curItem, dir)
  if (!target) return false
  const type = source.type
  if (type === 'music') musicPaused.value = false
  else if (type === 'video') videoPaused.value = false
  navigate(source, target)
  showMainIcon(dir === 'next' ? '⏭' : '⏮', 300, false, dir === 'next' ? 1 : -1)
  return true
}
export function playbackSelectItem(item) {
  if (!item) return
  const source = sourceOf(item)
  if (!source) return
  const src = source.src, type = source.type
  const st = sourceStates[src]?.[type]
  if (!st) return
  const curItem = st.selectedItem.value
  const sameItem = curItem && itemId(curItem) === itemId(item)
  if (!sameItem) {
    if (type === 'music') musicPaused.value = false
    else if (type === 'video') videoPaused.value = false
    navigate(source, item)
  } else {
    if (type === 'music' && musicPaused.value) musicPaused.value = false
    else if (type === 'video' && videoPaused.value) videoPaused.value = false
  }
  if (type === 'image' || type === 'video') mediaVisualSource.set(source)
  else musicSource.set(source)
}

// ====== 循环切换 ======
export function playbackCycleMediaType() {
  const key = selectedSource.value || { src: 'local', type: 'image' }
  const nextType = MEDIA_TYPES[(MEDIA_TYPES.indexOf(key.type) + 1) % MEDIA_TYPES.length]
  const nextKey = { src: key.src, type: nextType }
  if (sourceStates[key.src]?.[nextType]) selectedSource.set(nextKey)
}
export function playbackCycleMediaSource() {
  const key = selectedSource.value || { src: 'local', type: 'image' }
  const nextSrc = MEDIA_SOURCES[(MEDIA_SOURCES.indexOf(key.src) + 1) % MEDIA_SOURCES.length]
  const nextKey = { src: nextSrc, type: key.type }
  if (sourceStates[nextSrc]?.[key.type]) selectedSource.set(nextKey)
}
export function playbackCycleFolder() {
  const key = selectedSource.value || { src: 'local', type: 'image' }
  const src = key.src, type = key.type
  const st = sourceStates[src]?.[type]
  if (!st) return
  let raw
  if (src === 'local') raw = mediaLocalFiles.value
  else if (src === 'dir')     
    if (!selectedDirId.value) {
      raw = []
      for (const dirid in dirFiles.value) {
        raw = [...raw, ...(dirFiles.value[dirid] || [])]
      }
    } else raw = dirFiles.value[selectedDirId.value] || []
  else raw = networkFiles.value
  const list = raw.filter((f) => f.type === type)
  let folders
  if (src === 'local' || src === 'dir') {
    const count = {}
    for (const f of list) {
      const k = f.path2 ? f.path1 + '/' + f.path2 : f.path1
      count[k] = (count[k] || 0) + 1
    }
    const roots = Object.keys(count).filter((k) => !k.includes('/'))
    const subs = Object.keys(count).filter((k) => k.includes('/'))
    const byCount = (a, b) => (count[b] || 0) - (count[a] || 0)
    roots.sort(byCount); subs.sort(byCount)
    folders = ['all', ...roots, ...subs]
  } else {
    const count = {}
    for (const f of list) if (f.site) count[f.site] = (count[f.site] || 0) + 1
    folders = ['all', ...Object.keys(count).sort((a, b) => count[b] - count[a])]
  }
  if (folders.length <= 1) return
  const cur = st.folder.value
  const idx = folders.indexOf(cur)
  st.folder.set(folders[(idx + 1) % folders.length])
}
export function playbackCycleMode(which) {
  const toggleLoop = (source) => {
    const st = _stateOfSource(source)
    if (!st) return false
    st.loop.set(!st.loop.value)
    return true
  }
  if (which === 'wp-video' || which === 'wp') {
    if (currentWallpaper.value?.isVideo) { videoLoop.set(!videoLoop.value); return true }
  }
  if (which === 'media-visual' || which === 'visual') return toggleLoop(mediaVisualSource.value)
  if (which === 'media-music' || which === 'music') return toggleLoop(musicSource.value)
  if (toggleLoop(mediaVisualSource.value)) return true
  if (toggleLoop(musicSource.value)) return true
  if (currentWallpaper.value?.isVideo) { videoLoop.set(!videoLoop.value); return true }
  return false
}
export function playbackCycleDirection(which) {
  const flip = (source) => {
    const st = _stateOfSource(source)
    if (!st) return false
    if (!st.loop.value) return false
    st.reverse.set(!st.reverse.value)
    return true
  }
  if (which === 'media-visual' || which === 'visual') return flip(mediaVisualSource.value)
  if (which === 'media-music' || which === 'music') return flip(musicSource.value)
  if (flip(mediaVisualSource.value)) return true
  if (flip(musicSource.value)) return true
  return false
}
export function playbackReshuffle(which) {
  const reshuffle = (source) => {
    const st = _stateOfSource(source)
    if (!st || st.sortBy.value !== 'random') return false
    st.shuffleSeed.set((st.shuffleSeed.value + 1) % 1000000)
    return true
  }
  if (which === 'media-visual' || which === 'visual') return reshuffle(mediaVisualSource.value)
  if (which === 'media-music' || which === 'music') return reshuffle(musicSource.value)
  if (reshuffle(mediaVisualSource.value)) return true
  if (reshuffle(musicSource.value)) return true
  return false
}

// ====== 播放暂停 / 停止 ======
export function playbackToggle(which, opts = {}) {
  const target = resolveTarget(which, opts)
  if (!target) return
  if (target === 'wp-video') {
    const el = videoEl.value
    if (el && el.ended) { el.currentTime = 0; videoPaused.value = false; el.play()?.catch(() => {}); if (!opts.skipIcon) showMainIcon('⏸'); return }
    videoPaused.value = !videoPaused.value
    if (!opts.skipIcon) showMainIcon(videoPaused.value ? '▶' : '⏸')
    return
  }
  const isMusic = target === 'media-music'
  const source = isMusic ? musicSource.value : mediaVisualSource.value
  if (!source) return
  const st = _stateOfSource(source)
  if (!st) return
  const type = source.type
  if (!isMusic && type === 'image') {
    st.loop.set(!st.loop.value)
    if (!opts.skipIcon) showMainIcon(st.loop.value ? '⏸' : '▶')
    return
  }
  const pausedRef = isMusic ? musicPaused : videoPaused
  const el = isMusic ? musicEl.value : videoEl.value
  if (el && el.ended) {
    if (type === 'music') { musicPaused.value = false; musicEl.value.currentTime = 0; musicEl.value.play()?.catch(() => {}) }
    else if (type === 'video') { videoPaused.value = false; videoEl.value.currentTime = 0; videoEl.value.play()?.catch(() => {}) }
    if (!opts.skipIcon) showMainIcon('▶')
    return
  }
  pausedRef.value = !pausedRef.value
  if (!opts.skipIcon) showMainIcon(pausedRef.value ? '▶' : '⏸')
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
  if (which === 'media-visual' || which === 'visual') { const ok = doStop(mediaVisualSource); if (ok) { showMainIcon('⏹'); return true } }
  if (which === 'media-music' || which === 'music') { const ok = doStop(musicSource); if (ok) { showMainIcon('⏹'); return true } }
  if (which === 'wp-video' || which === 'wp') {
    if (!currentWallpaper.value?.isVideo) return false
    if (videoPaused.value) return true
    videoPaused.value = true; showMainIcon('⏹'); return true
  }
  let stopped = false
  if (musicSource.value) stopped = playbackStop('media-music') || stopped
  if (mediaVisualSource.value) stopped = playbackStop('media-visual') || stopped
  if (!stopped && currentWallpaper.value?.isVideo) stopped = playbackStop('wp-video')
  return stopped
}

// ====== seek ======
export function playbackSeek(t, which) {
  const time = Math.max(0, Math.round(t))
  if (which === 'wp-video') { if (videoEl.value) videoEl.value.currentTime = time; return }
  if (which === 'media-visual') { if (videoEl.value) videoEl.value.currentTime = time }
  else if (which === 'media-music') { if (musicEl.value) musicEl.value.currentTime = time }
}

// ====== 音量管理 ======
export function playbackToggleMute(which) {
  const b = VOLUME_BINDINGS[which]; if (!b) return
  if (!b.muted.value) { lastVolume[which] = b.volume.value; b.volume.set(0); b.muted.set(true) }
  else { const v = lastVolume[which]; const restore = (v != null && v > 0) ? v : 30; lastVolume[which] = null; b.volume.set(restore); b.muted.set(false) }
}
export function playbackSetVolume(val, which) {
  const b = VOLUME_BINDINGS[which]; if (!b) return
  const n = Math.max(0, Math.min(100, Math.round(Number(val) || 0)))
  if (n === 0) b.muted.set(true); else if (b.muted.value) b.muted.set(false)
  b.volume.set(n); return n
}
export function playbackMuteAll() {
  const targets = []
  if (currentWallpaper.value?.isVideo) targets.push('wp')
  if (mediaVisualSource.value) targets.push('media-video')
  if (musicSource.value) targets.push('media-music')
  if (targets.length === 0) return
  const anyUnmuted = targets.some(w => !VOLUME_BINDINGS[w].muted.value)
  for (const which of targets) {
    const b = VOLUME_BINDINGS[which]
    if (anyUnmuted) { if (!b.muted.value) { lastVolume[which] = b.volume.value; b.volume.set(0); b.muted.set(true) } }
    else { const v = lastVolume[which]; const restore = (v != null && v > 0) ? v : 30; lastVolume[which] = null; b.muted.set(false); b.volume.set(restore) }
  }
}
export function playbackAdjustVolume(delta) {
  const prevWp = wpVideoVolume.value, prevMediaV = mediaVideoVolume.value, prevMusic = mediaMusicVolume.value
  wpVideoVolume.set(Math.max(0, Math.min(100, prevWp + delta)))
  mediaVideoVolume.set(Math.max(0, Math.min(100, prevMediaV + delta)))
  mediaMusicVolume.set(Math.max(0, Math.min(100, prevMusic + delta)))
  if (delta > 0) {
    if (videoType.value === 'wallpaper' && wpVideoMuted.value) wpVideoMuted.set(false)
    else if (videoType.value === 'media' && mediaVideoMuted.value) mediaVideoMuted.set(false)
    if (musicOn.value && mediaMusicMuted.value) mediaMusicMuted.set(false)
  } else if (delta < 0) {
    if (videoType.value === 'wallpaper' && prevWp > 0 && wpVideoVolume.value === 0) wpVideoMuted.set(true)
    else if (videoType.value === 'media' && prevMediaV > 0 && mediaVideoVolume.value === 0) mediaVideoMuted.set(true)
    if (musicOn.value && prevMusic > 0 && mediaMusicVolume.value === 0) mediaMusicMuted.set(true)
  }
}

// ====== 初始化 ======

updateScreenSize()
maximized.value = detectMaximized()

// resize 节流更新
const onResize = throttle(() => {
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight
  updateScreenSize()
  maximized.value = detectMaximized()
}, 100)
window.addEventListener('resize', onResize)

// 鼠标
let _cursorHideTimer = null
let _cursorHidden = false
let _mouseDown = false
function _showCursor() {
  if (_cursorHidden) {
    document.documentElement.classList.remove('cursor-hidden')
    _cursorHidden = false
  }
  if (_cursorHideTimer) { clearTimeout(_cursorHideTimer); _cursorHideTimer = null }
}
function _scheduleHideCursor() {
  if (_mouseDown) return
  if (_cursorHideTimer) clearTimeout(_cursorHideTimer)
  _cursorHideTimer = setTimeout(() => {
    if (_mouseDown) return
    document.documentElement.classList.add('cursor-hidden')
    _cursorHidden = true
    _cursorHideTimer = null
  }, 2000)
}
window.addEventListener('mousemove', (e) => {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
  if (!mouseInited.value) mouseInited.value = true
  _showCursor()
  _scheduleHideCursor()
})
window.addEventListener('mousedown', () => { _mouseDown = true; _showCursor() })
window.addEventListener('mouseup', () => { _mouseDown = false; _scheduleHideCursor() })
window.addEventListener('mouseleave', () => { _showCursor(); if (_cursorHideTimer) { clearTimeout(_cursorHideTimer); _cursorHideTimer = null } })
document.addEventListener('mouseleave', () => { mouseInViewport.value = false })
document.addEventListener('mouseenter', () => { mouseInViewport.value = true; _showCursor(); _scheduleHideCursor() })

// 主题系统变化
const _mediaQM = window.matchMedia('(prefers-color-scheme: dark)')
_mediaQM.addEventListener('change', (e) => { themeSystemDark.value = e.matches })
watch([followSystem, themeSystemDark], ([on, dark]) => {
  if (on) themeMode.value = dark ? 'dark' : 'light'
}, { immediate: true })

// 壁纸文件加载为 blob URL
watch(currWallpapers.loaded, (loaded) => {
  if (!loaded) return
  const ids = new Set()
  for (const slot of ['light', 'dark']) {
    const wp = currWallpapers.value?.[slot]
    if (wp?.kind === 'file' && wp.fileId) ids.add(wp.fileId)
  }
  if (!ids.size) return
  Promise.all([...ids].map(async (id) => {
    const file = await getWallpaperFile(id)
    if (file) return [id, URL.createObjectURL(file)]
    return null
  })).then((pairs) => {
    const next = { ...wpObjectUrls.value }
    for (const p of pairs) if (p) next[p[0]] = p[1]
    wpObjectUrls.value = next
  })
}, { immediate: true })

// DOM data-theme 立即写入（等 useStorage 值，不等其他异步数据，防止刷新闪白）
watch(themeMode, (t) => {
  document.documentElement.setAttribute('data-theme', t)
}, { immediate: true })

// DOM --bg 写入（等背景/壁纸数据就绪）
watch([currentBackgroundColor, currBackgroundColors.loaded, currWallpapers.loaded, followLight.loaded, followDark.loaded], ([color, bgLoaded, wpLoaded, flLoaded, fdLoaded]) => {
  if (!bgLoaded || !wpLoaded || !flLoaded || !fdLoaded) return
  if (color) {
    document.documentElement.style.setProperty('--bg', color)
    document.body.style.setProperty('--bg', color)
  } else {
    document.documentElement.style.removeProperty('--bg')
    document.body.style.removeProperty('--bg')
  }
}, { immediate: true })


// 媒体索引加载
;(async () => {
  try {
    const res = await fetch(browser.runtime.getURL('media-index.json'), { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data)) mediaLocalFiles.value = data
  } catch {}
})()

// 授权目录初始化
;(async () => {
  try {
    const { handles } = await initDirStore()
    // 刷新后默认全部 valid，实际访问文件时才会触发失效报错
    if (handles.length) {
      dirHandles.value = handles.map((h) => ({ ...h, valid: true })).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    }
    setTimeout(() => { scanAllDirs() }, 500)
  } catch {}
})()

watch([dirHandles, selectedDirId], ([handles, selId]) => {
  if (!handles || handles.length === 0) {
    if (selId) selectedDirId.set(null)
    if (sourceStates.dir) {
      for (const type of MEDIA_TYPES) {
        const st = sourceStates.dir[type]
        if (st?.folder) st.folder.set('all')
        if (st?.selectedItem) st.selectedItem.set(null)
      }
    }
    return
  }
  const exists = selId && handles.some((h) => h.id === selId)
  if (!exists) selectedDirId.set(null)
})

// ====== 节流 ======
export function throttle(fn, delay = 100) {
  let last = 0
  let timer = null
  return function (...args) {
    const now = Date.now()
    const remaining = delay - (now - last)
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null }
      last = now
      fn.apply(this, args)
    } else if (!timer) {
      timer = setTimeout(() => { timer = null; last = Date.now(); fn.apply(this, args) }, remaining)
    }
  }
}

// ====== URL构造 ======
export function localUrl(item) {
  return item.path1 + '/' + (item.path2 ? encodeURIComponent(item.path2) + '/' : '') + encodeURIComponent(item.filename)
}

// ====== dir blob URL 管理 ======
const dirBlobUrls = ref({})
const dirResolving = new Map()
const dirUrlToId = new Map()

async function resolveDirBlob(item) {
  if (!item?.dirId) return null
  const id = itemId(item)
  if (dirBlobUrls.value[id]) return dirBlobUrls.value[id]
  const existing = dirResolving.get(id)
  if (existing) return await existing
  const promise = (async () => {
    const file = await resolveDirFile(item)
    dirResolving.delete(id)
    if (!file) {
      return null
    }
    const url = URL.createObjectURL(file)
    dirBlobUrls.value = { ...dirBlobUrls.value, [id]: url }
    dirUrlToId.set(url, id)
    return url
  })()
  dirResolving.set(id, promise)
  return await promise
}

export function itemId(item) {
  if (!item) return null
  if (item.url) return item.url
  if (item.dirId != null) return `dir:${item.dirId}/${item.path2 || ''}/${item.filename}`
  return localUrl(item)
}
export function mediaUrl(item) {
  if (!item) return ''
  if (item.url) return item.url
  if (item.dirId != null) {
    const id = itemId(item)
    if (!dirBlobUrls.value[id]) resolveDirBlob(item)
    return dirBlobUrls.value[id] || null
  }
  return localUrl(item)
}

// ====== 源判断 ======
export function sourceOf(it) {
  if (!it) return null
  if (it.url) return { src: 'network', type: it.type }
  if (it.dirId != null) return { src: 'dir', type: it.type }
  return { src: 'local', type: it.type }
}
export function sourceEquals(a, b) {
  return !!a && !!b && a.src === b.src && a.type === b.type
}

// ====== 自动 resolve + 延后 revoke ======
function revokeDirBlob(id) {
  if (!id) return
  if (musicOn.value && itemId(musicItem.value) === id) return
  if (itemId(mediaVisualItem.value) === id) return
  const url = dirBlobUrls.value[id]
  if (url) {
    try { URL.revokeObjectURL(url) } catch {}
    dirUrlToId.delete(url)
    const next = { ...dirBlobUrls.value }
    delete next[id]
    dirBlobUrls.value = next
  }
}
let _lastMediaVisualId = null
let _lastMusicId = null
let _initdirItems = null
watch([mediaVisualItem, musicItem], async ([vi, mi]) => {
  const viId = vi ? itemId(vi) : null
  const miId = mi ? itemId(mi) : null
  const oldViId = _lastMediaVisualId
  const oldMiId = _lastMusicId
  _lastMediaVisualId = viId
  _lastMusicId = miId
  if (!_initdirItems) {
    _initdirItems = true
    if (vi?.dirId != null) setTimeout(() => resolveDirBlob(vi), 500)
    if (mi?.dirId != null) setTimeout(() => resolveDirBlob(mi), 500)
  } else {
    if (vi?.dirId != null) resolveDirBlob(vi)
    if (mi?.dirId != null) resolveDirBlob(mi)
  }
  // 等新 URL 就绪后再 revoke 旧的，避免 DOM src 短暂为空
  if (oldViId && oldViId !== viId) setTimeout(() => revokeDirBlob(oldViId), 2000)
  if (oldMiId && oldMiId !== miId) setTimeout(() => revokeDirBlob(oldMiId), 2000)
}, {immediate: true})