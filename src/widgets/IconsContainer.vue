<script setup>
import { ref, computed, watch, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { isPortrait, viewportW, viewportH } from '../js/core'
import { settingsOpen, themeMode, shortcutIcons as icons, shortcutFolders as folders, desktopMode, iconScale, IS_POPUP, emojiScrollPos } from '../js/persist'
import { useStorage, newIconFileId, putIconFile, getIconFile, deleteIconFile } from '../js/storage'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiInput from '../ui/UiInput.vue'
import UiText from '../ui/UiText.vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiCheck from '../ui/UiCheck.vue'
import UiNumber from '../ui/UiNumber.vue'
import { t } from '../js/i18n'

// ====== 常量 ======
const _tabsApi = () => typeof browser !== 'undefined' && browser.tabs ? browser.tabs : (typeof chrome !== 'undefined' ? chrome.tabs : null)
const GRID_ROWS = 11
const GRID_COLS = 25
const BUILTIN_ADD_ID = '__builtin_add__'
const LABEL_H = 26 // keep in sync with --ui-height in app.css

// ====== 图标容器显示 ======
const showIcons = computed(() => desktopMode.value === 'icons' && !isPortrait.value && !settingsOpen.value && iconsFitViewport.value)
const iconsFitViewport = ref(true)
const iconBoxSize = ref(32)

// ====== 内建添加图标占位 ======
function makeBuiltinAddIcon() {
  return { id: BUILTIN_ADD_ID, name: '', type: 'builtin', fileId: null, iconUrl: '', darkFileId: null, darkIconUrl: '', url: '', search: false, row: -1, col: -1, autoInvert: false }
}

function _findFirstEmpty(others) {
  return _findFirstEmptyFrom(others, 0, 0)
}

function _findFirstEmptyFrom(others, startRow, startCol) {
  const occupied = new Set(others.map(i => `${i.row},${i.col}`))
  const total = GRID_COLS * GRID_ROWS
  const startIdx = startCol * GRID_ROWS + startRow
  for (let offset = 0; offset < total; offset++) {
    const idx = (startIdx + offset) % total
    const r = idx % GRID_ROWS
    const c = Math.floor(idx / GRID_ROWS)
    if (!occupied.has(`${r},${c}`)) return { row: r, col: c }
  }
  return { row: 0, col: GRID_COLS }
}

function _builtinMake(list) {
  const others = list.filter(i => i && i.id !== BUILTIN_ADD_ID && i.row >= 0 && i.col >= 0)
  const pos = _findFirstEmpty(others)
  const bi = makeBuiltinAddIcon()
  bi.row = pos.row; bi.col = pos.col
  list.push(bi)
}

function _builtinPlaceAt(list, pos) {
  const bi = list.find(i => i && i.id === BUILTIN_ADD_ID)
  if (!bi) {
    const nbi = makeBuiltinAddIcon()
    nbi.row = pos.row; nbi.col = pos.col
    list.push(nbi); return
  }
  bi.row = pos.row; bi.col = pos.col
}

function initIconData() {
  const arr = Array.isArray(icons.value) ? icons.value : []
  let changed = false
  if (!arr.some(i => i && i.id === BUILTIN_ADD_ID)) {
    _builtinMake(arr)
    changed = true
  }
  const others = arr.filter(i => i && i.id !== BUILTIN_ADD_ID && i.row >= 0 && i.col >= 0)
  const occupied = new Set(others.map(i => `${i.row},${i.col}`))
  const builtin = arr.find(i => i && i.id === BUILTIN_ADD_ID)
  if (builtin && (builtin.col >= GRID_COLS || occupied.has(`${builtin.row},${builtin.col}`))) {
    _builtinPlaceAt(arr, _findFirstEmpty(others))
    changed = true
  }
  if (changed) icons.set(arr)
  validateAndFixIcons()
  loadBlobs()
}

function ensureBuiltinOnDelete(list, deletedPos) {
  const builtin = list.find(i => i && i.id === BUILTIN_ADD_ID)
  if (!builtin) { _builtinMake(list); return }
  const others = list.filter(i => i && i.id !== BUILTIN_ADD_ID && i.row >= 0 && i.col >= 0)
  const occupied = new Set(others.map(i => `${i.row},${i.col}`))
  if (builtin.col >= GRID_COLS) {
    if (deletedPos && deletedPos.col >= 0 && deletedPos.col < GRID_COLS) {
      builtin.row = deletedPos.row; builtin.col = deletedPos.col
    } else {
      _builtinPlaceAt(list, _findFirstEmpty(others))
    }
    return
  }
  if (occupied.has(`${builtin.row},${builtin.col}`)) { _builtinPlaceAt(list, _findFirstEmpty(others)); return }
  if (deletedPos && deletedPos.col >= 0 && deletedPos.col < GRID_COLS) {
    const builtinIdx = builtin.col * GRID_ROWS + builtin.row
    const delIdx = deletedPos.col * GRID_ROWS + deletedPos.row
    if (delIdx === builtinIdx - 1) {
      builtin.row = deletedPos.row; builtin.col = deletedPos.col
    }
  }
}

function ensureBuiltinOnAddOrDrag(list) {
  const builtin = list.find(i => i && i.id === BUILTIN_ADD_ID)
  if (!builtin) { _builtinMake(list); return }
  const others = list.filter(i => i && i.id !== BUILTIN_ADD_ID && i.row >= 0 && i.col >= 0)
  const occupied = new Set(others.map(i => `${i.row},${i.col}`))
  if (occupied.has(`${builtin.row},${builtin.col}`)) {
    const startR = builtin.row, startC = builtin.col
    _builtinPlaceAt(list, _findFirstEmptyFrom(others, startR, startC))
  }
}

function truncateLabel(name, maxWidth = 5) {
  if (!name) return ''
  let w = 0
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i)
    w += code > 127 ? 2 : 1
    if (w > maxWidth) return name.slice(0, i)
  }
  return name
}


// ====== 图标 blob 缓存 ======
const iconBlobs = reactive({})

async function loadBlobs() {
  for (const ic of icons.value) {
    if (ic.type === 'builtin') continue
    if (ic.fileId && !(ic.fileId in iconBlobs)) {
      const blob = await getIconFile(ic.fileId)
      if (blob) iconBlobs[ic.fileId] = URL.createObjectURL(blob)
    }
    if (ic.darkFileId && !(ic.darkFileId in iconBlobs)) {
      const blob = await getIconFile(ic.darkFileId)
      if (blob) iconBlobs[ic.darkFileId] = URL.createObjectURL(blob)
    }
  }
}

// ====== 首次加载 ======
onMounted(() => {
  if (icons.loaded.value) initIconData()
  else watch(icons.loaded, (loaded) => { if (loaded) initIconData() }, { once: true })
})
watch(icons, () => { validateAndFixIcons(); loadBlobs() }, { deep: true })

// ====== 预览样式 ======
const popupHighlightIds = ref(new Set())
const previewIconStyle = computed(() => {
  const sz = previewIconSize.value
  if (IS_POPUP) {
    const pad = Math.max(0, Math.floor((97 - sz - LABEL_H) / 3))
    return `width:75px; height:97px; --icon-max:${sz}px; --icon-pad:${pad}px;`
  }
  const { cellW, cellH } = getGridOffset()
  const padPx = Math.max(0, Math.floor((cellH - sz - LABEL_H) / 3))
  return `width:${cellW}px; height:${cellH}px; --icon-max:${sz}px; --icon-pad:${padPx}px;`
})
const previewIconSize = computed(() => {
  const base = IS_POPUP ? 48 : iconBoxSize.value
  const maxPx = IS_POPUP ? 48 : _iconMaxPx
  return Math.round(Math.max(12, Math.min(maxPx, base * ((form.scale ?? 100) / 100))))
})

// ====== 预填充当前标签页 ======
if (IS_POPUP) {
  ;(async () => {
    try {
      const tabsApi = _tabsApi()
      if (!tabsApi) return
      const [tab] = await tabsApi.query({ active: true, currentWindow: true })
      if (!tab || !tab.url) return
      const tabOrigin = (() => { try { return new URL(tab.url).origin } catch { return '' } })()
      if (!tabOrigin) return
      const sameOriginIds = new Set()
      for (const ic of icons.value) {
        try { if (new URL(ic.url).origin === tabOrigin) sameOriginIds.add(ic.id) } catch {}
      }
      popupHighlightIds.value = sameOriginIds
      watch(icons, () => {
        const ids = new Set()
        for (const ic of icons.value) {
          try { if (new URL(ic.url).origin === tabOrigin) ids.add(ic.id) } catch {}
        }
        popupHighlightIds.value = ids
      }, { deep: true })
      const hasExactMatch = icons.value.some(ic => {
        try { return new URL(ic.url).href === new URL(tab.url).href } catch { return false }
      })
      if (!hasExactMatch) {
        openAddDialog()
        popupPrefillFromTab(tab)
      }
    } catch {}
  })()
}

// ====== 右键菜单 & 全局事件 ======
const contextMenu = ref(null)
let afterCtxMenuFlag = false

const spinningIds = ref(new Set())
function animateBgOpen(iconId) {
  if (spinningIds.value.has(iconId)) return
  spinningIds.value.add(iconId)
  setTimeout(() => {
    spinningIds.value.delete(iconId)
  }, 400)
}

function onIconContextMenu(e, iconId) {
  if (!showIcons.value) return
  const ic = icons.value.find(i => i.id === iconId)
  if (!ic || ic.type === 'builtin') return
  e.preventDefault()
  if (IS_POPUP) {
    openEditDialog(iconId)
    return
  }
  if (contextMenu.value === iconId) {
    closeContextMenu()
    openEditDialog(iconId)
    return
  }
  closeDialog()
  searchEdit.value = null
  contextMenu.value = iconId
}

function closeContextMenu() {
  if (contextMenu.value) afterCtxMenuFlag = true
  contextMenu.value = null
}

let _dialogMousedownInside = false
function onWindowClick(e) {
  if (contextMenu.value) contextMenu.value = null
  if (dialog.value) {
    const inside = e.target.closest('.dialog-box-wrapper, .dialog-grapheme-layer')
    const draggedOut = _dialogMousedownInside && !inside
    _dialogMousedownInside = false
    if (!inside && !draggedOut) closeDialog()
  }
  if (searchEdit.value) {
    const t = e.target
    if (!t.closest('.icon-cell') && !t.closest('.dialog-overlay')) {
      cancelSearch()
    }
  }
}

function onWindowKey(e) {
  if (e.key !== 'Escape') return
  const hasDialog = !!dialog.value
  const hasMenu = !!contextMenu.value
  if (!hasDialog && !hasMenu) return
  e.stopImmediatePropagation()
  e.preventDefault()
  if (hasMenu) closeContextMenu()
  if (hasDialog) {
    const active = document.activeElement
    if (active && active.closest && active.closest('.dialog-box-wrapper')) {
      active.blur()
      return
    }
    closeDialog()
    searchEdit.value = null
  }
}

function onWindowContextMenu(e) {
  let cancelling = false
  if (pendingDrag) { clearPendingDrag(); cancelling = true }
  if (iconDrag.value) {
    window.removeEventListener('mousemove', onIconDragMove)
    iconDrag.value = null
    iconDragHoverId.value = ''
    cancelling = true
  }
  if (dragState || selection.value) {
    window.removeEventListener('mousemove', onWinMouseMove)
    dragState = null
    selection.value = null
    cancelling = true
  }
  if (cancelling) {
    e.preventDefault()
    e.stopPropagation()
  }
}

// ====== 网格尺寸 & 全局事件注册 ======
const gridRef = ref(null)
let _viewFactor = 1
let _iconMaxPx = 48
let _cellH = 97
function updateCellVars() {
  const { cellW, cellH, offsetX, offsetY } = getGridOffset()
  _cellH = cellH
  const vw = viewportW.value
  const vh = viewportH.value
  iconsFitViewport.value = !(vw < 800 || vh < 600)

  const vwFactor = vw / 1600
  const vhFactor = vh / 1200
  _viewFactor = Math.min(1, Math.max(vwFactor, vhFactor))

  const iconScaleFactor = iconScale.value / 100

  _iconMaxPx = Math.min(cellW, cellH - LABEL_H)
  const iconPx = Math.round(Math.max(12, Math.min(_iconMaxPx, 48 * iconScaleFactor * _viewFactor)))
  iconBoxSize.value = iconPx

  const padPx = Math.max(0, Math.floor((cellH - iconPx - LABEL_H) / 3))

  const gap = 1
  const totalW = cellW * GRID_COLS + gap * (GRID_COLS - 1)
  const totalH = cellH * GRID_ROWS + gap * (GRID_ROWS - 1)

  if (!gridRef.value) return
  const el = gridRef.value
  el.style.setProperty('--cell-w', cellW + 'px')
  el.style.setProperty('--cell-h', cellH + 'px')
  el.style.setProperty('--grid-offset-x', offsetX + 'px')
  el.style.setProperty('--grid-offset-y', offsetY + 'px')
  el.style.setProperty('--icon-max', iconPx + 'px')
  el.style.setProperty('--icon-pad', padPx + 'px')
}

watch(iconScale, updateCellVars)
watch(showIcons, (v) => { if (v) nextTick(updateCellVars) })

onMounted(() => {
  updateCellVars()
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onWindowKey, true)
  window.addEventListener('resize', () => { closeContextMenu(); updateCellVars() })
  window.addEventListener('scroll', closeContextMenu, true)
  window.addEventListener('mousedown', onWinMouseDownCapture, { capture: true })
  window.addEventListener('contextmenu', onWindowContextMenu, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onWindowKey, true)
  window.removeEventListener('resize', closeContextMenu)
  window.removeEventListener('scroll', closeContextMenu, true)
  window.removeEventListener('mousedown', onWinMouseDownCapture, { capture: true })
  window.removeEventListener('contextmenu', onWindowContextMenu, true)
  window.removeEventListener('mousemove', onWinMouseMove)
  window.removeEventListener('mouseup', onWinMouseUp)
})

// ====== dialog 状态 & 表单 ======
const EMPTY_ICON = () => ({ id: '', name: '', fileId: null, iconUrl: '', darkFileId: null, darkIconUrl: '', url: '', row: -1, col: -1, autoInvert: false, scale: 100 })
const _INITIAL_HINT = computed(() => t('ic_modeNotice'))
function _clearErrHint() { if (dialogHint.value !== _INITIAL_HINT.value) dialogHint.value = '' }
const dialog = ref(null)
const dialogHint = ref('')
const dialogBoxRef = ref(null)
const emojiLayerRef = ref(null)
let emojiScrollSaveTimer = null
let _lastRowStart = -1
let _lastRowEnd = -1
let _scrollRaf = 0
function onEmojiLayerScroll() {
  const layer = emojiLayerRef.value
  if (!layer) return
  const vt = layer.scrollTop
  const vh = layer.clientHeight
  if (_scrollRaf) return
  _scrollRaf = requestAnimationFrame(() => {
    _scrollRaf = 0
    const sz = emojiSize.value
    const cols = emojiCols.value
    const totalRows = Math.ceil(GEMOJI_LIST.length / cols)
    const startRow = Math.max(0, Math.floor(vt / sz) - BUF_ROWS)
    const endRow = Math.min(totalRows, Math.ceil((vt + vh) / sz) + BUF_ROWS)
    if (startRow !== _lastRowStart || endRow !== _lastRowEnd) {
      _lastRowStart = startRow
      _lastRowEnd = endRow
      emojiScrollTop.value = vt
    }
    clearTimeout(emojiScrollSaveTimer)
    emojiScrollSaveTimer = setTimeout(() => {
      emojiScrollPos.value = vt
    }, 200)
  })
}
function restoreEmojiScroll() {
  const layer = emojiLayerRef.value
  if (!layer) return
  const mem = emojiScrollPos.value
  if (mem > 0) {
    nextTick(() => {
      layer.scrollTop = mem
      emojiScrollTop.value = mem
    })
  }
}
const form = reactive(EMPTY_ICON())
const dialogTheme = ref('light')
const formPrevFileId = ref(null)
const formPrevDarkFileId = ref(null)
const formPreviewUrl = ref('')
const formIconUrlDraft = ref('')
let preprocessed = false

function resetPreprocess() {
  preprocessed = false
}

// ====== grapheme 字符解析 ======
function tryExtractName() {
  if (form.name.trim()) return false
  try {
    const u = new URL(form.url.replace('%s', 'x'))
    form.name = u.hostname.replace(/^www\./, '').replace(/\.[^.]+$/, '')
    return true
  } catch { return false }
}

function isSingleGrapheme(str) {
  if (!str) return false
  const segments = Array.from(new Intl.Segmenter('en-US', { granularity: 'grapheme' }).segment(str))
  return segments.length === 1 && str.trim() === str
}

function graphemeFromStoredUrl(str) {
  if (!str) return null
  return isSingleGrapheme(str) ? str : null
}

function getIconGrapheme(ic) {
  if (ic.type === 'builtin') return null
  const isDark = themeMode.value === 'dark'
  const primaryUrl = isDark ? ic.darkIconUrl : ic.iconUrl
  const fallbackUrl = isDark ? ic.iconUrl : ic.darkIconUrl
  if (primaryUrl) {
    const g = graphemeFromStoredUrl(primaryUrl)
    if (g != null) return g
  }
  if (fallbackUrl) {
    const g = graphemeFromStoredUrl(fallbackUrl)
    if (g != null) return g
  }
  return null
}

function isUrlString(str) {
  if (!str) return false
  try { new URL(str); return true } catch { return false }
}

// ====== emoji 字符集 ======
const GEMOJI_RANGES = [
  [0x2200, 0x22FF],
  [0x2300, 0x23FF],
  [0x2500, 0x257F],
  [0x2580, 0x259F],
  [0x25A0, 0x25FF],
  [0x2600, 0x26FF],
  [0x2700, 0x27BF],
  [0x2B00, 0x2BFF],
  [0x2900, 0x297F],
  [0x2980, 0x29FF],
  [0x2A00, 0x2AFF],
  [0x1F000, 0x1F02F],
  [0x1F0A0, 0x1F0FF],
  [0x1F100, 0x1F1FF],
  [0x1F200, 0x1F2FF],
  [0x1F300, 0x1F5FF],
  [0x1F600, 0x1F64F],
  [0x1F680, 0x1F6FF],
  [0x1F700, 0x1F77F],
  [0x1F780, 0x1F7FF],
  [0x1F800, 0x1F8FF],
  [0x1F900, 0x1F9FF],
  [0x1FA00, 0x1FA6F],
  [0x1FA70, 0x1FAFF],
]

const COMBINING_MARKS = new Set([0x20E3, 0x200D, 0xFE0F, 0xFE0E])

function isLegalCp(cp) {
  if (cp < 0 || cp > 0x10FFFF) return false
  if (cp >= 0xD800 && cp <= 0xDFFF) return false
  if (cp >= 0xE000 && cp <= 0xF8FF) return false
  if (COMBINING_MARKS.has(cp)) return false
  return true
}

const GEMOJI_STRIP = (() => {
  const out = []
  for (const [lo, hi] of GEMOJI_RANGES) {
    for (let cp = lo; cp <= hi; cp++) {
      if (!isLegalCp(cp)) continue
      try {
        const ch = String.fromCodePoint(cp)
        if (!ch || ch.length === 0) continue
        out.push(ch)
      } catch { continue }
    }
  }
  return out.join('')
})()

const GEMOJI_LIST = Array.from(
  new Intl.Segmenter('en-US', { granularity: 'grapheme' }).segment(GEMOJI_STRIP)
).map(s => s.segment)

const EMOJI_MIN = 80
const EMOJI_MAX = 160
const emojiSize = computed(() => {
  const s = Math.floor(viewportW.value / 10)
  return Math.max(EMOJI_MIN, Math.min(EMOJI_MAX, s))
})
const BUF_ROWS = 2
const emojiCols = ref(8)
const emojiScrollTop = ref(0)
const emojiViewportH = ref(400)

const totalRows = computed(() => Math.ceil(GEMOJI_LIST.length / emojiCols.value))

const visibleItems = computed(() => {
  const cols = emojiCols.value
  const { startRow, endRow } = visibleRange.value
  const out = []
  const startIdx = startRow * cols
  const endIdx = Math.min(GEMOJI_LIST.length, endRow * cols)
  for (let i = startIdx; i < endIdx; i++) {
    out.push(i)
  }
  return out
})

const visibleRange = computed(() => {
  const sz = emojiSize.value
  const startRow = Math.max(0, Math.floor(emojiScrollTop.value / sz) - BUF_ROWS)
  const endRow = Math.min(totalRows.value, Math.ceil((emojiScrollTop.value + emojiViewportH.value) / sz) + BUF_ROWS)
  return { startRow, endRow }
})

function updateEmojiCols() {
  const layer = emojiLayerRef.value
  if (!layer) return
  const w = layer.clientWidth
  const sz = emojiSize.value
  const cols = Math.max(1, Math.floor(w / sz))
  if (cols !== emojiCols.value) emojiCols.value = cols
  emojiViewportH.value = layer.clientHeight
}

let colResizeObserver = null
function setupEmojiObserver() {
  updateEmojiCols()
  if (colResizeObserver) colResizeObserver.disconnect()
  colResizeObserver = new ResizeObserver(() => updateEmojiCols())
  if (emojiLayerRef.value) colResizeObserver.observe(emojiLayerRef.value)
}
function teardownEmojiObserver() {
  if (colResizeObserver) { colResizeObserver.disconnect(); colResizeObserver = null }
}

function pickGrapheme(ch) {
  const isDark = dialogTheme.value === 'dark'
  const oldFileId = isDark ? form.darkFileId : form.fileId
  const oldOtherFileId = isDark ? form.fileId : form.darkFileId
  if (isDark) {
    form.darkFileId = null
    form.darkIconUrl = ch
  } else {
    form.fileId = null
    form.iconUrl = ch
  }
  formIconUrlDraft.value = ch
  updatePreviewForMode()
  _clearErrHint()
  const prevFileId = isDark ? formPrevDarkFileId.value : formPrevFileId.value
  if (oldFileId && oldFileId !== prevFileId) deleteIconFile(oldFileId).catch(() => {})
}

// ====== 自动获取 favicon ======
let faviconTrial = null
async function tryAutoFavicon() {
  if (form.fileId || form.iconUrl) return
  const raw = form.url.trim()
  if (!raw) return
  let origin
  try {
    const testUrl = raw.replace('%s', 'x')
    const u = new URL(testUrl)
    if (!/^https?:$/.test(u.protocol)) return
    origin = u.origin
  } catch { return }
  if (faviconTrial) { faviconTrial.onload = null; faviconTrial.onerror = null }
  faviconTrial = new Image()
  faviconTrial.referrerPolicy = 'no-referrer'
  const candidates = [`${origin}/favicon.ico`, `${origin}/favicon.png`, `${origin}/favicon.svg`]
  let idx = 0
  function tryNext() {
    if (idx >= candidates.length) return
    faviconTrial.src = candidates[idx++]
  }
  faviconTrial.onload = () => {
    form.iconUrl = faviconTrial.src
    if (dialogTheme.value !== 'dark') formIconUrlDraft.value = faviconTrial.src
    updatePreviewForMode()
  }
  faviconTrial.onerror = () => tryNext()
  tryNext()
}

function autoPreprocess(force = false) {
  if (!force && preprocessed) return
  if (!form.url.trim()) return
  if (form.fileId || form.iconUrl) { preprocessed = true; return }
  const didName = tryExtractName()
  if (didName || !form.fileId) tryAutoFavicon()
  preprocessed = true
}

watch(() => form.url, (val, oldVal) => {
  if (oldVal && oldVal.length >= 6 && !val.trim()) { preprocessed = false; return }
  if (preprocessed) return
  if (!oldVal || !oldVal.trim()) {
    if (val.length >= 6) autoPreprocess()
  }
})

// ====== dialog 预览 ======
const applyNeedsAttention = computed(() => {
  const isDark = dialogTheme.value === 'dark'
  const primaryUrl = isDark ? form.darkIconUrl : form.iconUrl
  const draft = formIconUrlDraft.value.trim()
  if (draft) return draft !== primaryUrl
  return false
})

const applyOrUnsetEnabled = computed(() => {
  const isDark = dialogTheme.value === 'dark'
  const primaryUrl = isDark ? form.darkIconUrl : form.iconUrl
  const draft = formIconUrlDraft.value.trim()
  return !!primaryUrl || draft !== primaryUrl
})

const isClearingIcon = computed(() => {
  const isDark = dialogTheme.value === 'dark'
  const primaryUrl = isDark ? form.darkIconUrl : form.iconUrl
  const draft = formIconUrlDraft.value.trim()
  return !!primaryUrl && draft === primaryUrl
})

const previewGrapheme = computed(() => {
  const isDark = dialogTheme.value === 'dark'
  const primaryFid = isDark ? form.darkFileId : form.fileId
  const primaryUrl = isDark ? form.darkIconUrl : form.iconUrl
  if (!primaryFid) {
    const g = graphemeFromStoredUrl(primaryUrl)
    if (g) return g
  }
  const fallbackFid = isDark ? form.fileId : form.darkFileId
  const fallbackUrl = isDark ? form.iconUrl : form.darkIconUrl
  if (!fallbackFid) {
    return graphemeFromStoredUrl(fallbackUrl)
  }
  return null
})

const _previewUsingFallback = ref(false)
const previewInvert = computed(() => !!(form.autoInvert && _previewUsingFallback.value))

function updatePreviewForMode() {
  const isDark = dialogTheme.value === 'dark'
  const primaryFid = isDark ? form.darkFileId : form.fileId
  const primaryUrl = isDark ? form.darkIconUrl : form.iconUrl
  const fallbackFid = isDark ? form.fileId : form.darkFileId
  const fallbackUrl = isDark ? form.iconUrl : form.darkIconUrl
  if (primaryFid && iconBlobs[primaryFid]) { formPreviewUrl.value = iconBlobs[primaryFid]; _previewUsingFallback.value = false; return }
  if (primaryUrl) {
    if (graphemeFromStoredUrl(primaryUrl) != null) { formPreviewUrl.value = ''; _previewUsingFallback.value = false; return }
    formPreviewUrl.value = primaryUrl; _previewUsingFallback.value = false; return
  }
  if (fallbackFid && iconBlobs[fallbackFid]) { formPreviewUrl.value = iconBlobs[fallbackFid]; _previewUsingFallback.value = true; return }
  if (fallbackUrl) {
    if (graphemeFromStoredUrl(fallbackUrl) != null) { formPreviewUrl.value = ''; _previewUsingFallback.value = true; return }
    formPreviewUrl.value = fallbackUrl; _previewUsingFallback.value = true; return
  }
  formPreviewUrl.value = ''
  _previewUsingFallback.value = false
}

watch(dialogTheme, () => {
  updatePreviewForMode()
  syncDraftForCurrentMode()
})
watch(() => [form.fileId, form.darkFileId], updatePreviewForMode, { deep: true })

// ====== dialog 打开关闭 / emoji 交互 / 图标增删改 ======
function syncDraftForCurrentMode() {
  const isDark = dialogTheme.value === 'dark'
  const raw = isDark ? form.darkIconUrl : form.iconUrl
  formIconUrlDraft.value = raw || ''
}

function openAddDialog() {
  closeContextMenu()
  Object.assign(form, EMPTY_ICON(), { row: -1, col: -1 })
  dialogTheme.value = themeMode.value
  formPrevFileId.value = null
  formPrevDarkFileId.value = null
  formPreviewUrl.value = ''
  formIconUrlDraft.value = ''
  dialogHint.value = t('ic_modeNotice')
  resetPreprocess()
  dialog.value = { mode: 'add' }
  nextTick(() => {
    const input = document.querySelector('.dialog-url .ui-input-field')
    if (input) input.focus()
  })
}

function openEditDialog(iconId) {
  closeContextMenu()
  const ic = icons.value.find(i => i.id === iconId)
  if (!ic || ic.type === 'builtin') return
  Object.assign(form, ic)
  form.scale = ic.scale ?? 100
  preprocessed = true
  dialogTheme.value = themeMode.value
  syncDraftForCurrentMode()
  formPrevFileId.value = ic.fileId
  formPrevDarkFileId.value = ic.darkFileId || null
  updatePreviewForMode()
  dialogHint.value = t('ic_modeNotice')
  dialog.value = { mode: 'edit', iconId }
  nextTick(() => {
    resetPreprocess()
    const input = document.querySelector('.dialog-url .ui-input-field')
    if (input) input.focus()
  })
}

function closeDialog() {
  dialog.value = null
  dialogHint.value = ''
  _hitCache.clear()
  setTimeout(() => {
    if (form.fileId && form.fileId !== formPrevFileId.value) {
      deleteIconFile(form.fileId).catch(() => {})
    }
    if (form.darkFileId && form.darkFileId !== formPrevDarkFileId.value) {
      deleteIconFile(form.darkFileId).catch(() => {})
    }
    Object.assign(form, EMPTY_ICON())
    formPrevFileId.value = null
    formPrevDarkFileId.value = null
    formPreviewUrl.value = ''
    formIconUrlDraft.value = ''
    resetPreprocess()
  }, 150)
}

watch(dialog, (val, oldVal) => {
  if (val && !oldVal) {
    nextTick(() => {
      setupEmojiObserver()
      restoreEmojiScroll()
    })
  }
  if (oldVal) {
    const layer = emojiLayerRef.value
    if (layer) emojiScrollPos.value = layer.scrollTop
    teardownEmojiObserver()
  }
})

function onEmojiLayerClick(e) {
  const cell = e.target.closest('.emoji-cell')
  if (cell) {
    const rect = cell.getBoundingClientRect()
    const sz = rect.width
    const px = Math.floor(e.clientX - rect.left)
    const py = Math.floor(e.clientY - rect.top)
    const idx = parseInt(cell.dataset.index, 10)
    const ch = GEMOJI_LIST[idx]
    if (ch && px >= 0 && py >= 0 && px < sz && py < sz) {
      const { map, mapSz } = _getAlphaMap(ch, sz)
      const mx = Math.min(mapSz - 1, Math.floor(px * mapSz / sz))
      const my = Math.min(mapSz - 1, Math.floor(py * mapSz / sz))
      if (map[my * mapSz + mx] > 20) {
        pickGrapheme(ch)
        return
      }
    }
  }
  closeDialog()
}

let _hitCanvas = null
const _hitCache = new Map()

function _getAlphaMap(ch, sz) {
  const mapSz = 10
  const key = ch + '@' + mapSz
  let entry = _hitCache.get(key)
  if (entry) return entry
  if (!_hitCanvas) _hitCanvas = document.createElement('canvas')
  _hitCanvas.width = mapSz
  _hitCanvas.height = mapSz
  const ctx = _hitCanvas.getContext('2d')
  ctx.clearRect(0, 0, mapSz, mapSz)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const scale = mapSz / sz
  ctx.font = `${Math.round(40 * scale)}px "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif`
  ctx.fillText(ch, mapSz / 2, mapSz / 2)
  const img = ctx.getImageData(0, 0, mapSz, mapSz).data
  const map = new Uint8Array(mapSz * mapSz)
  for (let i = 0, j = 3; i < map.length; i++, j += 4) map[i] = img[j]
  entry = { map, mapSz }
  _hitCache.set(key, entry)
  return entry
}

let _hoverThrottle = false
function onEmojiLayerMousemove(e) {
  if (_hoverThrottle) return
  _hoverThrottle = true
  requestAnimationFrame(() => {
    _hoverThrottle = false
    const cell = e.target.closest('.emoji-cell')
    const layer = emojiLayerRef.value
    if (!cell || !layer) return
    const rect = cell.getBoundingClientRect()
    const sz = rect.width
    const px = Math.floor(e.clientX - rect.left)
    const py = Math.floor(e.clientY - rect.top)
    if (px < 0 || py < 0 || px >= sz || py >= sz) { layer.style.cursor = 'auto'; return }
    const idx = parseInt(cell.dataset.index, 10)
    const ch = GEMOJI_LIST[idx]
    if (!ch) { layer.style.cursor = 'auto'; return }
    const { map, mapSz } = _getAlphaMap(ch, sz)
    const mx = Math.min(mapSz - 1, Math.floor(px * mapSz / sz))
    const my = Math.min(mapSz - 1, Math.floor(py * mapSz / sz))
    layer.style.cursor = map[my * mapSz + mx] > 20 ? 'pointer' : 'auto'
  })
}

function getNextEmptyPos() {
  const occupied = new Set(icons.value.filter(i => i.type !== 'builtin').map(i => `${i.row},${i.col}`))
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      if (!occupied.has(`${r},${c}`)) return { row: r, col: c }
    }
  }
  return { row: -1, col: -1 }
}

function validateAndFixIcons() {
  const seen = new Map()
  const bad = []
  for (const ic of icons.value) {
    if (ic.type === 'builtin') continue
    if (ic.row < 0 || ic.col < 0 || ic.row >= GRID_ROWS || ic.col >= GRID_COLS) {
      bad.push(ic); continue
    }
    const key = `${ic.row},${ic.col}`
    if (seen.has(key)) {
      bad.push(ic)
    } else {
      seen.set(key, ic)
    }
  }
  for (const ic of bad) {
    const pos = getNextEmptyPos()
    if (pos.row >= 0) {
      ic.row = pos.row
      ic.col = pos.col
    }
  }
}

async function handleFileUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 1024 * 1024 * 4) {
    dialogHint.value = t('ic_invalidFileSize')
    e.target.value = ''
    return
  }
  const isDark = dialogTheme.value === 'dark'
  const img = new Image()
  const url = URL.createObjectURL(file)
  img.onload = async () => {
    URL.revokeObjectURL(url)
    if (img.width > 1024 || img.height > 1024) {
      dialogHint.value = t('ic_invalidFileDim')
      e.target.value = ''
      return
    }
    const oldFileId = isDark ? form.darkFileId : form.fileId
    const fileId = newIconFileId()
    await putIconFile(fileId, file)
    if (isDark) { form.darkFileId = fileId; form.darkIconUrl = '' }
    else { form.fileId = fileId; form.iconUrl = '' }
    formIconUrlDraft.value = ''
    if (iconBlobs[fileId]) URL.revokeObjectURL(iconBlobs[fileId])
    iconBlobs[fileId] = URL.createObjectURL(file)
    updatePreviewForMode()
    _clearErrHint()
    const prevFileId = isDark ? formPrevDarkFileId.value : formPrevFileId.value
    if (oldFileId && oldFileId !== prevFileId) deleteIconFile(oldFileId).catch(() => {})
    e.target.value = ''
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    dialogHint.value = t('ic_cannotReadFile')
    e.target.value = ''
  }
  img.src = url
}

function applyIconUrl() {
  const isDark = dialogTheme.value === 'dark'
  const raw = formIconUrlDraft.value.trim()
  if (isClearingIcon.value) {
    if (isDark) form.darkIconUrl = ''; else form.iconUrl = ''
  } else {
    if (raw && !isSingleGrapheme(raw)) {
      try { new URL(raw) } catch { dialogHint.value = t('ic_invalidImgUrl'); return }
    }
    const oldFileId = isDark ? form.darkFileId : form.fileId
    const prevFileId = isDark ? formPrevDarkFileId.value : formPrevFileId.value
    if (isDark) { form.darkIconUrl = raw; form.darkFileId = null }
    else { form.iconUrl = raw; form.fileId = null }
    if (oldFileId && oldFileId !== prevFileId) deleteIconFile(oldFileId).catch(() => {})
  }
  _clearErrHint()
  updatePreviewForMode()
}

function validateFormIconUrl() {
  const raw = formIconUrlDraft.value.trim()
  if (!raw) { _clearErrHint(); return true }
  if (isSingleGrapheme(raw)) { _clearErrHint(); return true }
  try { new URL(raw) } catch { dialogHint.value = t('ic_invalidImgUrl'); return false }
  _clearErrHint()
  return true
}

function addOrSaveIcon() {
  autoPreprocess(true)
  const name = form.name.trim()
  const url = form.url.trim()
  if (!url) { dialogHint.value = t('ic_pleaseEnterUrl'); return }

  const isSearch = url.includes('%s')
  const pos = dialog.value.mode === 'edit' && form.row >= 0 && form.col >= 0
    ? { row: form.row, col: form.col }
    : getNextEmptyPos()
  if (pos.row < 0) return

  const payload = {
    id: form.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    row: pos.row,
    col: pos.col,
    ...(name ? { name } : {}),
    ...(form.type && form.type !== 'custom' ? { type: form.type } : {}),
    ...(form.fileId ? { fileId: form.fileId } : {}),
    ...(!form.fileId && form.iconUrl ? { iconUrl: form.iconUrl } : {}),
    ...(form.darkFileId ? { darkFileId: form.darkFileId } : {}),
    ...(!form.darkFileId && form.darkIconUrl ? { darkIconUrl: form.darkIconUrl } : {}),
    ...(isSearch ? { search: true } : {}),
    ...(form.autoInvert ? { autoInvert: true } : {}),
    ...((form.scale ?? 100) !== 100 ? { scale: form.scale } : {})
  }

  if (form.fileId && !iconBlobs[form.fileId]) {
    getIconFile(form.fileId).then(blob => {
      if (blob) iconBlobs[form.fileId] = URL.createObjectURL(blob)
    })
  }
  if (form.darkFileId && !iconBlobs[form.darkFileId]) {
    getIconFile(form.darkFileId).then(blob => {
      if (blob) iconBlobs[form.darkFileId] = URL.createObjectURL(blob)
    })
  }

  if (dialog.value.mode === 'edit') {
    const idx = icons.value.findIndex(i => i.id === payload.id)
    if (idx >= 0) {
      const old = icons.value[idx]
      if (old.fileId && old.fileId !== payload.fileId) deleteIconFile(old.fileId).catch(() => {})
      if (old.darkFileId && old.darkFileId !== payload.darkFileId) deleteIconFile(old.darkFileId).catch(() => {})
      icons.value.splice(idx, 1, payload)
    }
  } else {
    icons.value.push(payload)
  }
  ensureBuiltinOnAddOrDrag(icons.value)

  formPrevFileId.value = form.fileId || null
  formPrevDarkFileId.value = form.darkFileId || null
  closeDialog()
}

function deleteIcon(iconId) {
  closeContextMenu()
  const idx = icons.value.findIndex(i => i.id === iconId)
  if (idx < 0) return
  const ic = icons.value[idx]
  if (ic.type === 'builtin') return
  const delPos = { row: ic.row, col: ic.col }
  icons.value.splice(idx, 1)
  ensureBuiltinOnDelete(icons.value, delPos)
  for (const fid of [ic.fileId, ic.darkFileId]) {
    if (fid) {
      deleteIconFile(fid).catch(() => {})
      if (iconBlobs[fid]) {
        URL.revokeObjectURL(iconBlobs[fid])
        delete iconBlobs[fid]
      }
    }
  }
}

function getIconImgSrc(ic) {
  if (ic.type === 'builtin') return ''
  const isDark = themeMode.value === 'dark'
  const primaryFid = isDark ? ic.darkFileId : ic.fileId
  const primaryUrl = isDark ? ic.darkIconUrl : ic.iconUrl
  const fallbackFid = isDark ? ic.fileId : ic.darkFileId
  const fallbackUrl = isDark ? ic.iconUrl : ic.darkIconUrl
  if (primaryFid && iconBlobs[primaryFid]) return iconBlobs[primaryFid]
  if (primaryUrl && graphemeFromStoredUrl(primaryUrl) == null) return primaryUrl
  if (fallbackFid && iconBlobs[fallbackFid]) return iconBlobs[fallbackFid]
  if (fallbackUrl && graphemeFromStoredUrl(fallbackUrl) == null) return fallbackUrl
  return ''
}

function _isUsingFallback(ic) {
  if (ic.type === 'builtin') return false
  const isDark = themeMode.value === 'dark'
  const primaryFid = isDark ? ic.darkFileId : ic.fileId
  const primaryUrl = isDark ? ic.darkIconUrl : ic.iconUrl
  if (primaryFid || primaryUrl) return false
  const fallbackFid = isDark ? ic.fileId : ic.darkFileId
  const fallbackUrl = isDark ? ic.iconUrl : ic.darkIconUrl
  return !!(fallbackFid || fallbackUrl)
}

function _iconInvert(ic) {
  if (ic.type === 'builtin') return false
  if (!ic.autoInvert) return false
  return _isUsingFallback(ic)
}

// ====== 搜索与标签页操作 ======
const searchEdit = ref(null)
const searchInput = ref('')

async function _findExistingTab(url) {
  const tabsApi = _tabsApi()
  if (!tabsApi) return null
  try {
    const tabs = await tabsApi.query({})
    return tabs.find(t => t && t.url === url) || null
  } catch { return null }
}

async function openInCurrentTab(url) {
  const tabsApi = _tabsApi()
  if (tabsApi) {
    try {
      const existing = await _findExistingTab(url)
      if (existing) { await tabsApi.update(existing.id, { active: true }); return }
      if (url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('chrome://')) {
        await tabsApi.create({ url, active: true })
        return
      }
      const [tab] = await tabsApi.query({ active: true, currentWindow: true })
      if (tab && tab.id != null) { await tabsApi.update(tab.id, { url }); return }
    } catch {}
  }
  window.location.href = url
}

async function openInNewTab(url, active = false, dedupe = true) {
  const tabsApi = _tabsApi()
  if (tabsApi) {
    try {
      if (dedupe) {
        const existing = await _findExistingTab(url)
        if (existing) {
          if (active) await tabsApi.update(existing.id, { active: true })
          return
        }
      }
      await tabsApi.create({ url, active })
      return
    } catch {}
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

function onIconClick(e, ic) {
  if (didIconDrag) { didIconDrag = false; return }
  if (Date.now() - _iconPressStart > DRAG_HOLD_MS) {
    if (ic.search && !dialog.value && !contextMenu.value) {
      searchEdit.value = ic.id
      searchInput.value = ''
      nextTick(() => {
        const el = document.querySelector('.search-edit-input')
        if (el) { el.focus(); el.select() }
      })
    }
    return
  }
  if (iconDrag.value) return
  if (e.target.closest('.search-edit-input')) return
  const afterCtx = afterCtxMenuFlag; afterCtxMenuFlag = false
  if (dialog.value || contextMenu.value) return
  if (ic.type === 'builtin') {
    e.stopPropagation()
    openAddDialog()
    if (IS_POPUP) popupPrefillFromTab()
    return
  }
  if (IS_POPUP) {
    e.stopPropagation()
    openEditDialog(ic.id)
  } else if (ic.search) {
    if (searchEdit.value === ic.id && searchInput.value.trim()) {
      const url = ic.url.replace('%s', encodeURIComponent(searchInput.value.trim()))
      openInNewTab(url, false, true)
      animateBgOpen(ic.id)
    } else {
      searchEdit.value = ic.id
      searchInput.value = ''
      nextTick(() => {
        const el = document.querySelector('.search-edit-input')
        if (el) { el.focus(); el.select() }
      })
    }
  } else {
    const isBgOpen = afterCtx || e.ctrlKey || e.metaKey || e.button === 1
    if (isBgOpen) {
      e.preventDefault()
      openInNewTab(ic.url, false, true)
      animateBgOpen(ic.id)
    } else {
      openInCurrentTab(ic.url)
    }
  }
}

function submitSearch(e) {
  const q = searchInput.value.trim()
  if (q) {
    const ic = icons.value.find(i => i.id === searchEdit.value)
    if (ic) {
      const url = ic.url.replace('%s', encodeURIComponent(q))
      if (e.ctrlKey || e.metaKey) { openInNewTab(url, false, true); animateBgOpen(ic.id) }
      else openInCurrentTab(url)
    }
  }
  searchEdit.value = null
  searchInput.value = ''
}

function cancelSearch() {
  searchEdit.value = null
  searchInput.value = ''
}

// ====== 网格几何 ======
function getGridOffset() {
  const vw = viewportW.value
  const vh = viewportH.value
  const cellW = Math.max(0, Math.floor(vw / GRID_COLS) - 1)
  const cellH = Math.max(0, Math.floor(vh / GRID_ROWS) - 1)
  const gap = 1
  const totalW = cellW * GRID_COLS + gap * (GRID_COLS - 1)
  const totalH = cellH * GRID_ROWS + gap * (GRID_ROWS - 1)
  return { offsetX: Math.floor((vw - totalW) / 2), offsetY: Math.floor((vh - totalH) / 2), gap, cellW, cellH }
}

function gridToPx(row, col) {
  const { offsetX, offsetY, gap, cellW, cellH } = getGridOffset()
  const left = offsetX + col * (cellW + gap)
  const top = offsetY + row * (cellH + gap)
  return {
    left,
    top,
    right: left + cellW,
    bottom: top + cellH,
    width: cellW,
    height: cellH
  }
}

function pxToGrid(x, y) {
  const { offsetX, offsetY, gap, cellW, cellH } = getGridOffset()
  const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor((x - offsetX) / (cellW + gap))))
  const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor((y - offsetY) / (cellH + gap))))
  return { row, col }
}

// ====== 拖拽 ======
const selection = ref(null)
let dragState = null
const iconDrag = ref(null)
const iconDragCursor = reactive({ x: 0, y: 0 })
const iconDragHoverId = ref('')
const hoverLockedId = ref('')
watch(hoverLockedId, (val) => {
  document.body.classList.toggle('icons-hover-locked', !!val)
})
let didIconDrag = false
let pendingDrag = null
let _iconPressStart = 0
let _selectionJustFinished = false

function _blockNextClick() {
  const handler = (e) => {
    e.stopPropagation()
    e.preventDefault()
    window.removeEventListener('click', handler, true)
  }
  window.addEventListener('click', handler, true)
}
const DRAG_HOLD_MS = 250

function clearPendingDrag() {
  if (pendingDrag) {
    clearTimeout(pendingDrag.timer)
    pendingDrag = null
  }
  hoverLockedId.value = ''
}

function startPendingDrag(e, dragData, onUp) {
  clearPendingDrag()
  pendingDrag = {
    startX: e.clientX,
    startY: e.clientY,
    timer: setTimeout(() => {
      iconDragCursor.x = e.clientX
      iconDragCursor.y = e.clientY
      iconDrag.value = dragData
      didIconDrag = true
      window.addEventListener('mousemove', onIconDragMove)
      window.addEventListener('mouseup', onUp, { once: true })
      pendingDrag = null
    }, DRAG_HOLD_MS)
  }
  const upHandler = () => clearPendingDrag()
  window.addEventListener('mouseup', upHandler, { once: true })
}

function findCellAt(x, y, excludeId) {
  for (const ic of icons.value) {
    if (ic.id === excludeId) continue
    const p = gridToPx(ic.row, ic.col)
    if (x >= p.left && x <= p.right && y >= p.top && y <= p.bottom) return { type: 'icon', id: ic.id, row: ic.row, col: ic.col }
  }
  return null
}

function findNearestEmptyCell(x, y, excludeRow, excludeCol, folder) {
  const occupied = new Set(
    icons.value
      .filter(i => !(i.row === excludeRow && i.col === excludeCol))
      .map(i => `${i.row},${i.col}`)
  )
  let rStart = 0, rEnd = GRID_ROWS, cStart = 0, cEnd = GRID_COLS
  if (folder) {
    rStart = folder.startRow
    rEnd = folder.endRow + 1
    cStart = folder.startCol
    cEnd = folder.endCol + 1
  }
  const v = pxToGrid(x, y)
  function dirRank(r, c) {
    const dr = r - v.row, dc = c - v.col
    if (dr > 0 && dc === 0) return 0
    if (dr < 0 && dc === 0) return 1
    if (dc < 0 && dr === 0) return 2
    if (dc > 0 && dr === 0) return 3
    if (dr > 0 && dc < 0) return 4
    if (dr > 0 && dc > 0) return 5
    if (dr < 0 && dc < 0) return 6
    if (dr < 0 && dc > 0) return 7
    return 8
  }
  let best = null
  let bestDist = Infinity
  let bestDir = Infinity
  for (let r = rStart; r < rEnd; r++) {
    for (let c = cStart; c < cEnd; c++) {
      if (occupied.has(`${r},${c}`)) continue
      const d = Math.max(Math.abs(r - v.row), Math.abs(c - v.col))
      const dr = dirRank(r, c)
      if (d < bestDist || (d === bestDist && dr < bestDir)) {
        bestDist = d; bestDir = dr; best = { row: r, col: c }
      }
    }
  }
  return best
}

function onIconMouseDown(e, ic) {
  if (e.button !== 0) return
  if (e.ctrlKey || e.metaKey) return
  _iconPressStart = Date.now()
  if (contextMenu.value) {
    if (e.target.closest('.icon-ctx-row')) return
    closeContextMenu(); return
  }
  if (searchEdit.value) {
    if (e.target.closest('.search-edit-input')) return
    if (ic.search && ic.id === searchEdit.value && searchInput.value.trim()) {
      // 保持 searchEdit 不变，让后续 click 处理后台打开
    } else {
      cancelSearch()
    }
    e.preventDefault()
    return
  }
  if (dialog.value) return
  e.preventDefault()
  closeContextMenu()

  const parentFolder = folders.value.find(f => pointInFolder(ic.row, ic.col, f))
  if (!parentFolder || !folderHasTitle(parentFolder)) {
    const px = gridToPx(ic.row, ic.col)
    const thresholdX = viewportW.value / GRID_COLS * 0.3
    const thresholdY = viewportH.value / GRID_ROWS * 0.3
    const dx = Math.abs(e.clientX - (px.left + (px.right - px.left) / 2))
    const dy = Math.abs(e.clientY - (px.top + (px.bottom - px.top) / 2))
    if (dx > thresholdX || dy > thresholdY) {
      hoverLockedId.value = ''
      selection.value = null
      dragState = { startX: e.clientX, startY: e.clientY }
      window.addEventListener('mousemove', onWinMouseMove)
      window.addEventListener('mouseup', onWinMouseUp, { once: true })
      return
    }
  }

  hoverLockedId.value = ic.id
  const rect = e.currentTarget.getBoundingClientRect()
  startPendingDrag(e, {
    iconId: ic.id,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    origRow: ic.row,
    origCol: ic.col,
    targetRow: ic.row,
    targetCol: ic.col
  }, onIconDragUp)
}

async function popupPrefillFromTab(existingTab) {
  try {
    let tab = existingTab
    if (!tab) {
      const tabsApi = _tabsApi()
      if (!tabsApi) return
      ;[tab] = await tabsApi.query({ active: true, currentWindow: true })
    }
    if (!tab || !tab.url) return
    form.url = tab.url
    preprocessed = true
    form.name = tab.title || ''
    if (tab.favIconUrl) {
      const isDark = dialogTheme.value === 'dark'
      if (isDark) { form.darkIconUrl = tab.favIconUrl; form.darkFileId = null }
      else { form.iconUrl = tab.favIconUrl; form.fileId = null }
      formIconUrlDraft.value = tab.favIconUrl
      updatePreviewForMode()
    }
    nextTick(() => {
      resetPreprocess()
      const input = document.querySelector('.dialog-fields .dialog-row:nth-child(3) .ui-input-field')
      if (input) { input.focus() }
    })
  } catch {}
}

function onIconDragMove(e) {
  const drag = iconDrag.value
  if (!drag) return
  didIconDrag = true
  iconDragCursor.x = e.clientX
  iconDragCursor.y = e.clientY
  const hover = findCellAt(e.clientX, e.clientY, drag.iconId)
  iconDragHoverId.value = hover ? hover.id : ''
  drag.victimTargetRow = undefined
  drag.victimTargetCol = undefined
  if (hover && hover.type === 'icon') {
    const victim = icons.value.find(i => i.id === hover.id)
    if (victim) {
      const victimPos = gridToPx(victim.row, victim.col)
      const excludeR = drag.origRow
      const excludeC = drag.origCol
      const folder = folders.value.find(f => pointInFolder(victim.row, victim.col, f))
      let free = folder
        ? findNearestEmptyCell(victimPos.left + victimPos.width / 2, victimPos.top + victimPos.height / 2, excludeR, excludeC, folder)
        : null
      if (!free) {
        free = findNearestEmptyCell(victimPos.left + victimPos.width / 2, victimPos.top + victimPos.height / 2, excludeR, excludeC)
      }
      if (free) {
        drag.targetRow = free.row
        drag.targetCol = free.col
        drag.victimTargetRow = free.row
        drag.victimTargetCol = free.col
        return
      }
    }
  }
  const target = findNearestEmptyCell(e.clientX, e.clientY, drag.origRow, drag.origCol)
  if (target) {
    drag.targetRow = target.row
    drag.targetCol = target.col
  }
}

function onIconDragUp(e) {
  if (e && e.button === 2) {
    hoverLockedId.value = ''
    iconDragHoverId.value = ''
    window.removeEventListener('mousemove', onIconDragMove)
    iconDrag.value = null
    return
  }
  hoverLockedId.value = ''
  iconDragHoverId.value = ''
  const drag = iconDrag.value
  window.removeEventListener('mousemove', onIconDragMove)
  if (!drag) return
  const ic = icons.value.find(i => i.id === drag.iconId)
  if (!ic) { iconDrag.value = null; return }

  const hover = findCellAt(iconDragCursor.x, iconDragCursor.y, drag.iconId)
  if (hover) {
    const victim = icons.value.find(i => i.id === hover.id)
    if (victim && drag.victimTargetRow !== undefined) {
      victim.row = drag.victimTargetRow
      victim.col = drag.victimTargetCol
    }
    ic.row = hover.row
    ic.col = hover.col
  } else if (drag.targetRow !== drag.origRow || drag.targetCol !== drag.origCol) {
    ic.row = drag.targetRow
    ic.col = drag.targetCol
  }
  iconDrag.value = null
  ensureBuiltinOnAddOrDrag(icons.value)
}

// ====== 文件夹 ======
function folderAreaOnlyOne(startRow, startCol, endRow, endCol) {
  return startRow === endRow && startCol === endCol
}

function findFolderAt(startRow, startCol, endRow, endCol) {
  return folders.value.findIndex(
    f => f.startRow === startRow && f.startCol === startCol && f.endRow === endRow && f.endCol === endCol
  )
}

function pointInFolder(r, c, f) {
  return r >= f.startRow && r <= f.endRow && c >= f.startCol && c <= f.endCol
}

function rectContains(a, b) {
  return a.startRow <= b.startRow && a.startCol <= b.startCol
      && a.endRow >= b.endRow && a.endCol >= b.endCol
}

function rectsOverlap(a, b) {
  return !(a.endRow < b.startRow || b.endRow < a.startRow
        || a.endCol < b.startCol || b.endCol < a.startCol)
}

function isIconInFolder(ic) {
  return folders.value.some(f => pointInFolder(ic.row, ic.col, f))
}

function folderHasTitle(f) {
  return !!(f.titleTop || f.titleBottom)
}

function onWinMouseDownCapture(e) {
  if (!showIcons.value) return
  if (e.button !== 0) return
  if (e.ctrlKey || e.metaKey) return
  if (dialog.value) return
  if (e.target.closest('.icon-cell')) return
  if (e.target.closest('.dialog-overlay')) return
  if (e.target.closest('.folder-title')) return
  if (e.target.closest('.icon-scale-slider')) return
  if (searchEdit.value) { cancelSearch(); return }
  selection.value = null
  dragState = { startX: e.clientX, startY: e.clientY }
  window.addEventListener('mousemove', onWinMouseMove)
  window.addEventListener('mouseup', onWinMouseUp, { once: true })
}

function onWinMouseMove(e) {
  if (!dragState) return
  const g1 = pxToGrid(dragState.startX, dragState.startY)
  const g2 = pxToGrid(e.clientX, e.clientY)
  const r1 = Math.min(g1.row, g2.row), r2 = Math.max(g1.row, g2.row)
  const c1 = Math.min(g1.col, g2.col), c2 = Math.max(g1.col, g2.col)
  selection.value = { startRow: r1, startCol: c1, endRow: r2, endCol: c2 }
}

function onWinMouseUp(e) {
  window.removeEventListener('mousemove', onWinMouseMove)
  if (e && e.button === 2) {
    dragState = null
    selection.value = null
    return
  }
  const sel = selection.value
  dragState = null
  if (!sel) return
  _blockNextClick()
  selection.value = null
  const { startRow, startCol, endRow, endCol } = sel
  const newRect = { startRow, startCol, endRow, endCol }
  const existingIdx = findFolderAt(startRow, startCol, endRow, endCol)
  if (existingIdx >= 0) {
    const existing = folders.value[existingIdx]
    if (folderHasTitle(existing)) return
    folders.value.splice(existingIdx, 1)
    return
  }
  const hasTitleOverlap = folders.value.some(f => folderHasTitle(f) && (rectContains(newRect, f) || rectContains(f, newRect) || rectsOverlap(newRect, f)))
  if (hasTitleOverlap) return
  const toRemove = []
  for (let i = 0; i < folders.value.length; i++) {
    const f = folders.value[i]
    if (rectContains(newRect, f) || rectContains(f, newRect) || rectsOverlap(newRect, f)) {
      toRemove.unshift(i)
    }
  }
  for (const i of toRemove) folders.value.splice(i, 1)
  if (folderAreaOnlyOne(startRow, startCol, endRow, endCol)) return
  folders.value.push({
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    startRow, startCol, endRow, endCol,
    titleTop: '',
    titleBottom: ''
  })
}

// ====== 样式 getter ======
function getFolderWrapperStyle(f) {
  const p1 = gridToPx(f.startRow, f.startCol)
  const p2 = gridToPx(f.endRow, f.endCol)
  return {
    position: 'fixed',
    left: `${p1.left}px`,
    top: `${p1.top}px`,
    width: `${p2.right - p1.left}px`,
    height: `${p2.bottom - p1.top}px`,
    zIndex: 9,
    pointerEvents: 'none'
  }
}

const selectionStyle = computed(() => {
  if (!selection.value) return null
  const sel = selection.value
  const newRect = { startRow: sel.startRow, startCol: sel.startCol, endRow: sel.endRow, endCol: sel.endCol }
  const hasTitleOverlap = folders.value.some(f => folderHasTitle(f) && (rectContains(newRect, f) || rectContains(f, newRect) || rectsOverlap(newRect, f)))
  const p1 = gridToPx(sel.startRow, sel.startCol)
  const p2 = gridToPx(sel.endRow, sel.endCol)
  return {
    position: 'fixed',
    left: `${p1.left}px`,
    top: `${p1.top}px`,
    width: `${p2.left + p2.width - p1.left}px`,
    height: `${p2.top + p2.height - p1.top}px`,
    zIndex: 2,
    pointerEvents: 'none',
    background: hasTitleOverlap ? 'transparent' : undefined,
    border: hasTitleOverlap ? 'none' : undefined
  }
})

function _calcIconPx(scalePct) {
  const iconScaleFactor = (iconScale.value / 100) * ((scalePct ?? 100) / 100)
  return Math.round(Math.max(12, Math.min(_iconMaxPx, 48 * iconScaleFactor * _viewFactor)))
}

function _calcIconPad(iconPx) {
  return Math.max(0, Math.floor((_cellH - iconPx - LABEL_H) / 3))
}

function getCellStyle(ic) {
  const drag = iconDrag.value
  const isDragging = drag && drag.iconId === ic.id
  if (isDragging && drag) {
    const pxRowCol = gridToPx(drag.origRow, drag.origCol)
    return {
      position: 'fixed',
      left: `${iconDragCursor.x - drag.offsetX}px`,
      top: `${iconDragCursor.y - drag.offsetY}px`,
      width: `${pxRowCol.width}px`,
      height: `${pxRowCol.height}px`,
      zIndex: 100,
      gridColumn: undefined,
      gridRow: undefined
    }
  }
  const ret = { gridColumn: ic.col + 1, gridRow: ic.row + 1 }
  const s = ic.scale ?? 100
  if (s !== 100) {
    const ipx = _calcIconPx(s)
    ret['--icon-max'] = ipx + 'px'
    ret['--icon-pad'] = _calcIconPad(ipx) + 'px'
  }
  return ret
}

function getDragPreviewStyle() {
  if (!iconDrag.value) return null
  const drag = iconDrag.value
  const p = gridToPx(drag.targetRow, drag.targetCol)
  const occupied = icons.value.some(i => i.row === drag.targetRow && i.col === drag.targetCol && i.id !== drag.iconId)
  if (occupied) return null
  return {
    position: 'fixed',
    left: `${p.left}px`,
    top: `${p.top}px`,
    width: `${p.width}px`,
    height: `${p.height}px`,
    zIndex: 3,
    pointerEvents: 'none'
  }
}
</script>

<template>
  <template v-if="showIcons">
    <div ref="gridRef" class="icon-grid">
      <template v-for="ic in icons" :key="ic.id">
        <div
          class="icon-cell"
          :class="[ic.type === 'builtin' ? 'icon-cell--add' : '', { 'icon-cell--search': ic.type !== 'builtin' && ic.search, 'icon-cell--dragging': iconDrag && iconDrag.iconId === ic.id, 'icon-cell--hover-locked': hoverLockedId === ic.id || popupHighlightIds.has(ic.id), 'icon-cell--drag-hover': iconDragHoverId === ic.id, 'icon-cell--in-folder': isIconInFolder(ic), 'icon-cell--spinning': spinningIds.has(ic.id) }]"
          :style="getCellStyle(ic)"
          :title="ic.type === 'builtin' ? '' : ic.url || ''"
          @mousedown="onIconMouseDown($event, ic)"
          @click="onIconClick($event, ic)"
          @contextmenu.stop="onIconContextMenu($event, ic.id)"
        >
          <template v-if="ic.type === 'builtin'">
            <div class="icon-add-shine-wrap"><div class="icon-add-shine"></div></div>
            <UiIcon :size="iconBoxSize">
              <svg class="icon-add-svg" viewBox="0 0 32 32">
                <circle class="add-ring" cx="16" cy="16" r="14" />
                <circle class="add-ring-inner" cx="16" cy="16" r="10" />
                <line class="add-cross" x1="16" y1="6" x2="16" y2="26" />
                <line class="add-cross" x1="6" y1="16" x2="26" y2="16" />
              </svg>
            </UiIcon>
            <UiText class="icon-label">{{ t('ic_addIconLabel') }}</UiText>
          </template>
          <template v-else>
            <UiIcon :grapheme="getIconGrapheme(ic)" :src="getIconImgSrc(ic)" :text="ic.name ? truncateLabel(ic.name, 4) : '?'" :size="_calcIconPx(ic.scale)" :invert="_iconInvert(ic)" />
            <template v-if="contextMenu === ic.id">
              <div class="ui-row icon-ctx-row" @click.stop @contextmenu.stop>
                <UiButton class="ctx-btn ctx-btn--danger" label="✕" :title="t('ic_deleteTitle')" @click="deleteIcon(ic.id)" />
                <UiButton class="ctx-btn" label="✎" :title="t('ic_editTitle')" @click="openEditDialog(ic.id)" />
              </div>
            </template>
            <template v-else-if="searchEdit === ic.id">
              <UiInput
                v-model="searchInput"
                :placeholder="t('ic_searchPlaceholder')"
                class="search-edit-uiinput"
                @enter="submitSearch"
                @esc="cancelSearch"
              />
            </template>
            <UiText v-else-if="ic.name" class="icon-label">{{ ic.name }}{{ ic.search ? ' 🔍︎' : '' }}</UiText>
          </template>
        </div>
      </template>
    </div>
    <template v-for="f in folders" :key="f.id">
      <div class="folder-wrapper" :class="{ 'folder-wrapper--selecting': selection }" :style="getFolderWrapperStyle(f)">
        <div class="folder-border"></div>
        <div class="folder-title-wrap folder-title-wrap--top">
          <input
            class="folder-title folder-title--top"
            :class="{ 'folder-title--has-value': !!f.titleTop }"
            v-model="f.titleTop"
            placeholder=""
            @click.stop
            @mousedown.stop
            @keydown.esc="$event.target.blur()"
          />
          <button v-if="f.titleTop" class="folder-title-clear" type="button" @click.stop="f.titleTop = ''" @mousedown.stop>✕</button>
        </div>
        <div class="folder-title-wrap folder-title-wrap--bottom">
          <input
            class="folder-title folder-title--bottom"
            :class="{ 'folder-title--has-value': !!f.titleBottom }"
            v-model="f.titleBottom"
            placeholder=""
            @click.stop
            @mousedown.stop
            @keydown.esc="$event.target.blur()"
          />
          <button v-if="f.titleBottom" class="folder-title-clear" type="button" @click.stop="f.titleBottom = ''" @mousedown.stop>✕</button>
        </div>
      </div>
    </template>
    <div v-if="selection" class="selection-border" :style="selectionStyle" @mousedown.stop @click.stop></div>
    <div v-if="iconDrag" class="drag-preview" :class="{ 'drag-preview--in-folder': folders.some(f => pointInFolder(iconDrag.targetRow, iconDrag.targetCol, f)) }" :style="getDragPreviewStyle()"></div>
  </template>

  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-show="dialog" class="dialog-overlay" @click.self="!_dialogMousedownInside && closeDialog()" @contextmenu.stop>
        <div ref="dialogBoxRef" class="dialog-box-wrapper" @click.stop @contextmenu.stop @mousedown="_dialogMousedownInside = true">
          <div class="dialog-box" @click.stop>
            <label
              class="icon-cell dialog-preview-icon"
              :class="dialogTheme === 'dark' ? 'force-dark' : 'force-light'"
              :title="t('ic_uploadTitle')"
              :style="'cursor:pointer; ' + previewIconStyle"
            >
              <UiIcon :grapheme="previewGrapheme" :src="formPreviewUrl" :text="form.name ? truncateLabel(form.name, 4) : '?'" :size="previewIconSize" :invert="previewInvert" />
              <UiText v-if="form.name" class="icon-label">{{ form.name }}{{ form.url.includes('%s') ? ' 🔍︎' : '' }}</UiText>
              <input type="file" accept="image/*" class="dialog-upload-input" @change="handleFileUpload" />
            </label>
            <div class="ui-widget">
              <div class="ui-row">
                <UiSwitch
                  cycle
                  :options="[{ value: 'light', label: t('dialogLightStyle') }, { value: 'dark', label: t('dialogDarkStyle') }]"
                  v-model="dialogTheme"
                />
              </div>
              <div class="ui-row">
                <UiCheck :modelValue="form.autoInvert" :label="t('ic_autoInvert')" @update:modelValue="form.autoInvert = $event" />
              </div>
              <div class="ui-row">
                <UiText>{{ t('iconScale') }}</UiText>
                <input type="range" min="0" max="200" step="5" v-model.number="form.scale" class="icon-scale-slider" />
                <UiNumber v-model="form.scale" :min="0" :max="200" :step="5" suffix="%" />
              </div>
            </div>
          </div>
          <div class="ui-widget">
            <div class="ui-row">
              <UiInput v-model="form.url" class="dialog-url" :placeholder="t('ic_urlPlaceholder')" @enter="addOrSaveIcon" />
            </div>
            <div class="ui-row">
              <UiInput v-model="formIconUrlDraft" class="dialog-icon-url" :placeholder="t('ic_iconUrlPlaceholder')" @blur="validateFormIconUrl" />
              <UiButton :label="isClearingIcon ? t('ic_unset') : t('apply')" :class="{ 'ui-button--flash': applyNeedsAttention }" :disabled="!applyOrUnsetEnabled" @click="applyIconUrl" />
            </div>
            <div class="ui-row">
              <UiInput v-model="form.name" :placeholder="t('ic_namePlaceholder')" />
              <UiButton :label="dialog?.mode === 'edit' ? t('ic_save') : t('add')" @click="addOrSaveIcon" />
            </div>
          </div>
          <UiText class="dialog-hint dialog-hint-outer" :style="{ visibility: dialogHint ? 'visible' : 'hidden' }">{{ dialogHint || ' ' }}</UiText>
        </div>
        <div ref="emojiLayerRef" class="dialog-grapheme-layer" @click.stop="onEmojiLayerClick" @mousemove="onEmojiLayerMousemove" @mousedown="_dialogMousedownInside = true" @scroll="onEmojiLayerScroll">
          <div class="emoji-spacer" :style="{ height: totalRows * emojiSize + 'px', width: (emojiCols * emojiSize + emojiSize / 2) + 'px' }">
            <span
              v-for="idx in visibleItems"
              :key="idx"
              class="emoji-cell"
              :data-index="idx"
              :style="{
                top: Math.floor(idx / emojiCols) * emojiSize + 'px',
                left: (idx % emojiCols) * emojiSize + (Math.floor(idx / emojiCols) % 2 === 1 ? emojiSize / 2 : 0) + 'px',
                width: emojiSize + 'px',
                height: emojiSize + 'px',
              }"
            >{{ GEMOJI_LIST[idx] }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.folder-wrapper {
  position: fixed;
  pointer-events: none;
  z-index: 1;
}

.folder-wrapper--selecting .folder-title {
  pointer-events: none;
}

.folder-border {
  position: absolute;
  inset: 0;
  border: 1.5px solid var(--widget-text);
  border-radius: 6px;
  background: var(--hover-bg);
  opacity: 0.12;
  pointer-events: none;
}

.folder-title-wrap {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}

.folder-title-wrap--top {
  top: -10px;
}

.folder-title-wrap--bottom {
  bottom: -10px;
}

.folder-title {
  pointer-events: auto;
  opacity: 0;
  transition: opacity 120ms ease;
  display: inline-block;
  font-size: var(--ui-font);
  color: var(--widget-text);
  white-space: nowrap;
  text-align: center;
  padding: var(--ui-pad-y) var(--ui-pad-x);
  border: var(--ui-border) solid var(--widget-border);
  border-radius: 4px;
  background: var(--widget-bg);
  line-height: var(--ui-line-height);
  outline: none;
  font-stretch: normal;
  letter-spacing: 0.2px;
  width: 32px;
  height: var(--ui-height);
}

.folder-title:hover,
.folder-title:focus,
.folder-title-wrap:hover .folder-title {
  opacity: 1;
}

.folder-title--has-value {
  opacity: 1;
  width: 120px;
  border: 1px solid transparent;
  background: transparent;
  padding: 1px 8px;
  text-shadow: 0 0 1px var(--widget-bg);
}

.folder-title--has-value:hover,
.folder-title--has-value:focus,
.folder-title-wrap:hover .folder-title--has-value {
  border-color: var(--widget-border);
  background: var(--widget-bg);
  text-shadow: none;
}

.folder-title-clear {
  display: none;
  position: absolute;
  right: calc(-1 * var(--ui-height) - var(--ui-col-gap));
  top: 50%;
  transform: translateY(-50%);
  pointer-events: auto;
  width: var(--ui-height);
  height: var(--ui-height);
  border: none;
  border-radius: 4px;
  background: var(--widget-bg);
  color: var(--widget-text);
  font-size: var(--ui-font);
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  opacity: 0.85;
  transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
}

.folder-title--has-value:hover + .folder-title-clear,
.folder-title--has-value:focus + .folder-title-clear,
.folder-title-wrap:hover .folder-title--has-value + .folder-title-clear,
.folder-title-clear:focus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
}

.folder-title-clear:hover {
  opacity: 1;
  background: var(--hover-bg);
  color: var(--accent);
}

.selection-border {
  border-radius: 6px;
  pointer-events: auto;
  background-color: var(--hover-bg);
  opacity: 0.12;
  background-image:
    linear-gradient(to right, var(--widget-text) 50%, transparent 50%),
    linear-gradient(to right, var(--widget-text) 50%, transparent 50%),
    linear-gradient(to bottom, var(--widget-text) 50%, transparent 50%),
    linear-gradient(to bottom, var(--widget-text) 50%, transparent 50%);
  background-size: 14px 1.5px, 14px 1.5px, 1.5px 14px, 1.5px 14px;
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
  background-position: top, bottom, left, right;
}

.icon-grid {
  position: fixed;
  left: var(--grid-offset-x);
  top: var(--grid-offset-y);
  display: grid;
  grid-template-columns: repeat(25, var(--cell-w));
  grid-template-rows: repeat(11, var(--cell-h));
  gap: 1px;
  pointer-events: none;
  z-index: 5;
}

.icon-cell {
  position: relative;
  width: var(--cell-w);
  height: var(--cell-h);
  pointer-events: auto;
  overflow: visible;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: var(--icon-pad);
  padding-bottom: var(--icon-pad);
  gap: var(--icon-pad);
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  transition: border-color 120ms ease, background 120ms ease;
}

.icon-cell:hover,
.icon-cell--dragging,
.icon-cell--hover-locked,
.icon-cell--drag-hover {
  border-color: var(--widget-border);
  background: var(--hover-bg);
}
.icon-cell:hover > .icon-label,
.icon-cell--dragging > .icon-label,
.icon-cell--hover-locked > .icon-label,
.icon-cell--drag-hover > .icon-label,
.icon-cell:hover > .ui-icon,
.icon-cell--dragging > .ui-icon,
.icon-cell--hover-locked > .ui-icon,
.icon-cell--drag-hover > .ui-icon {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

body.icons-hover-locked .icon-cell:not(.icon-cell--hover-locked):hover {
  border-color: transparent;
  background: transparent;
}

.icon-cell--in-folder:not(.icon-cell--dragging) {
  transform: scale(0.8);
}

.drag-preview {
  border: 1.5px dashed var(--widget-text);
  border-radius: 6px;
}

.drag-preview--in-folder {
  transform: scale(0.8);
}

.icon-label {
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  flex-shrink: 0;
}
.icon-label :deep(.ui-column) {
  background: transparent;
}

.search-edit-uiinput {
  align-self: center;
  width: 90%;
  max-width: 120px;
  text-align: center;
}
.search-edit-uiinput :deep(.ui-input-field) {
  width: 100%;
  text-align: center;
}

.icon-ctx-row {
  height: var(--ui-height);
  align-self: center;
  pointer-events: auto;
}

:deep(.ctx-btn.ui-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ui-height);
  height: var(--ui-height);
  border-radius: 3px;
  padding: 0;
  font-size: var(--ui-font);
  font-weight: bold;
  color: var(--widget-text);
  background: var(--widget-bg);
  white-space: nowrap;
  line-height: 1;
  transition: background 0.15s ease, color 0.15s ease;
}
:deep(.ctx-btn.ui-button:hover) {
  background: var(--hover-bg);
}
:deep(.ctx-btn--danger.ui-button:hover) {
  background: var(--hover-bg);
  color: var(--danger);
}

.icon-cell--add {
  pointer-events: auto;
}
.icon-add-svg {
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.icon-cell--add .ui-icon-slot {
  border-radius: 50%;
  background: var(--label-bg);
}
.icon-add-shine-wrap {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.icon-add-shine {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 600px;
  height: 10px;
  margin-left: -300px;
  margin-top: -5px;
  background: var(--icon-add-shine);
  transform: rotate(135deg) translateY(-180px);
  animation: addShine 6s ease-in-out infinite;
  animation-delay: 0.8s;
  pointer-events: none;
  z-index: 0;
}
@keyframes addShine {
  0% { transform: rotate(135deg) translateY(-180px); opacity: 0; }
  10% { opacity: 1; }
  50% { transform: rotate(135deg) translateY(180px); opacity: 1; }
  60% { opacity: 0; }
  100% { transform: rotate(135deg) translateY(180px); opacity: 0; }
}
.icon-add-svg .add-ring {
  fill: none;
  stroke: var(--widget-text);
  stroke-width: 1.6;
  stroke-dasharray: 4 2.5;
  animation: addSpin 12s linear infinite;
  transform-origin: 16px 16px;
}
.icon-add-svg .add-ring-inner {
  fill: none;
  stroke: var(--widget-text);
  stroke-width: 1;
  opacity: 0.35;
}
.icon-add-svg .add-cross {
  stroke: var(--widget-text);
  stroke-width: 2.4;
  stroke-linecap: round;
}
@keyframes addSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes iconSpinOnce {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.icon-cell--spinning > .ui-icon {
  animation: iconSpinOnce 0.4s linear;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--label-bg);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
}
.dialog-overlay > .dialog-box-wrapper {
  position: relative;
  z-index: 1;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: var(--ui-row-gap);
}
.dialog-box {
  position: relative;
  background: var(--label-bg);
  border: 1px solid var(--widget-border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  gap: 24px;
  box-shadow: 0 8px 32px var(--shadow);
  pointer-events: auto;
}
.dialog-box-wrapper > .ui-widget {
  background: var(--label-bg);
  border: 1px solid var(--widget-border);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 8px 32px var(--shadow);
  pointer-events: auto;
  overflow: hidden;
}

.dialog-preview-icon {
  flex-shrink: 0;
  border-radius: 6px;
  border: 1.5px dashed color-mix(in srgb, var(--widget-text) 70%, transparent);
}
.dialog-upload-input {
  display: none;
}

.dialog-grapheme-layer {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  z-index: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--widget-text) transparent;
}
.dialog-grapheme-layer::-webkit-scrollbar {
  width: 6px;
}
.dialog-grapheme-layer::-webkit-scrollbar-thumb {
  background: var(--widget-text);
  border-radius: 3px;
}
.dialog-grapheme-layer::-webkit-scrollbar-track {
  background: transparent;
}
.emoji-spacer {
  position: relative;
  margin: 0 auto;
}
.emoji-cell {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  line-height: 1;
  user-select: none;
  -webkit-user-select: none;
  color: var(--widget-text);
  opacity: 0.85;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', system-ui, sans-serif;
  overflow: hidden;
}

.dialog-emoji-fade-enter-active,
.dialog-emoji-fade-leave-active {
  transition: opacity 0.3s ease;
}
.dialog-emoji-fade-enter-from,
.dialog-emoji-fade-leave-to {
  opacity: 0;
}

.dialog-hint {
  opacity: 0.75;
}
.dialog-hint-outer {
  text-align: center;
  width: 371px;
}

.dialog-box-wrapper :deep(.ui-input-field) {
  width: 260px;
}
.dialog-icon-url {
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', system-ui, sans-serif;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 150ms ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>