import { ref, computed } from 'vue'
import {
  MEDIA_SOURCES, MEDIA_TYPES, sourceStates, networkFiles
} from './usePersist'
import {
  itemKey,
  findItemByKey as findItemByKeyRaw,
  buildList as buildListRaw,
  shuffleArray
} from '../utils/media'

export const mediaLocalFiles = ref([])

async function loadMediaIndex() {
  try {
    const res = await fetch(chrome.runtime.getURL('media-index.json'), { cache: 'no-store' })
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

export function findItemByKey(k, src, type) {
  return findItemByKeyRaw(k, sourceFiles, src, type)
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
      const fullKeys = list.map(itemKey)
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
      const byKey = new Map(list.map((f) => [itemKey(f), f]))
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