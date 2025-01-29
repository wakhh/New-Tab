<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import UiPanel from '../ui/UiPanel.vue'
import UiRow from '../ui/UiRow.vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiButton from '../ui/UiButton.vue'
import { t } from '../js/useI18n'
import { mediaListWidth, sourceStates, networkFiles, selectedSourceKey, MEDIA_SOURCES, MEDIA_TYPES } from '../js/usePersist'
import { mediaLocalFiles, displayLists } from '../js/useMediaLists'
import { playbackSelectItem, playbackCycleFolder } from '../js/usePlaybackActions'
import { panelActive, edgeBR, hoveredPanel } from '../js/useViewport'
import { itemKey } from '../utils/media'

const mediaBatchUrlInput = ref('')

const folderLists = {}
for (const src of MEDIA_SOURCES) {
  folderLists[src] = {}
  for (const type of MEDIA_TYPES) {
    folderLists[src][type] = computed(() => {
      const raw = src === 'local' ? mediaLocalFiles.value : networkFiles.value
      const list = raw.filter((f) => f.type === type)
      if (src === 'local') {
        const roots = [], subs = []
        for (const f of list) {
          const k = f.path2 ? f.path1 + '/' + f.path2 : f.path1
          const arr = f.path2 ? subs : roots
          if (!arr.includes(k)) arr.push(k)
        }
        return ['all', ...roots, ...subs]
      }
      const sites = []
      for (const f of list) {
        if (f.site && !sites.includes(f.site)) sites.push(f.site)
      }
      return ['all', ...sites]
    })
  }
}

const currentSource = computed(() => (selectedSourceKey.value || 'local-image').split('-')[0])
const currentMediaType = computed(() => (selectedSourceKey.value || 'local-image').split('-')[1])
const currentFolder = computed(() => sourceStates[currentSource.value]?.[currentMediaType.value]?.folder.value || 'all')
const currentSortBy = computed(() => sourceStates[currentSource.value]?.[currentMediaType.value]?.sortBy.value || 'name')
const currentSortDir = computed(() => sourceStates[currentSource.value]?.[currentMediaType.value]?.sortDir.value || 'asc')
const currentDisplayList = computed(() => displayLists[currentSource.value]?.[currentMediaType.value]?.value || [])
const currentFolderList = computed(() => folderLists[currentSource.value]?.[currentMediaType.value]?.value || ['all'])
const currentSelectedItem = computed(() => sourceStates[currentSource.value]?.[currentMediaType.value]?.selectedItem.value || null)

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif']
const MUSIC_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']

function detectMediaType(name) {
  const ext = String(name || '')
    .split('?')[0].split('#')[0].split('.').pop().toLowerCase()
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (MUSIC_EXTS.includes(ext)) return 'music'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  return null
}
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
}

function removeNetworkFile(item) {
  if (!item || currentSource.value !== 'network') return
  const key = itemKey(item)
  if (!key) return
  const next = networkFiles.value.filter((f) => itemKey(f) !== key)
  networkFiles.set(next)
  const sel = sourceStates[currentSource.value][currentMediaType.value].selectedItem.value
  if (sel && itemKey(sel) === key) sourceStates[currentSource.value][currentMediaType.value].selectedItem.set(null)
}

function cycleFolder() {
  playbackCycleFolder()
}
function toggleSort(by) {
  const st = sourceStates[currentSource.value][currentMediaType.value]
  if (st.sortBy.value === by) st.sortDir.set(st.sortDir.value === 'asc' ? 'desc' : 'asc')
  else { st.sortBy.set(by); st.sortDir.set('asc') }
}
function selectSourceKey(newKey) {
  if (!newKey) return
  const [src, type] = newKey.split('-')
  if (sourceStates[src]?.[type]) selectedSourceKey.set(newKey)
}


function batchPlaceholder() {
  return t('batchPlaceholder')
}

const sourceOptions = computed(() => [
  { value: 'network', label: t('mediaNetwork') },
  { value: 'local', label: t('mediaLocal') }
])
const typeOptions = computed(() => [
  { value: 'image', label: t('image') },
    { value: 'music', label: t('music') },
      { value: 'video', label: t('video') }
])

const sortOptions = computed(() => {
  const arrow = currentSortDir.value === 'asc' ? '↑' : '↓'
  return [
    { value: 'name', label: t('sortName') + (currentSortBy.value === 'name' ? arrow : '') },
    { value: 'time', label: t('sortTime') + (currentSortBy.value === 'time' ? arrow : '') }
  ]
})

function onSortSelect(v) {
  toggleSort(v)
}

function onMediaSourceSelect(v) {
  selectSourceKey(`${v}-${currentMediaType.value}`)
}
function onMediaTypeSelect(v) {
  selectSourceKey(`${currentSource.value}-${v}`)
}

const folderLabel = computed(() =>
  currentFolder.value === 'all' ? t('folderAll') : currentFolder.value
)

function rowKey(item) {
  return currentSource.value === 'local' ? `${item.path1}/${item.path2}/${item.filename}` : item.url
}
function itemLabel(item) {
  return currentSource.value === 'local' ? item.filename : item.pathname
}

const listEl = ref(null)

const listWidth = mediaListWidth
const listWidthStyle = computed(() => ({ width: `${listWidth.value || 260}px`, flex: '0 0 auto' }))

const resizing = ref(false)
let resizeStartX = 0
let resizeStartW = 0
const MIN_LIST_W = 180

function onListResizeStart(e) {
  resizing.value = true
  panelActive.value = 'br'
  resizeStartX = e.clientX
  resizeStartW = listEl.value?.offsetWidth || listWidth.value || 0
  window.addEventListener('mousemove', onListResizeMove)
  window.addEventListener('mouseup', onListResizeEnd)
  e.preventDefault()
}

function onListResizeMove(e) {
  if (!resizing.value) return
  const next = Math.round(resizeStartW + (resizeStartX - e.clientX))
  const max = Math.max(MIN_LIST_W, window.innerWidth - 24)
  listWidth.value = Math.max(MIN_LIST_W, Math.min(next, max))
}

function onListResizeEnd() {
  if (!resizing.value) return
  resizing.value = false
  panelActive.value = null
  listWidth.set(listWidth.value)
  window.removeEventListener('mousemove', onListResizeMove)
  window.removeEventListener('mouseup', onListResizeEnd)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onListResizeMove)
  window.removeEventListener('mouseup', onListResizeEnd)
})

function scrollToSelected() {
  const el = listEl.value
  if (!el) return
  const list = currentDisplayList.value
  const sel = currentSelectedItem.value
  if (sel) {
    const selKey = itemKey(sel)
    const idx = list.findIndex((it) => itemKey(it) === selKey)
    if (idx >= 0) {
      const itemEl = el.children[idx]
      if (itemEl) {
        const target = itemEl.offsetTop + itemEl.offsetHeight / 2 - el.clientHeight / 2
        el.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
        return
      }
    }
  }
  el.scrollTo({ top: 0 })
}

onMounted(async () => {
  await nextTick()
  scrollToSelected()
})

watch(
  [currentDisplayList, currentSelectedItem],
  async () => {
    await nextTick()
    scrollToSelected()
  },
  { flush: 'post' }
)

watch(
  [edgeBR, hoveredPanel],
  async () => {
    if (edgeBR.value || hoveredPanel.value === 'br') {
      await nextTick()
      scrollToSelected()
    }
  }
)
</script>

<template>
  <UiPanel panel-id="br" class="ui-panel-br" :style="listWidthStyle">
    <div v-if="currentSource === 'network'" class="media-batch-wrap">
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

    <UiRow>
      <UiButton v-if="currentSource === 'network'" :label="t('addTo')" @click="addNetworkFiles(mediaBatchUrlInput)" />
      <UiSwitch :options="sourceOptions" :model-value="currentSource" show-shortcut="N" @select="onMediaSourceSelect" />
    </UiRow>

    <div class="media-list-wrap">
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
      <div ref="listEl" class="ui-column media-list">
        <div v-for="(item, idx) in currentDisplayList" :key="rowKey(item)" class="media-item"
          :class="{ selected: currentSelectedItem && itemKey(currentSelectedItem) === itemKey(item) }" @click="selectItem(item)">
          <span class="media-item-main">{{ itemLabel(item) }}</span>
          <span class="media-item-idx">{{ idx + 1 }}</span>
          <button v-if="currentSource === 'network'" class="media-delete" type="button"
            @click.stop="removeNetworkFile(item)">
            ×
          </button>
        </div>
        <div v-if="!currentDisplayList.length" class="media-item empty">
          {{ currentSource === 'local' ? t('noLocalFiles') : t('noFiles') }}
        </div>
      </div>
    </div>

    <UiRow>
      <UiButton :label="folderLabel" show-shortcut="F" @click="cycleFolder">
        <template #icon>
          <svg class="folder-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path
              d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.2c.4 0 .78.16 1.06.44l.9.9A1.5 1.5 0 0 0 8.7 3.6h4.8A1.5 1.5 0 0 1 15 5.1v6.4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 11.5z"
              fill="currentColor" />
          </svg>
        </template>
      </UiButton>
      <UiSwitch :options="typeOptions" :model-value="currentMediaType" show-shortcut="L" @select="onMediaTypeSelect" />
      <UiSwitch :options="sortOptions" :model-value="currentSortBy" @select="onSortSelect" />
    </UiRow>
  </UiPanel>
</template>

<style scoped>
.ui-panel-br { bottom: 12px; right: 12px; max-width: calc(100vw - 24px); box-sizing: border-box; }
.ui-panel-br > :deep(.ui-row) { justify-content: flex-end !important; flex-wrap: nowrap !important; }
@media (orientation: landscape) {
  .ui-panel-br { max-width: calc(100vw / 3); }
}

.media-batch-wrap,
.media-list-wrap {
  width: 100%;
  box-sizing: border-box;
}

.media-batch-wrap,
.media-list-wrap {
  position: relative;
  display: flex;
  margin: 3px 0 6px;
}

.media-batch-input,
.media-list {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--panel-border, rgba(255, 255, 255, 0.2));
  border-radius: 6px;
  background: var(--panel-bg);
  color: var(--panel-text);
  font: inherit;
  outline: none;
}

.media-batch-input {
  min-height: 64px;
  padding: 6px 8px;
  resize: vertical;
  white-space: pre-wrap;
}

.media-batch-input::placeholder {
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
  scrollbar-color: var(--panel-text) transparent;
}

.media-list::-webkit-scrollbar {
  width: 6px;
}

.media-list::-webkit-scrollbar-thumb {
  background: var(--panel-text);
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
  color: var(--panel-text);
  opacity: 0.45;
  cursor: col-resize;
  user-select: none;
  padding: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
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
  background: var(--active-bg);
  color: var(--accent);
  font-weight: 600;
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
  color: var(--panel-text);
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
  color: #e0533d;
}
</style>