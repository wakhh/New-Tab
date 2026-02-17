<script setup>
import { ref, computed, watch, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { isPortrait } from '../js/useVisualState'
import { settingsOpen } from '../js/usePersist'
import { useStorage } from '../js/useStorage'
import { newIconFileId, putIconFile, getIconFile, deleteIconFile } from '../js/useIconStore'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import UiText from '../ui/UiText.vue'
import { t } from '../js/useI18n'

const GRID_ROWS = 11
const GRID_COLS = 25

const showIcons = computed(() => !isPortrait.value && !settingsOpen.value)

const icons = useStorage('shortcut-icons', [])
const folders = useStorage('shortcut-folders', [])
const addIconPos = useStorage('shortcut-add-pos', { row: -1, col: -1 })

const iconBlobs = reactive({})

async function loadBlobs() {
  for (const ic of icons.value) {
    if (ic.fileId && !(ic.fileId in iconBlobs)) {
      const blob = await getIconFile(ic.fileId)
      if (blob) iconBlobs[ic.fileId] = URL.createObjectURL(blob)
    }
  }
}

onMounted(() => { validateAndFixIcons(); loadBlobs() })
watch(icons, () => { validateAndFixIcons(); loadBlobs() }, { deep: true })

const popupHighlightIds = ref(new Set())

if (globalThis.__IS_POPUP__) {
  ;(async () => {
    try {
      const tabsApi = typeof browser !== 'undefined' && browser.tabs ? browser.tabs : (typeof chrome !== 'undefined' ? chrome.tabs : null)
      if (!tabsApi) return
      const [tab] = await tabsApi.query({ active: true, currentWindow: true })
      if (!tab || !tab.url) return
      const tabOrigin = (() => { try { return new URL(tab.url).origin } catch { return '' } })()
      if (!tabOrigin) return
      const matches = icons.value.filter(ic => {
        try { return new URL(ic.url).origin === tabOrigin } catch { return false }
      })
      if (matches.length) {
        popupHighlightIds.value = new Set(matches.map(m => m.id))
        watch(icons, () => {
          const ids = new Set()
          for (const ic of icons.value) {
            try { if (new URL(ic.url).origin === tabOrigin) ids.add(ic.id) } catch {}
          }
          popupHighlightIds.value = ids
        }, { deep: true })
        return
      }
      openAddDialog()
      popupPrefillFromTab(tab)
    } catch {}
  })()
}

const contextMenu = ref(null)

function onIconContextMenu(e, iconId) {
  if (!showIcons.value) return
  e.preventDefault()
  closeDialog()
  searchEdit.value = null
  contextMenu.value = iconId
}

function closeContextMenu() {
  contextMenu.value = null
}

function onWindowClick() {
  if (contextMenu.value) contextMenu.value = null
  if (dialog.value) closeDialog()
}

function onWindowKey(e) {
  if (e.key === 'Escape') {
    closeContextMenu()
    closeDialog()
    searchEdit.value = null
  }
}

onMounted(() => {
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onWindowKey)
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('scroll', closeContextMenu, true)
  window.addEventListener('mousedown', onWinMouseDownCapture, { capture: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onWindowKey)
  window.removeEventListener('resize', closeContextMenu)
  window.removeEventListener('scroll', closeContextMenu, true)
  window.removeEventListener('mousedown', onWinMouseDownCapture, { capture: true })
  window.removeEventListener('mousemove', onWinMouseMove)
  window.removeEventListener('mouseup', onWinMouseUp)
})

const EMPTY_ICON = () => ({ id: '', name: '', fileId: null, iconUrl: '', url: '', row: -1, col: -1 })
const dialog = ref(null)
const dialogHint = ref('')
const form = reactive(EMPTY_ICON())
const formPrevFileId = ref(null)
const formPrevName = ref('')
const formPrevUrl = ref('')
const formPrevIconUrl = ref('')
const formPrevRowCol = ref(null)
const formPreviewUrl = ref('')
let preprocessed = false

function resetPreprocess() {
  preprocessed = false
}

function tryExtractName() {
  if (form.name.trim()) return false
  try {
    const u = new URL(form.url.replace('%s', 'x'))
    form.name = u.hostname.replace(/^www\./, '').replace(/\.[^.]+$/, '')
    return true
  } catch { return false }
}

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
    formPreviewUrl.value = faviconTrial.src
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
  if (preprocessed) return
  if (val.trim() && (!oldVal || !oldVal.trim()) && val.length >= 10) {
    autoPreprocess()
  }
})

function openAddDialog() {
  closeContextMenu()
  Object.assign(form, EMPTY_ICON(), { row: -1, col: -1 })
  formPrevFileId.value = null
  formPrevName.value = ''
  formPrevUrl.value = ''
  formPrevIconUrl.value = ''
  formPrevRowCol.value = null
  formPreviewUrl.value = ''
  dialogHint.value = ''
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
  if (!ic) return
  Object.assign(form, ic)
  formPrevFileId.value = ic.fileId
  formPrevName.value = ic.name
  formPrevUrl.value = ic.url
  formPrevIconUrl.value = ic.iconUrl
  formPrevRowCol.value = { row: ic.row, col: ic.col }
  if (ic.fileId && iconBlobs[ic.fileId]) formPreviewUrl.value = iconBlobs[ic.fileId]
  else formPreviewUrl.value = ic.iconUrl || ''
  dialogHint.value = ''
  resetPreprocess()
  dialog.value = { mode: 'edit', iconId }
  nextTick(() => {
    const input = document.querySelector('.dialog-url .ui-input-field')
    if (input) input.focus()
  })
}

function closeDialog() {
  if (dialog.value && dialog.value.mode === 'edit') {
    const changed = form.name !== formPrevName.value
      || form.url !== formPrevUrl.value
      || form.iconUrl !== formPrevIconUrl.value
      || form.fileId !== formPrevFileId.value
      || form.row !== formPrevRowCol.value?.row
      || form.col !== formPrevRowCol.value?.col
    if (changed) {
      const idx = icons.value.findIndex(i => i.id === form.id)
      if (idx >= 0) {
        const old = icons.value[idx]
        const name = form.name.trim()
        const url = form.url.trim()
        const payload = {
          id: form.id,
          name,
          fileId: form.fileId,
          iconUrl: form.fileId ? '' : form.iconUrl.trim(),
          url,
          search: url.includes('%s'),
          row: form.row >= 0 ? form.row : old.row,
          col: form.col >= 0 ? form.col : old.col
        }
        if (old.fileId && old.fileId !== payload.fileId) deleteIconFile(old.fileId).catch(() => {})
        icons.value.splice(idx, 1, payload)
      }
    } else {
      if (form.fileId && form.fileId !== formPrevFileId.value) {
        deleteIconFile(form.fileId).catch(() => {})
      }
    }
  } else {
    if (form.fileId && form.fileId !== formPrevFileId.value) {
      deleteIconFile(form.fileId).catch(() => {})
    }
  }
  dialog.value = null
  dialogHint.value = ''
  Object.assign(form, EMPTY_ICON())
  formPrevFileId.value = null
  formPrevName.value = ''
  formPrevUrl.value = ''
  formPrevIconUrl.value = ''
  formPrevRowCol.value = null
  formPreviewUrl.value = ''
  resetPreprocess()
}

function getNextEmptyPos() {
  const occupied = new Set(icons.value.map(i => `${i.row},${i.col}`))
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (!occupied.has(`${r},${c}`)) return { row: r, col: c }
    }
  }
  return { row: -1, col: -1 }
}

function validateAndFixIcons() {
  const seen = new Map()
  const bad = []
  for (const ic of icons.value) {
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
  if (file.size > 1024 * 1024) {
    dialogHint.value = t('ic_invalidFileSize')
    e.target.value = ''
    return
  }
  const img = new Image()
  const url = URL.createObjectURL(file)
  img.onload = async () => {
    URL.revokeObjectURL(url)
    if (img.width > 512 || img.height > 512) {
      dialogHint.value = t('ic_invalidFileDim')
      e.target.value = ''
      return
    }
    const oldFileId = form.fileId
    const fileId = newIconFileId()
    await putIconFile(fileId, file)
    form.fileId = fileId
    form.iconUrl = ''
    if (iconBlobs[fileId]) URL.revokeObjectURL(iconBlobs[fileId])
    iconBlobs[fileId] = URL.createObjectURL(file)
    formPreviewUrl.value = iconBlobs[fileId]
    dialogHint.value = ''
    if (oldFileId && oldFileId !== formPrevFileId.value) deleteIconFile(oldFileId).catch(() => {})
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
  const url = form.iconUrl.trim()
  if (!url) { dialogHint.value = t('ic_pleaseEnterImgUrl'); return }
  try { new URL(url) } catch { dialogHint.value = t('ic_invalidImgUrl'); return }
  const oldFileId = form.fileId
  form.fileId = null
  formPreviewUrl.value = url
  dialogHint.value = ''
  if (oldFileId && oldFileId !== formPrevFileId.value) deleteIconFile(oldFileId).catch(() => {})
}

function validateFormIconUrl() {
  const url = form.iconUrl.trim()
  if (!url) { dialogHint.value = ''; return true }
  try { new URL(url) } catch { dialogHint.value = t('ic_invalidImgUrl'); return false }
  dialogHint.value = ''
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
    name,
    fileId: form.fileId,
    iconUrl: form.fileId ? '' : form.iconUrl.trim(),
    url,
    search: isSearch,
    row: pos.row,
    col: pos.col
  }

  if (form.fileId && !iconBlobs[form.fileId]) {
    getIconFile(form.fileId).then(blob => {
      if (blob) iconBlobs[form.fileId] = URL.createObjectURL(blob)
    })
  }

  if (dialog.value.mode === 'edit') {
    const idx = icons.value.findIndex(i => i.id === payload.id)
    if (idx >= 0) {
      const old = icons.value[idx]
      if (old.fileId && old.fileId !== payload.fileId) deleteIconFile(old.fileId).catch(() => {})
      icons.value.splice(idx, 1, payload)
    }
  } else {
    icons.value.push(payload)
  }

  formPrevFileId.value = null
  formPrevName.value = ''
  formPrevUrl.value = ''
  formPrevIconUrl.value = ''
  formPrevRowCol.value = null
  dialog.value = null
  Object.assign(form, EMPTY_ICON())
  formPreviewUrl.value = ''
}

function deleteIcon(iconId) {
  closeContextMenu()
  const idx = icons.value.findIndex(i => i.id === iconId)
  if (idx < 0) return
  const ic = icons.value[idx]
  icons.value.splice(idx, 1)
  if (ic.fileId) {
    deleteIconFile(ic.fileId).catch(() => {})
    if (iconBlobs[ic.fileId]) {
      URL.revokeObjectURL(iconBlobs[ic.fileId])
      delete iconBlobs[ic.fileId]
    }
  }
}

function getIconImgSrc(ic) {
  if (ic.fileId && iconBlobs[ic.fileId]) return iconBlobs[ic.fileId]
  return ic.iconUrl || ''
}

const searchEdit = ref(null)
const searchInput = ref('')

function onIconClick(e, ic) {
  if (didIconDrag) { didIconDrag = false; return }
  if (iconDrag.value) return
  if (dialog.value || contextMenu.value || searchEdit.value) return
  if (globalThis.__IS_POPUP__) {
    e.stopPropagation()
    openEditDialog(ic.id)
  } else if (ic.search) {
    searchEdit.value = ic.id
    searchInput.value = ''
    nextTick(() => {
      const el = document.querySelector('.search-edit-input')
      if (el) { el.focus(); el.select() }
    })
  } else {
    window.location.href = ic.url
  }
}

function submitSearch(e) {
  const q = searchInput.value.trim()
  if (q) {
    const ic = icons.value.find(i => i.id === searchEdit.value)
    if (ic) window.location.href = ic.url.replace('%s', encodeURIComponent(q))
  }
  searchEdit.value = null
  searchInput.value = ''
}

function cancelSearch() {
  searchEdit.value = null
  searchInput.value = ''
}

const GRID_GAP = 3
const GRID_PADDING = 6

function getCellMetrics() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const totalW = vw - GRID_PADDING * 2 - (GRID_COLS - 1) * GRID_GAP
  const totalH = vh - GRID_PADDING * 2 - (GRID_ROWS - 1) * GRID_GAP
  return {
    cellW: totalW / GRID_COLS,
    cellH: totalH / GRID_ROWS
  }
}

function gridToPx(row, col) {
  const { cellW, cellH } = getCellMetrics()
  const left = GRID_PADDING + col * (cellW + GRID_GAP)
  const top = GRID_PADDING + row * (cellH + GRID_GAP)
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
  const { cellW, cellH } = getCellMetrics()
  const col = Math.floor((x - GRID_PADDING) / (cellW + GRID_GAP))
  const row = Math.floor((y - GRID_PADDING) / (cellH + GRID_GAP))
  return {
    row: Math.max(0, Math.min(GRID_ROWS - 1, row)),
    col: Math.max(0, Math.min(GRID_COLS - 1, col))
  }
}

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
    if (addCellPos.value && ic.row === addCellPos.value.row && ic.col === addCellPos.value.col) continue
    const p = gridToPx(ic.row, ic.col)
    if (x >= p.left && x <= p.right && y >= p.top && y <= p.bottom) return { type: 'icon', id: ic.id, row: ic.row, col: ic.col }
  }
  if (addCellPos.value) {
    const p = gridToPx(addCellPos.value.row, addCellPos.value.col)
    if (x >= p.left && x <= p.right && y >= p.top && y <= p.bottom) return { type: 'add', row: addCellPos.value.row, col: addCellPos.value.col }
  }
  return null
}

function findNearestEmptyCell(x, y, excludeRow, excludeCol, folder) {
  const occupied = new Set(
    icons.value
      .filter(i => !(i.row === excludeRow && i.col === excludeCol))
      .map(i => `${i.row},${i.col}`)
  )
  if (addCellPos.value && !(addCellPos.value.row === excludeRow && addCellPos.value.col === excludeCol)) {
    occupied.add(`${addCellPos.value.row},${addCellPos.value.col}`)
  }
  let rStart = 0, rEnd = GRID_ROWS, cStart = 0, cEnd = GRID_COLS
  if (folder) {
    rStart = folder.startRow
    rEnd = folder.endRow + 1
    cStart = folder.startCol
    cEnd = folder.endCol + 1
  }
  let best = null
  let bestDist = Infinity
  for (let r = rStart; r < rEnd; r++) {
    for (let c = cStart; c < cEnd; c++) {
      if (occupied.has(`${r},${c}`)) continue
      const p = gridToPx(r, c)
      const cx = p.left + p.width / 2
      const cy = p.top + p.height / 2
      const d = (cx - x) ** 2 + (cy - y) ** 2
      if (d < bestDist) { bestDist = d; best = { row: r, col: c } }
    }
  }
  return best
}

function onIconMouseDown(e, ic) {
  if (e.button !== 0) return
  if (e.ctrlKey || e.metaKey) return
  if (dialog.value || contextMenu.value || searchEdit.value) return
  e.preventDefault()
  closeContextMenu()
  searchEdit.value = null
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

function onAddIconMouseDown(e) {
  if (e.button !== 0) return
  if (e.ctrlKey || e.metaKey) return
  if (dialog.value || contextMenu.value || searchEdit.value) return
  e.preventDefault()
  closeContextMenu()
  searchEdit.value = null
  if (!addCellPos.value) return
  hoverLockedId.value = '__add__'
  const rect = e.currentTarget.getBoundingClientRect()
  startPendingDrag(e, {
    iconId: '__add__',
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    origRow: addCellPos.value.row,
    origCol: addCellPos.value.col,
    targetRow: addCellPos.value.row,
    targetCol: addCellPos.value.col
  }, onAddIconMouseUp)
}

function onAddIconMouseUp() {
  hoverLockedId.value = ''
  iconDragHoverId.value = ''
  window.removeEventListener('mousemove', onIconDragMove)
  const drag = iconDrag.value
  if (drag && drag.iconId === '__add__') {
    const hover = findCellAt(iconDragCursor.x, iconDragCursor.y, '__add__')
    if (hover && hover.type === 'icon') {
      const victim = icons.value.find(i => i.id === hover.id)
      if (victim && drag.victimTargetRow !== undefined) {
        victim.row = drag.victimTargetRow
        victim.col = drag.victimTargetCol
      }
      addIconPos.value = { row: hover.row, col: hover.col }
    } else if (drag.targetRow !== drag.origRow || drag.targetCol !== drag.origCol) {
      addIconPos.value = { row: drag.targetRow, col: drag.targetCol }
    }
  }
  iconDrag.value = null
}

function onAddIconClick() {
  if (didIconDrag) { didIconDrag = false; return }
  if (iconDrag.value) return
  openAddDialog()
  if (globalThis.__IS_POPUP__) {
    popupPrefillFromTab()
  }
}

async function popupPrefillFromTab(existingTab) {
  try {
    let tab = existingTab
    if (!tab) {
      const tabsApi = typeof browser !== 'undefined' && browser.tabs ? browser.tabs : (typeof chrome !== 'undefined' ? chrome.tabs : null)
      if (!tabsApi) return
      ;[tab] = await tabsApi.query({ active: true, currentWindow: true })
    }
    if (!tab || !tab.url) return
    form.url = tab.url
    form.name = tab.title || ''
    if (tab.favIconUrl) {
      form.iconUrl = tab.favIconUrl
      formPreviewUrl.value = tab.favIconUrl
    }
    nextTick(() => {
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
  const hover = findCellAt(e.clientX, e.clientY, drag.iconId === '__add__' ? '' : drag.iconId)
  iconDragHoverId.value = hover ? (hover.type === 'add' ? '__add__' : hover.id) : ''
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
  if (hover && hover.type === 'add') {
    const dragFromPos = gridToPx(drag.origRow, drag.origCol)
    const free = findNearestEmptyCell(dragFromPos.left + dragFromPos.width / 2, dragFromPos.top + dragFromPos.height / 2, drag.origRow, drag.origCol)
    if (free) {
      drag.targetRow = free.row
      drag.targetCol = free.col
      return
    }
  }
  const target = findNearestEmptyCell(e.clientX, e.clientY, drag.origRow, drag.origCol)
  if (target) {
    drag.targetRow = target.row
    drag.targetCol = target.col
  }
}

function onIconDragUp() {
  hoverLockedId.value = ''
  iconDragHoverId.value = ''
  const drag = iconDrag.value
  window.removeEventListener('mousemove', onIconDragMove)
  if (!drag) return
  const ic = icons.value.find(i => i.id === drag.iconId)
  if (!ic) { iconDrag.value = null; return }

  const hover = findCellAt(iconDragCursor.x, iconDragCursor.y, drag.iconId)
  if (hover) {
    if (hover.type === 'icon') {
      const victim = icons.value.find(i => i.id === hover.id)
      if (victim && drag.victimTargetRow !== undefined) {
        victim.row = drag.victimTargetRow
        victim.col = drag.victimTargetCol
      }
    } else if (hover.type === 'add') {
      if (drag.targetRow !== hover.row || drag.targetCol !== hover.col) {
        addIconPos.value = { row: drag.targetRow, col: drag.targetCol }
      }
    }
    ic.row = hover.row
    ic.col = hover.col
  } else if (drag.targetRow !== drag.origRow || drag.targetCol !== drag.origCol) {
    ic.row = drag.targetRow
    ic.col = drag.targetCol
  }
  iconDrag.value = null
}

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

function onWinMouseUp() {
  window.removeEventListener('mousemove', onWinMouseMove)
  const sel = selection.value
  dragState = null
  if (!sel) return
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
    zIndex: 9,
    pointerEvents: 'none',
    background: hasTitleOverlap ? 'transparent' : undefined,
    border: hasTitleOverlap ? 'none' : undefined
  }
})

const MAX_ICONS = computed(() => GRID_ROWS * GRID_COLS)
const addCellPos = computed(() => {
  if (icons.value.length >= MAX_ICONS.value) return null
  const stored = addIconPos.value
  if (stored && stored.row >= 0 && stored.col >= 0
      && stored.row < GRID_ROWS && stored.col < GRID_COLS
      && !icons.value.some(i => i.row === stored.row && i.col === stored.col)) {
    return { row: stored.row, col: stored.col }
  }
  const occupied = new Set(icons.value.map(i => `${i.row},${i.col}`))
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (!occupied.has(`${r},${c}`)) return { row: r, col: c }
    }
  }
  return null
})

function getCellStyle(ic) {
  const drag = iconDrag.value
  const isAdd = ic.__isAdd
  const isDragging = drag && ((isAdd && drag.iconId === '__add__') || (!isAdd && drag.iconId === ic.id))
  if (isDragging && drag) {
    const pxRowCol = gridToPx(drag.origRow, drag.origCol)
    return {
      position: 'fixed',
      left: `${iconDragCursor.x - drag.offsetX}px`,
      top: `${iconDragCursor.y - drag.offsetY}px`,
      width: `${pxRowCol.width}px`,
      height: `${pxRowCol.height}px`,
      zIndex: 100
    }
  }
  const cellW = `calc((100vw - ${GRID_PADDING * 2}px - ${(GRID_COLS - 1) * GRID_GAP}px) / ${GRID_COLS})`
  const cellH = `calc((100vh - ${GRID_PADDING * 2}px - ${(GRID_ROWS - 1) * GRID_GAP}px) / ${GRID_ROWS})`
  return {
    left: `calc(${GRID_PADDING}px + ${ic.col} * (${cellW} + ${GRID_GAP}px))`,
    top: `calc(${GRID_PADDING}px + ${ic.row} * (${cellH} + ${GRID_GAP}px))`,
    width: cellW,
    height: cellH,
    position: 'fixed',
    zIndex: 10
  }
}

function getDragPreviewStyle() {
  if (!iconDrag.value) return null
  const drag = iconDrag.value
  const p = gridToPx(drag.targetRow, drag.targetCol)
  let occupied
  if (drag.iconId === '__add__') {
    occupied = icons.value.some(i => i.row === drag.targetRow && i.col === drag.targetCol)
  } else {
    occupied = icons.value.some(i => i.row === drag.targetRow && i.col === drag.targetCol && i.id !== drag.iconId)
  }
  if (occupied) return null
  return {
    position: 'fixed',
    left: `${p.left}px`,
    top: `${p.top}px`,
    width: `${p.width}px`,
    height: `${p.height}px`,
    zIndex: 8,
    pointerEvents: 'none'
  }
}
</script>

<template>
  <template v-if="showIcons">
    <template v-for="f in folders" :key="f.id">
      <div class="folder-wrapper" :class="{ 'folder-wrapper--selecting': selection }" :style="getFolderWrapperStyle(f)">
        <div class="folder-border"></div>
        <input
          class="folder-title folder-title--top"
          :class="{ 'folder-title--has-value': !!f.titleTop }"
          v-model="f.titleTop"
          placeholder=""
          @click.stop
          @mousedown.stop
          @keydown.esc="$event.target.blur()"
        />
        <input
          class="folder-title folder-title--bottom"
          :class="{ 'folder-title--has-value': !!f.titleBottom }"
          v-model="f.titleBottom"
          placeholder=""
          @click.stop
          @mousedown.stop
          @keydown.esc="$event.target.blur()"
        />
      </div>
    </template>
    <div v-if="selection" class="selection-border" :style="selectionStyle" @mousedown.stop @click.stop></div>
    <div v-if="iconDrag" class="drag-preview" :style="getDragPreviewStyle()"></div>
    <div
      v-for="ic in icons"
      :key="ic.id"
      class="icon-cell"
      :class="{ 'icon-cell--search': ic.search, 'icon-cell--dragging': iconDrag && iconDrag.iconId === ic.id, 'icon-cell--hover-locked': hoverLockedId === ic.id || popupHighlightIds.has(ic.id), 'icon-cell--drag-hover': iconDragHoverId === ic.id, 'icon-cell--in-folder': isIconInFolder(ic) }"
      :style="getCellStyle(ic)"
      :title="ic.name || ic.url"
      @mousedown="onIconMouseDown($event, ic)"
      @click="onIconClick($event, ic)"
      @contextmenu.stop="onIconContextMenu($event, ic.id)"
    >
      <div class="icon-display">
        <img v-if="getIconImgSrc(ic)" :src="getIconImgSrc(ic)" :alt="ic.name || ''" class="icon-img" referrerpolicy="no-referrer" />
        <span v-else class="icon-placeholder">{{ ic.name ? ic.name.slice(0, 1) : '?' }}</span>
        <template v-if="contextMenu === ic.id">
          <div class="icon-ctx-row" @click.stop @contextmenu.stop>
            <UiButton class="ctx-btn ctx-btn--danger" label="×" :title="t('ic_deleteTitle')" @click="deleteIcon(ic.id)" />
            <UiButton class="ctx-btn" label="✎" :title="t('ic_editTitle')" @click="openEditDialog(ic.id)" />
          </div>
        </template>
        <template v-else-if="searchEdit === ic.id">
          <input
            class="search-edit-input"
            v-model="searchInput"
            :placeholder="t('ic_searchPlaceholder')"
            @keydown.enter.prevent="submitSearch"
            @keydown.esc.prevent="cancelSearch"
            @blur="cancelSearch"
          />
        </template>
        <span v-else-if="ic.name" class="icon-label">{{ ic.name }}<svg v-if="ic.search" class="icon-label-search" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/></svg></span>
      </div>
    </div>
  </template>

  <template v-if="showIcons && addCellPos">
    <div
      class="icon-cell icon-cell--add"
      :class="{ 'icon-cell--dragging': iconDrag && iconDrag.iconId === '__add__', 'icon-cell--hover-locked': hoverLockedId === '__add__', 'icon-cell--drag-hover': iconDragHoverId === '__add__', 'icon-cell--in-folder': folders.some(f => pointInFolder(addCellPos.row, addCellPos.col, f)) }"
      :style="getCellStyle({ row: addCellPos.row, col: addCellPos.col, __isAdd: true })"
      :title="t('ic_addIconTitle')"
      @mousedown="onAddIconMouseDown"
      @click.stop="onAddIconClick"
      @contextmenu.prevent.stop
    >
      <div class="icon-display">
        <svg class="icon-add-svg" viewBox="0 0 48 48" width="32" height="32">
          <circle class="add-ring" cx="24" cy="24" r="17" />
          <circle class="add-ring-inner" cx="24" cy="24" r="10" />
          <line class="add-cross" x1="24" y1="14" x2="24" y2="34" />
          <line class="add-cross" x1="14" y1="24" x2="34" y2="24" />
        </svg>
        <span class="icon-label">{{ t('ic_addIconLabel') }}</span>
      </div>
    </div>
  </template>

  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="dialog" class="dialog-overlay" @click.self="closeDialog">
        <div class="dialog-box" @click.stop @contextmenu.prevent.stop>
          <label class="dialog-icon-preview" :title="t('ic_uploadTitle')">
            <div class="icon-display dialog-icon-display">
              <img v-if="formPreviewUrl" :src="formPreviewUrl" class="icon-img" referrerpolicy="no-referrer" />
              <span v-else class="icon-placeholder">{{ form.name ? form.name.slice(0, 1) : '?' }}</span>
              <span v-if="form.name" class="icon-label">{{ form.name }}<svg v-if="form.url.includes('%s')" class="icon-label-search" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/></svg></span>
            </div>
            <input type="file" accept="image/*" class="dialog-upload-input" @change="handleFileUpload" />
          </label>
          <div class="dialog-fields">
            <div class="dialog-row">
              <UiInput v-model="form.url" class="dialog-url" :placeholder="t('ic_urlPlaceholder')" @enter="addOrSaveIcon" />
            </div>
            <div class="dialog-row">
              <UiInput v-model="form.iconUrl" :placeholder="t('ic_iconUrlPlaceholder')" @blur="validateFormIconUrl" />
              <UiButton :label="t('apply')" @click="applyIconUrl" />
            </div>
            <div class="dialog-row">
              <UiInput v-model="form.name" :placeholder="t('ic_namePlaceholder')" />
              <UiButton :label="dialog.mode === 'edit' ? t('ic_save') : t('add')" @click="addOrSaveIcon" />
            </div>
            <UiText v-if="dialogHint" class="dialog-hint">{{ dialogHint }}</UiText>
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
}

.folder-wrapper--selecting .folder-title {
  pointer-events: none;
}

.folder-border {
  position: absolute;
  inset: 0;
  border: 1.5px solid var(--panel-text);
  border-radius: 6px;
  box-sizing: border-box;
  background: var(--hover-bg);
  opacity: 0.12;
  pointer-events: none;
}

.folder-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  opacity: 0;
  transition: opacity 120ms ease;
  display: inline-block;
  font-family: inherit;
  font-size: 14px;
  color: var(--panel-text);
  white-space: nowrap;
  text-align: center;
  padding: 1px 8px;
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  background: var(--panel-bg);
  line-height: 1.3;
  outline: none;
  box-sizing: border-box;
  font-stretch: normal;
  letter-spacing: 0.2px;
  z-index: 1;
  width: fit-content;
  max-width: 48px;
}

.folder-title--top {
  top: -10px;
}

.folder-title--bottom {
  bottom: -10px;
}

.folder-title:hover,
.folder-title:focus {
  opacity: 1;
}

.folder-title--has-value {
  opacity: 1;
  max-width: 120px;
  border: none;
  background: transparent;
  padding: 1px 2px;
  text-shadow: 0 0 1px var(--panel-bg);
}

.folder-title--has-value:hover,
.folder-title--has-value:focus {
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  padding: 1px 8px;
  text-shadow: none;
}

.selection-border {
  border-radius: 6px;
  box-sizing: border-box;
  pointer-events: auto;
  background-color: var(--hover-bg);
  opacity: 0.12;
  background-image:
    linear-gradient(to right, var(--panel-text) 50%, transparent 50%),
    linear-gradient(to right, var(--panel-text) 50%, transparent 50%),
    linear-gradient(to bottom, var(--panel-text) 50%, transparent 50%),
    linear-gradient(to bottom, var(--panel-text) 50%, transparent 50%);
  background-size: 14px 1.5px, 14px 1.5px, 1.5px 14px, 1.5px 14px;
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
  background-position: top, bottom, left, right;
}

.icon-cell {
  position: fixed;
  z-index: 10;
  pointer-events: auto;
  padding: 2px;
  box-sizing: border-box;
  overflow: visible;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}

.icon-display {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  transition: border-color 120ms ease, background 120ms ease;
  box-sizing: border-box;
  overflow: hidden;
  padding-bottom: 22px;
}

.icon-cell:hover > .icon-display,
.icon-cell--dragging > .icon-display,
.icon-cell--hover-locked > .icon-display,
.icon-cell--drag-hover > .icon-display {
  border-color: var(--panel-border);
  background: var(--hover-bg);
}

body.icons-hover-locked .icon-cell:not(.icon-cell--hover-locked):hover > .icon-display {
  border-color: transparent;
  background: transparent;
}

.icon-cell--in-folder > .icon-display {
  transform: scale(0.88);
}

.drag-preview {
  border: 1.5px dashed var(--panel-text);
  border-radius: 6px;
  box-sizing: border-box;
}

.icon-img {
  width: 32px;
  height: 32px;
  aspect-ratio: 1 / 1;
  object-fit: contain;
  border-radius: 4px;
  pointer-events: none;
  flex-shrink: 0;
}

.icon-placeholder {
  font-size: 20px;
  font-weight: 600;
  color: var(--panel-text);
  opacity: 0.7;
}

.icon-label {
  position: absolute;
  bottom: 2px;
  left: 0;
  right: 0;
  font-size: 14px;
  color: var(--panel-text);
  height: 20px;
  line-height: 1.3;
  overflow: hidden;
  white-space: nowrap;
  text-align: center;
  text-shadow: 0 0 1px var(--panel-bg);
  pointer-events: none;
  font-family: inherit;
  font-stretch: normal;
  letter-spacing: 0.2px;
}

.icon-label-search {
  vertical-align: middle;
  margin-left: 2px;
  opacity: 0.75;
}

.search-edit-input {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  width: 90%;
  max-width: 120px;
  height: 22px;
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 0 6px;
  font-family: inherit;
  font-size: 14px;
  color: var(--panel-text);
  line-height: 1.3;
  background: var(--panel-bg);
  outline: none;
  text-align: center;
  font-stretch: normal;
  letter-spacing: 0.2px;
}

.icon-ctx-row {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  gap: 2px;
  pointer-events: auto;
  height: 20px;
}

:deep(.ctx-btn.ui-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 20px;
  border-radius: 3px;
  padding: 0;
  font-size: 11px;
  color: var(--panel-text);
  background: var(--panel-bg);
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
.icon-cell--add:hover > .icon-display {
  background: var(--hover-bg);
}
.icon-add-svg {
  pointer-events: none;
}
.icon-add-svg .add-ring {
  fill: none;
  stroke: var(--panel-text);
  stroke-width: 1.6;
  stroke-dasharray: 4 2.5;
  animation: addSpin 12s linear infinite;
  transform-origin: 24px 24px;
}
.icon-add-svg .add-ring-inner {
  fill: none;
  stroke: var(--panel-text);
  stroke-width: 1;
  opacity: 0.35;
}
.icon-add-svg .add-cross {
  stroke: var(--panel-text);
  stroke-width: 2.4;
  stroke-linecap: round;
}
@keyframes addSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
}

.dialog-box {
  position: relative;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 20px;
  min-width: 420px;
  max-width: 90vw;
  box-shadow: 0 8px 32px var(--shadow);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.dialog-icon-preview {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  border: 1px dashed var(--panel-border);
  transition: border-color 120ms, background 120ms;
}
.dialog-icon-preview:hover {
  border-color: var(--accent);
  background: var(--hover-bg);
}
.dialog-upload-input {
  display: none;
}

.dialog-icon-display {
  width: 72px;
  height: 80px;
  border: none;
  background: transparent;
}

.dialog-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.dialog-hint {
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  margin-top: 8px;
  font-size: 11px;
  color: var(--panel-text);
  padding: 4px 12px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: none;
  white-space: nowrap;
  z-index: 1;
}

.dialog-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.dialog-row :deep(.ui-input) {
  flex: 1;
  min-width: 0;
}
.dialog-row :deep(.ui-input-field) {
  width: 100%;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 150ms ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

html.mode-popup .icon-img {
  width: 16px;
  height: 16px;
}
html.mode-popup .icon-placeholder {
  font-size: 10px;
}
html.mode-popup .icon-label {
  font-size: 7px;
  height: 10px;
  letter-spacing: 0;
}
html.mode-popup .icon-label-search {
  width: 7px;
  height: 7px;
}
html.mode-popup .icon-display {
  padding-bottom: 11px;
}
html.mode-popup .dialog-icon-display .icon-img {
  width: 32px;
  height: 32px;
}
html.mode-popup .dialog-icon-display .icon-placeholder {
  font-size: 20px;
}
html.mode-popup .dialog-icon-display {
  padding-bottom: 22px;
}
html.mode-popup .dialog-box .icon-label {
  font-size: 14px;
  height: 20px;
  letter-spacing: 0.2px;
}
html.mode-popup .dialog-box .icon-label-search {
  width: 11px;
  height: 11px;
}
</style>