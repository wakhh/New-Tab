import { ref, watch, nextTick } from 'vue'
import { t } from './useI18n'

function lsGet(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch { return undefined }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}
function lsRemove(key) {
  try { localStorage.removeItem(key) } catch {}
}
function lsClear() {
  try { localStorage.clear() } catch {}
}

export function useStorage(key, defaultValue, sanitize, options = {}) {
  const { shouldRead = true, shouldWrite = true, preSave } = options
  const canRead = typeof shouldRead === 'function' ? shouldRead : () => shouldRead
  const canWrite = typeof shouldWrite === 'function' ? shouldWrite : () => shouldWrite
  const value = ref(defaultValue)
  const loaded = ref(false)
  const exists = ref(false)
  let setBeforeLoad = false

  let saving = false
  watch(value, () => {
    if (saving) return
    if (!loaded.value) setBeforeLoad = true
    exists.value = true
    if (!canWrite()) return
    save()
  }, { deep: true })

  function load() {
    loaded.value = true
    if (!canRead()) return
    let stored
    let hasData = false
    try {
      stored = lsGet(key)
      hasData = stored !== undefined
    } catch (e) {}
    if (hasData && !setBeforeLoad) {
      exists.value = true
      saving = true
      value.value = sanitize ? sanitize(stored) : stored
      nextTick(() => { saving = false })
    }
    if (!canWrite()) remove()
  }

  function save() {
    if (!canWrite()) return false
    exists.value = true
    let toSave = preSave ? preSave(value.value) : value.value
    lsSet(key, toSave)
    return true
  }

  function remove() {
    exists.value = false
    lsRemove(key)
    return true
  }

  function set(newValue) {
    if (!loaded.value) setBeforeLoad = true
    saving = true
    value.value = newValue
    nextTick(() => { saving = false })
    exists.value = true
    return save()
  }

  if (typeof shouldWrite === 'function') {
    watch(canWrite, (on) => {
      if (!on) remove()
    })
  }

  load()

  value.set = set
  value.loaded = loaded
  value.exists = exists
  return value
}

const ALL_LS_KEYS = [
  'shortcut-icons', 'shortcut-folders',
  'wp-display-mode-video', 'wp-display-mode-image', 'wp-displayOptimize',
  'wp-desktop-align-video', 'wp-desktop-align-image',
  'wp-desktop-anchor-video', 'wp-desktop-anchor-image',
  'wp-video-loop', 'settings-open', 'wp-curr-wallpapers',
  'wp-follow-light', 'wp-follow-dark', 'wp-url-input',
  'theme-follow-system', 'wp-wallpaper-source', 'theme-mode',
  'wp-video-volume', 'wp-video-muted',
  'media-video-volume', 'media-video-muted',
  'media-music-volume', 'media-music-muted',
  'play-video-paused', 'play-music-paused',
  'play-video-progress', 'play-music-progress',
  'media-folder-local-image', 'media-sortby-local-image', 'media-sortdir-local-image',
  'media-selected-local-image', 'media-playmode-local-image', 'media-direction-local-image',
  'media-folder-local-music', 'media-sortby-local-music', 'media-sortdir-local-music',
  'media-selected-local-music', 'media-playmode-local-music', 'media-direction-local-music',
  'media-folder-local-video', 'media-sortby-local-video', 'media-sortdir-local-video',
  'media-selected-local-video', 'media-playmode-local-video', 'media-direction-local-video',
  'media-folder-network-image', 'media-sortby-network-image', 'media-sortdir-network-image',
  'media-selected-network-image', 'media-playmode-network-image', 'media-direction-network-image',
  'media-folder-network-music', 'media-sortby-network-music', 'media-sortdir-network-music',
  'media-selected-network-music', 'media-playmode-network-music', 'media-direction-network-music',
  'media-folder-network-video', 'media-sortby-network-video', 'media-sortdir-network-video',
  'media-selected-network-video', 'media-playmode-network-video', 'media-direction-network-video',
  'media-network-files', 'media-source-selected', 'media-visual-source',
  'media-music-source', 'media-img-duration', 'media-list-width',
  'auto-hide', 'portrait-widget', 'desktop-mode', 'icon-scale', 'lang-pref',
]

export function resetAllSettings() {
  if (!confirm(t('confirmReset'))) return
  try { indexedDB.deleteDatabase('newtab-icons') } catch (e) {}
  try { indexedDB.deleteDatabase('newtab-wallpapers') } catch (e) {}
  lsClear()
  try { browser.storage.local.clear() } catch (e) {}
  location.reload()
}

async function countDBEntries(dbName) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(dbName)
      req.onsuccess = () => {
        const db = req.result
        const names = db.objectStoreNames
        if (!names || names.length === 0) { resolve(0); return }
        let total = 0
        let done = 0
        for (const store of names) {
          const tx = db.transaction(store, 'readonly')
          const r = tx.objectStore(store).getAllKeys()
          r.onsuccess = () => { total += (r.result?.length || 0) }
          tx.oncomplete = () => { done++; if (done === names.length) resolve(total) }
          tx.onerror = () => { done++; if (done === names.length) resolve(total) }
        }
      }
      req.onerror = () => resolve(0)
    } catch (e) { resolve(0) }
  })
}

async function hasUploadedFiles() {
  const [icons, wallpapers] = await Promise.all([
    countDBEntries('newtab-icons'),
    countDBEntries('newtab-wallpapers'),
  ])
  return icons > 0 || wallpapers > 0
}

function stripFileRefs(data) {
  const out = { ...data }
  for (const key of ['shortcut-icons']) {
    if (Array.isArray(out[key])) {
      out[key] = out[key].map(ic => {
        const next = { ...ic }
        if (next.fileId) { next.fileId = null; next.iconUrl = '' }
        if (next.darkFileId) { next.darkFileId = null; next.darkIconUrl = '' }
        return next
      })
    }
  }
  if (out['wp-curr-wallpapers'] && typeof out['wp-curr-wallpapers'] === 'object') {
    const wp = { ...out['wp-curr-wallpapers'] }
    for (const slot of ['light', 'dark']) {
      if (wp[slot]?.kind === 'file') wp[slot] = null
    }
    out['wp-curr-wallpapers'] = wp
  }
  return out
}

export async function exportSettings() {
  if (await hasUploadedFiles()) {
    if (!confirm(t('confirmExportNoFiles'))) return
  }
  const data = {}
  for (const key of ALL_LS_KEYS) {
    const v = lsGet(key)
    if (v !== undefined) data[key] = v
  }
  try {
    const old = await browser.storage.local.get(null)
    for (const [k, v] of Object.entries(old)) {
      if (!(k in data)) data[k] = v
    }
  } catch (e) {}
  const clean = stripFileRefs(data)
  clean.__nt_export = 'new-tab-ext'
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  a.download = `newtab-settings-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function importSettings() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data || typeof data !== 'object') { alert(t('importFailed')); return }
      if (data.__nt_export !== 'new-tab-ext') { alert(t('importInvalid')); return }
      try { indexedDB.deleteDatabase('newtab-icons') } catch (e) {}
      try { indexedDB.deleteDatabase('newtab-wallpapers') } catch (e) {}
      lsClear()
      try { await browser.storage.local.clear() } catch (e) {}
      for (const [k, v] of Object.entries(data)) {
        if (k === '__nt_export') continue
        lsSet(k, v)
      }
      alert(t('importDone'))
      location.reload()
    } catch (e) {
      alert(t('importFailed'))
    }
  }
  input.click()
}