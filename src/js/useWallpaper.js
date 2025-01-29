import { computed, ref, watch } from 'vue'
import { followLight, followDark, currWallpapers } from './usePersist'
import { themeMode } from './useTheme'
import { getFile } from './useWallpaperFiles'

export const wpObjectUrls = ref({})
export const wpMediaInfo = ref({ w: 0, h: 0 })

watch(
  currWallpapers.loaded,
  (loaded) => {
    if (!loaded) return
    const ids = new Set()
    for (const slot of ['light', 'dark']) {
      const wp = currWallpapers.value?.[slot]
      if (wp?.kind === 'file' && wp.fileId) ids.add(wp.fileId)
    }
    if (!ids.size) return
    Promise.all([...ids].map(async (id) => {
      const file = await getFile(id)
      if (file) return [id, URL.createObjectURL(file)]
      return null
    })).then((pairs) => {
      const next = { ...wpObjectUrls.value }
      for (const p of pairs) if (p) next[p[0]] = p[1]
      wpObjectUrls.value = next
    })
  },
  { immediate: true }
)

export function resolveWpSlot(side) {
  return side === 'dark'
    ? (followLight.value ? 'light' : 'dark')
    : (followDark.value ? 'dark' : 'light')
}

export function withWpSrc(rec) {
  if (!rec) return null
  const url = rec.kind === 'file' ? wpObjectUrls.value[rec.fileId] : rec.url
  return url ? { ...rec, url } : null
}

export const wpDisplayTheme = computed(() => resolveWpSlot(themeMode.value))

export const currentWallpaper = computed(() => {
  const rec = currWallpapers.value[wpDisplayTheme.value]
  if (!rec) return null
  const url = rec.kind === 'file' ? wpObjectUrls.value[rec.fileId] : rec.url
  return url ? { ...rec, url } : null
})

export function wpVideoKey() {
  const c = currentWallpaper.value
  if (!c) return ''
  return c.kind === 'file' ? 'f-' + c.fileId : 'u-' + c.url
}