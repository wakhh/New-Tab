<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiButton from '../ui/UiButton.vue'
import { t } from '../js/i18n'
import { mediaListWidth, sourceStates, networkFiles, selectedSource, selectedDirId, MEDIA_SOURCES, MEDIA_TYPES, mediaVisualSource, musicSource } from '../js/persist'
import { mediaLocalFiles, displayLists, playbackSelectItem, playbackCycleFolder, widgetActive, edgeBR, hoveredWidget, itemId, isErrored } from '../js/core'
import { dirHandles, addDirHandle, removeDirHandle, scanDir, requestDirPermission } from '../js/storage'
import { IMAGE_EXTS, MUSIC_EXTS, VIDEO_EXTS, detectMediaType } from '../js/mediaExts'

// ====== 文件夹列表 ======
const mediaBatchUrlInput = ref('')

// ====== 当前选中状态 ======
const currentSource = computed(() => selectedSource.value?.src || 'local')
const currentMediaType = computed(() => selectedSource.value?.type || 'image')
const currentFolder = computed(() => sourceStates[currentSource.value]?.[currentMediaType.value]?.folder.value || 'all')
const currentSortBy = computed(() => sourceStates[currentSource.value]?.[currentMediaType.value]?.sortBy.value || 'name')
const currentSortDir = computed(() => sourceStates[currentSource.value]?.[currentMediaType.value]?.sortDir.value || 'asc')
const currentDisplayList = computed(() => displayLists[currentSource.value]?.[currentMediaType.value]?.value || [])
const currentSelectedItem = computed(() => sourceStates[currentSource.value]?.[currentMediaType.value]?.selectedItem.value || null)

// ====== 网络文件操作 ======
function siteOf(url) { try { return new URL(url).host } catch { return '' } }
function pathnameOf(url) { try { return new URL(url).pathname.split('/').filter(Boolean).pop() || url } catch { return url } }

function addNetworkFiles(rawText) {
  const text = String(rawText ?? mediaBatchUrlInput.value ?? '')
  const urls = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!urls.length) return 0
  let added = 0
  const next = [...networkFiles.value]
  for (const raw of urls) {
    const url = String(raw || '').trim()
    if (!url) continue
    const type = detectMediaType(url)
    if (!type) continue
    if (next.some((f) => f.url === url)) continue
    next.push({ url, site: siteOf(url), pathname: pathnameOf(url), ctime: Date.now(), type })
    added++
  }
  if (added > 0) {
    networkFiles.set(next)
    mediaBatchUrlInput.value = ''
  }
  return added
}

function selectItem(item) {
  playbackSelectItem(item)
  scrollToSelected()
}

function removeNetworkFile(item) {
  if (!item || currentSource.value !== 'network') return
  const key = itemId(item)
  if (!key) return
  const next = networkFiles.value.filter((f) => itemId(f) !== key)
  networkFiles.set(next)
  const sel = sourceStates[currentSource.value][currentMediaType.value].selectedItem.value
  if (sel && itemId(sel) === key) sourceStates[currentSource.value][currentMediaType.value].selectedItem.set(null)
}

function cycleFolder() {
  playbackCycleFolder()
}
function toggleSort(by) {
  const st = sourceStates[currentSource.value][currentMediaType.value]
  if (by === 'random') {
    if (st.sortBy.value === 'random') { st.shuffleSeed.set((st.shuffleSeed.value + 1) % 1000000); return }
    st.sortBy.set('random')
    return
  }
  if (st.sortBy.value === by) st.sortDir.set(st.sortDir.value === 'asc' ? 'desc' : 'asc')
  else { st.sortBy.set(by); st.sortDir.set(st.sortBy.value === 'name' ? 'asc' : 'desc') }
}
function selectSource(newKey) {
  if (!newKey) return
  if (sourceStates[newKey.src]?.[newKey.type]) selectedSource.set(newKey)
}


function batchPlaceholder() {
  return t('batchPlaceholder')
}

// ====== 下拉选项 ======
const localAvailable = computed(() => mediaLocalFiles.value.length > 0)
const sourceOptions = computed(() => {
  const arr = [{ value: 'network', label: t('mediaNetwork') }, { value: 'dir', label: t('mediaDir') }]
  if (localAvailable.value) arr.push({ value: 'local', label: t('mediaLocal') })
  return arr
})
watch([currentSource, localAvailable], ([src, localOk]) => {
  if (src === 'local' && !localOk) {
    selectedSource.set({ src: 'network', type: currentMediaType.value })
  }
}, { immediate: true })
const typeOptions = computed(() => [
  { value: 'image', label: t('image'), shortcut: 'P' },
    { value: 'music', label: t('music') },
      { value: 'video', label: t('video'), shortcut: 'V' }
])

const sortOptions = computed(() => {
  const arrow = currentSortDir.value === 'asc' ? ' ↑' : ' ↓'
  const shuffleActive = currentSortBy.value === 'random'
  return [
    { value: 'random', label: t('sortRandom') + (shuffleActive ? ' ✦' : '') },
    { value: 'name', label: t('sortName') + (currentSortBy.value === 'name' ? arrow : '') },
    { value: 'time', label: t('sortTime') + (currentSortBy.value === 'time' ? arrow : '') }
  ]
})

function onSortSelect(v) {
  toggleSort(v)
}

function onMediaSourceSelect(v) {
  selectSource({ src: v, type: currentMediaType.value })
}
function onMediaTypeSelect(v) {
  selectSource({ src: currentSource.value, type: v })
}

const _ROOT_DIR_BY_TYPE = { image: 'Pictures', video: 'Videos', music: 'Music' }
function displayFolderName(name) {
  if (!name) return ''
  if (name === 'all') return currentSource.value === 'network' ? t('folderAllDomain') : t('folderAll')
  if (currentSource.value === 'dir') {
    if (!selectedDirId) {
      return name
    } else {
      if (!name.includes('/')) return t('folderRoot')
      return name.split('/').pop()
    }
  }
  if (currentSource.value !== 'local') return name
  const prefix = _ROOT_DIR_BY_TYPE[currentMediaType.value]
  if (!prefix) return name
  if (name === prefix) return t('folderRoot')
  const pfx = prefix + '/'
  if (name.startsWith(pfx)) return name.slice(pfx.length)
  return name
}
const folderLabel = computed(() => displayFolderName(currentFolder.value))

// ====== 授权文件夹操作 ======
async function onAddDir() {
  try {
    const h = await window.showDirectoryPicker()
    const id = await addDirHandle(h)
    selectedDirId.set(id)
    sourceStates.dir?.[currentMediaType.value]?.folder?.set('all')
  } catch {}
}
function onAddAction() {
  if (currentSource.value === 'network') addNetworkFiles(mediaBatchUrlInput.value)
  else if (currentSource.value === 'dir') onAddDir()
}
async function onRemoveDir(id) {
  const h = dirHandles.value.find((x) => x.id === id)
  if (!h) return
  await removeDirHandle(id)
  if (id !== selectedDirId.value) return
  if (sourceStates.dir) {
    for (const type of MEDIA_TYPES) {
      const st = sourceStates.dir[type]
      if (st?.folder) st.folder.set('all')
      if (st?.selectedItem) st.selectedItem.set(null)
    }
  }
  if (mediaVisualSource.value?.src === 'dir') mediaVisualSource.set(null)
  if (musicSource.value?.src === 'dir') musicSource.set(null)
}
async function onSelectDir(id) {
  if (id === selectedDirId.value) return
  selectedDirId.set(id)
  sourceStates.dir?.[currentMediaType.value]?.folder?.set('all')
  if (id) {
    const h = dirHandles.value.find((x) => x.id === id)
    if (h && !h.valid) {
      const ok = await requestDirPermission(id)
      if (!ok) return
    }
  }
}

function rowKey(item) {
  if (currentSource.value === 'local' || currentSource.value === 'dir') return `${item.path1}/${item.path2}/${item.filename}`
  return item.url
}
function itemLabel(item) {
  if (currentSource.value === 'local' || currentSource.value === 'dir') return item.filename
  return item.pathname
}

// ====== 列表宽度拖拽 ======
const listEl = ref(null)
const widgetRef = ref(null)

const ITEM_H = ref(0)
const scrollTop = ref(0)

const listWidth = ref(mediaListWidth.value || 260)
watch(mediaListWidth, (v) => {
  if (v != null) listWidth.value = v
})
const listWidthStyle = computed(() => ({ width: `${listWidth.value}px`, flex: '0 0 auto' }))

const resizing = ref(false)
let resizeStartX = 0
let resizeStartW = 0
const MIN_LIST_W = 180

function onListResizeStart(e) {
  resizing.value = true
  widgetActive.value = 'br'
  resizeStartX = e.clientX
  resizeStartW = listWidth.value
  window.addEventListener('mousemove', onListResizeMove)
  window.addEventListener('mouseup', onListResizeEnd)
  e.preventDefault()
}

function onListResizeMove(e) {
  if (!resizing.value) return
  const next = Math.round(resizeStartW + (resizeStartX - e.clientX))
  const max = Math.min(window.innerWidth, 800) - 44
  listWidth.value = Math.max(MIN_LIST_W, Math.min(next, max))
}

function onListResizeEnd() {
  if (!resizing.value) return
  resizing.value = false
  widgetActive.value = null
  if (listWidth.value !== (mediaListWidth.value || 260)) {
    mediaListWidth.set(listWidth.value)
  }
  window.removeEventListener('mousemove', onListResizeMove)
  window.removeEventListener('mouseup', onListResizeEnd)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onListResizeMove)
  window.removeEventListener('mouseup', onListResizeEnd)
  _ro?.disconnect()
})

// ====== 虚拟化 ======
const BUFFER = 5
const visibleStart = computed(() => {
  if (!ITEM_H.value) return 0
  return Math.max(0, Math.floor(scrollTop.value / ITEM_H.value) - BUFFER)
})
const visibleEnd = computed(() => {
  if (!ITEM_H.value || !listEl.value) return 30
  const total = currentDisplayList.value.length
  const visible = Math.ceil((scrollTop.value + listEl.value.clientHeight) / ITEM_H.value) + BUFFER
  return Math.min(total, visible)
})
const visibleItems = computed(() => {
  const list = currentDisplayList.value
  return list.slice(visibleStart.value, visibleEnd.value).map((it, i) => ({ item: it, idx: visibleStart.value + i }))
})
const totalHeight = computed(() => currentDisplayList.value.length * ITEM_H.value)
const spacerTop = computed(() => visibleStart.value * ITEM_H.value)
const spacerBottom = computed(() => Math.max(0, totalHeight.value - visibleEnd.value * ITEM_H.value))

function onListScroll() {
  scrollTop.value = listEl.value?.scrollTop || 0
}

// ====== 选中项滚动定位 ======
function scrollToSelected(smooth = true) {
  const el = listEl.value
  if (!el || !ITEM_H.value) return
  const list = currentDisplayList.value
  const sel = currentSelectedItem.value
  if (sel) {
    const selKey = itemId(sel)
    const idx = list.findIndex((it) => itemId(it) === selKey)
    if (idx >= 0) {
      const target = idx * ITEM_H.value + ITEM_H.value / 2 - el.clientHeight / 2
      el.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' })
      return
    }
  }
  el.scrollTo({ top: 0 })
}

let _ro = null, _lastH = 0
onMounted(async () => {
  await nextTick()
  if (listEl.value) {
    const probe = document.createElement('div')
    probe.className = 'media-item'
    probe.style.visibility = 'hidden'
    listEl.value.appendChild(probe)
    ITEM_H.value = probe.offsetHeight || 24
    listEl.value.removeChild(probe)
  }
  scrollToSelected(false)
  _ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const h = e.contentRect.height
      if (_lastH === 0 && h > 0) scrollToSelected(false)
      _lastH = h
    }
  })
  if (listEl.value) _ro.observe(listEl.value)
})

watch(
  currentDisplayList,
  async () => {
    await nextTick()
    scrollToSelected(false)
  },
  { flush: 'post' }
)
watch(
  currentSelectedItem,
  async () => {
    await nextTick()
    scrollToSelected(currentSortBy.value !== 'random')
  },
  { flush: 'post' }
)


</script>

<template>
  <div ref="widgetRef" class="ui-widget" data-widget-id="br">
    <div v-if="currentSource === 'network'" class="ui-row media-batch-wrap" :style="listWidthStyle">
      <div class="media-resize" :class="{ active: resizing }" @mousedown="onListResizeStart">
        <svg viewBox="0 0 8 14" width="5" height="10" aria-hidden="true">
          <circle cx="2.5" cy="3" r="0.8" fill="currentColor"/>
          <circle cx="5.5" cy="3" r="0.8" fill="currentColor"/>
          <circle cx="2.5" cy="7" r="0.8" fill="currentColor"/>
          <circle cx="5.5" cy="7" r="0.8" fill="currentColor"/>
          <circle cx="2.5" cy="11" r="0.8" fill="currentColor"/>
          <circle cx="5.5" cy="11" r="0.8" fill="currentColor"/>
        </svg>
      </div>
      <textarea v-model="mediaBatchUrlInput" class="media-batch-input" :placeholder="batchPlaceholder()"
        rows="3" />
    </div>

    <div v-show="currentSource === 'dir'" class="ui-row dir-list-wrap" :style="listWidthStyle">
      <div class="media-resize" :class="{ active: resizing }" @mousedown="onListResizeStart">
        <svg viewBox="0 0 8 14" width="5" height="10" aria-hidden="true">
          <circle cx="2.5" cy="3" r="0.8" fill="currentColor"/>
          <circle cx="5.5" cy="3" r="0.8" fill="currentColor"/>
          <circle cx="2.5" cy="7" r="0.8" fill="currentColor"/>
          <circle cx="5.5" cy="7" r="0.8" fill="currentColor"/>
          <circle cx="2.5" cy="11" r="0.8" fill="currentColor"/>
          <circle cx="5.5" cy="11" r="0.8" fill="currentColor"/>
        </svg>
      </div>
      <div class="ui-column dir-list">
        <div v-if="!dirHandles.length" class="media-item empty">{{t('noDirs')}}</div>
        <div v-else class="media-item dir-item"
          :class="{ selected: !selectedDirId }" @click="onSelectDir(null)">
          <span class="media-item-main">{{ t('folderAll') }}</span>
        </div>
        <div v-for="(h, i) in dirHandles" :key="h.id" class="media-item dir-item"
          :class="{ selected: h.id === selectedDirId, disabled: !h.valid }" @click="onSelectDir(h.id)">
          <span class="media-item-main">{{ h.name }}</span>
          <span class="media-item-idx">{{ i + 1 }}</span>
          <button class="media-delete" type="button" @click.stop="onRemoveDir(h.id)">×</button>
        </div>
      </div>
    </div>

    <div class="ui-row">
      <UiButton v-show="currentSource === 'network' || currentSource === 'dir'" :label="t('add')" @click="onAddAction" />
      <UiSwitch :options="sourceOptions" :model-value="currentSource" show-shortcut="N" cycle @select="onMediaSourceSelect" />
    </div>
    <div class="ui-row">
      <UiSwitch :options="typeOptions" :model-value="currentMediaType" show-shortcut="L" cycle @select="onMediaTypeSelect" />
    </div>

    <div class="ui-row media-list-wrap" :style="listWidthStyle">
      <div class="media-resize" :class="{ active: resizing }" @mousedown="onListResizeStart">
        <svg viewBox="0 0 8 14" width="5" height="10" aria-hidden="true">
          <circle cx="2.5" cy="3" r="0.8" fill="currentColor"/>
          <circle cx="5.5" cy="3" r="0.8" fill="currentColor"/>
          <circle cx="2.5" cy="7" r="0.8" fill="currentColor"/>
          <circle cx="5.5" cy="7" r="0.8" fill="currentColor"/>
          <circle cx="2.5" cy="11" r="0.8" fill="currentColor"/>
          <circle cx="5.5" cy="11" r="0.8" fill="currentColor"/>
        </svg>
      </div>
      <div ref="listEl" class="ui-column media-list" @scroll="onListScroll">
        <div v-if="!currentDisplayList.length" class="media-item empty">
          {{ currentSource === 'local' ? t('noLocalFiles') : t('noFiles') }}
        </div>
        <template v-else-if="ITEM_H">
          <div :style="{ height: spacerTop + 'px' }"></div>
          <div v-for="(entry, i) in visibleItems" :key="rowKey(entry.item)" class="media-item"
            :class="{ selected: currentSelectedItem && itemId(currentSelectedItem) === itemId(entry.item), errored: isErrored(entry.item) }" @click="selectItem(entry.item)">
            <span class="media-item-main">{{ itemLabel(entry.item) }}</span>
            <span class="media-item-idx">{{ entry.idx + 1 }}</span>
            <button v-if="currentSource === 'network'" class="media-delete" type="button"
              @click.stop="removeNetworkFile(entry.item)">
              ×
            </button>
          </div>
          <div :style="{ height: spacerBottom + 'px' }"></div>
        </template>
      </div>
    </div>

    <div class="ui-row">
      <UiButton :label="folderLabel" show-shortcut="F" @click="cycleFolder">
        <template #icon>
          <svg class="folder-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path
              d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.2c.4 0 .78.16 1.06.44l.9.9A1.5 1.5 0 0 0 8.7 3.6h4.8A1.5 1.5 0 0 1 15 5.1v6.4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 11.5z"
              fill="currentColor" />
          </svg>
        </template>
      </UiButton>
      <UiSwitch :options="sortOptions" :model-value="currentSortBy" @select="onSortSelect" />
    </div>
  </div>
</template>

<style scoped>
.media-batch-wrap,
.media-list-wrap,
.dir-list-wrap {
  position: relative;
  margin-left: auto;
  pointer-events: auto;
  display: flex;
  align-items: stretch;
}

.media-batch-input,
.media-list,
.dir-list {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--widget-border);
  border-radius: 6px;
  background: var(--widget-bg);
  color: var(--widget-text);
  font: inherit;
  outline: none;
}

.media-batch-input {
  min-height: 64px;
  max-height: calc(7 * (1.5em + 4px));
  padding: 6px 8px;
  resize: vertical;
  white-space: pre-wrap;
}

.media-batch-input::placeholder {
  color: inherit;
  opacity: 0.55;
}

.folder-icon {
  margin-right: 4px;
  vertical-align: -1px;
}

.media-list {
  height: calc(7 * (1.5em + 4px));
  overflow-y: auto;
  overflow-x: hidden;
  color-scheme: light dark;
  scrollbar-width: thin;
  scrollbar-color: var(--widget-text) transparent;
}

.dir-list {
  height: calc(5 * (1.5em + 4px));
  overflow-y: auto;
  overflow-x: hidden;
  color-scheme: light dark;
  scrollbar-width: thin;
  scrollbar-color: var(--widget-text) transparent;
}

.media-list::-webkit-scrollbar {
  width: 6px;
}

.media-list::-webkit-scrollbar-thumb {
  background: var(--widget-text);
  opacity: 0.4;
  border-radius: 3px;
}

.media-list::-webkit-scrollbar-track {
  background: transparent;
}

.media-resize {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 22px;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--widget-text);
  opacity: 0.45;
  cursor: col-resize;
  user-select: none;
  padding: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
  pointer-events: auto;
}

.media-resize:hover,
.media-resize.active {
  opacity: 1;
  color: var(--accent);
}

.media-item {
  display: flex;
  align-items: center;
  height: calc(1.5em + 4px);
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}

.media-item:hover {
  background: var(--hover-bg);
}

.media-item.selected {
  background: var(--hover-bg);
  color: var(--accent);
  font-weight: 600;
}

.media-item.errored .media-item-main,
.media-item.disabled .media-item-main {
  color: var(--text-muted, #888);
  text-decoration: line-through;
}

.media-item.selected.errored .media-item-main,
.media-item.selected.disabled .media-item-main {
  color: var(--accent);
  text-decoration: line-through;
}

.media-item.empty {
  cursor: default;
  opacity: 0.5;
}

.media-item-main {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-item-idx {
  flex: none;
  opacity: 0.45;
  font-variant-numeric: tabular-nums;
  margin-left: 8px;
}

.media-delete {
  flex: none;
  border: none;
  background: transparent;
  color: var(--widget-text);
  opacity: 0.45;
  cursor: pointer;
  padding: 0 4px;
  margin-left: 4px;
  font: inherit;
  line-height: 1;
  border-radius: 4px;
}

.media-delete:hover {
  opacity: 1;
  color: var(--danger);
}
</style>