import { ref, computed } from 'vue'
import {
  MEDIA_SOURCES, MEDIA_TYPES, sourceStates, networkFiles, selectedSource
} from './usePersist'
import {
  itemId,
  findItemById as findItemByIdRaw,
  buildList as buildListRaw,
  shuffleArray
} from '../utils/media'

export const mediaLocalFiles = ref([])

async function loadMediaIndex() {
  try {
    const res = await fetch(browser.runtime.getURL('media-index.json'), { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data)) mediaLocalFiles.value = data
  } catch {}
}
loadMediaIndex()

export const sourceFiles = {}
for (const src of MEDIA_SOURCES) {
  sourceFiles[src] = {}
  for (const type of MEDIA_TYPES) {
    sourceFiles[src][type] = computed(() => {
      const list = src === 'local' ? mediaLocalFiles.value : networkFiles.value
      return list.filter((f) => f.type === type)
    })
  }
}

export function findItemById(k, src, type) {
  return findItemByIdRaw(k, sourceFiles, src, type)
}

export function buildList(src, type, folderVal, sortByVal, sortDirVal) {
  return buildListRaw(sourceFiles, src, type, folderVal, sortByVal, sortDirVal)
}

const shuffleOrderMap = {}

export const shuffleLists = {}
for (const src of MEDIA_SOURCES) {
  shuffleLists[src] = {}
  for (const type of MEDIA_TYPES) {
    shuffleLists[src][type] = computed(() => {
      const st = sourceStates[src][type]
      let list = sourceFiles[src][type].value
      const folderVal = st.folder.value
      if (folderVal !== 'all') {
        if (src === 'local')
          list = list.filter((f) => (f.path2 ? f.path1 + '/' + f.path2 : f.path1) === folderVal)
        else
          list = list.filter((f) => f.site === folderVal)
      }
      const fullKeys = list.map(itemId)
      const cacheKey = src + '-' + type + '|' + folderVal

      if (!shuffleOrderMap[cacheKey]) {
        shuffleOrderMap[cacheKey] = shuffleArray(fullKeys)
      }
      const order = shuffleOrderMap[cacheKey]
      const orderSet = new Set(order)
      const missing = fullKeys.filter((k) => !orderSet.has(k))
      const filtered = order.filter((k) => fullKeys.includes(k))
      if (missing.length > 0 || filtered.length !== order.length) {
        shuffleOrderMap[cacheKey] = shuffleArray([...filtered, ...missing])
      }
      const byKey = new Map(list.map((f) => [itemId(f), f]))
      return shuffleOrderMap[cacheKey].map((k) => byKey.get(k)).filter(Boolean)
    })
  }
}

export const displayLists = {}
for (const src of MEDIA_SOURCES) {
  displayLists[src] = {}
  for (const type of MEDIA_TYPES) {
    displayLists[src][type] = computed(() => {
      const st = sourceStates[src][type]
      return buildList(src, type, st.folder.value, st.sortBy.value, st.sortDir.value)
    })
  }
}

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
  const src = key.src
  const type = key.type
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