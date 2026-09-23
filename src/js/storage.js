// storage  —  localStorage 持久化 hook + IndexedDB 文件存储

import { ref, watch, nextTick } from 'vue'
import { t } from './i18n'
import { detectMediaType } from './mediaExts'

// ====== 常量 ======
const DB_ICONS = 'newtab-icons'
const DB_WALLPAPERS = 'newtab-wallpapers'
const STORE = 'files'
export const ALL_LS_KEYS = new Set()

// ====== DB 连接缓存 ======
const dbCache = new Map()

// ====== localStorage 底层 ======
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

// ====== 文件 ID ======
export function newFileId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ====== 导出辅助 ======
function stripFileRefs(data) {
  const out = { ...data }
  if (Array.isArray(out['shortcut-icons'])) {
    out['shortcut-icons'] = out['shortcut-icons'].map(ic => {
      const next = { ...ic }
      if (next.fileId) { next.fileId = null; next.iconUrl = '' }
      if (next.darkFileId) { next.darkFileId = null; next.darkIconUrl = '' }
      return next
    })
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

// ====== IndexedDB 壁纸/图标底层 ======
function _openDB(name, version = 1) {
  if (dbCache.has(name)) return dbCache.get(name)
  const p = new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  dbCache.set(name, p)
  return p
}

function _put(name, id, file) {
  return _openDB(name).then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(file, id)
    tx.oncomplete = () => resolve(id)
    tx.onerror = () => reject(tx.error)
  }))
}

function _get(name, id) {
  return _openDB(name).then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  }))
}

function _del(name, id) {
  return _openDB(name).then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  }))
}

function _listIds(name) {
  return _openDB(name).then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAllKeys()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  }))
}

// ====== IndexedDB 图标 ======
export function newIconFileId() { return newFileId() }
export function putIconFile(id, file) { return _put(DB_ICONS, id, file) }
export function getIconFile(id) { return _get(DB_ICONS, id) }
export function deleteIconFile(id) { return _del(DB_ICONS, id) }

// ====== IndexedDB 壁纸 ======
export function newWallpaperFileId() { return newFileId() }
export function putWallpaperFile(id, file) { return _put(DB_WALLPAPERS, id, file) }
export function getWallpaperFile(id) { return _get(DB_WALLPAPERS, id) }
export function deleteWallpaperFile(id) { return _del(DB_WALLPAPERS, id) }
export function listWallpaperFileIds() { return _listIds(DB_WALLPAPERS) }

// ====== IndexedDB 授权目录 ======
const DB_DIRS = 'new-tab-dirs'
const STORE_HANDLES = 'handles'
const STORE_FILES = 'files'

let _dirsDBCache = null
function _openDirsDB() {
  if (_dirsDBCache) return _dirsDBCache
  _dirsDBCache = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_DIRS, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_HANDLES)) db.createObjectStore(STORE_HANDLES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dirsDBCache
}
function _dirsTx(storeName, mode, fn) {
  return _openDirsDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const out = fn(tx.objectStore(storeName), tx)
    tx.oncomplete = () => resolve(out)
    tx.onerror = () => reject(tx.error)
  }))
}

export const dirHandles = ref([])
export const dirFiles = ref({})

export async function initDirStore() {
  let handles = []
  let filesMap = {}
  try {
    const db = await _openDirsDB()
    handles = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_HANDLES, 'readonly')
      const req = tx.objectStore(STORE_HANDLES).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
    const files = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly')
      const req = tx.objectStore(STORE_FILES).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
    for (const f of files) {
      if (!filesMap[f.dirId]) filesMap[f.dirId] = []
      filesMap[f.dirId].push(f)
    }
  } catch {}
  dirHandles.value = handles.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
  dirFiles.value = filesMap
  return { handles, filesMap }
}

export async function refreshDirValidity() {
  const db = await _openDirsDB()
  const next = [...dirHandles.value]
  for (const entry of next) {
    try {
      await entry.handle.getFileHandle('.')
      entry.valid = true
    } catch {
      entry.valid = false
    }
  }
  try {
    const tx = db.transaction(STORE_HANDLES, 'readwrite')
    const store = tx.objectStore(STORE_HANDLES)
    for (const entry of next) store.put(entry)
  } catch {}
  dirHandles.value = next
}

export async function addDirHandle(handle) {
  const id = crypto.randomUUID()
  const entry = { id, name: handle.name, handle, valid: true, addedAt: Date.now() }
  await _dirsTx(STORE_HANDLES, 'readwrite', (store) => store.put(entry))
  dirHandles.value = [...dirHandles.value, entry].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
  await scanDir(id)
  return id
}

export async function removeDirHandle(id) {
  await _dirsTx(STORE_HANDLES, 'readwrite', (store) => store.delete(id))
  await _dirsTx(STORE_FILES, 'readwrite', (store) => {
    store.openCursor().onsuccess = (e) => {
      const cur = e.target.result
      if (!cur) return
      if (cur.value?.dirId === id) cur.delete()
      cur.continue()
    }
  })
  dirHandles.value = dirHandles.value.filter((h) => h.id !== id)
  const next = { ...dirFiles.value }
  delete next[id]
  dirFiles.value = next
}

async function _scanSubDir(rootHandle, dirHandle, path2, dirName) {
  const results = []
  for await (const [name, h] of dirHandle.entries()) {
    if (h.kind === 'file') {
      const ft = detectMediaType(name)
      if (!ft) continue
      let mtime = 0
      try { const f = await h.getFile(); mtime = f.lastModified } catch {}
      results.push({ dirId: dirName, path1: rootHandle.name, path2, filename: name, mtime, type: ft })
    } else if (h.kind === 'directory' && path2 === '') {
      results.push(...(await _scanSubDir(rootHandle, h, name, dirName)))
    }
  }
  return results
}

export async function scanDir(id) {
  const entry = dirHandles.value.find((h) => h.id === id)
  if (!entry) return
  const files = await _scanSubDir(entry.handle, entry.handle, '', id)
  try {
    await _dirsTx(STORE_FILES, 'readwrite', (store) => {
      store.openCursor().onsuccess = (e) => {
        const cur = e.target.result
        if (!cur) return
        if (cur.value?.dirId === id) cur.delete()
        cur.continue()
      }
    })
    await _dirsTx(STORE_FILES, 'readwrite', (store) => {
      for (const f of files) store.put(f, [f.dirId, f.path2, f.filename])
    })
  } catch {}
  const next = { ...dirFiles.value, [id]: files }
  dirFiles.value = next
}

export async function scanAllDirs() {
  for (const h of dirHandles.value) {
    if (h.valid) {
      try { await scanDir(h.id) } catch {}
    }
  }
}

export async function requestDirPermission(id) {
  const entry = dirHandles.value.find((h) => h.id === id)
  if (!entry) return false
  try {
    if (typeof entry.handle.requestPermission === 'function') {
      const res = await entry.handle.requestPermission({ mode: 'read' })
      if (res !== 'granted') return false
    }
    entry.valid = true
    await _dirsTx(STORE_HANDLES, 'readwrite', (store) => store.put(entry))
    dirHandles.value = [...dirHandles.value]
    await scanDir(id)
    return true
  } catch {
    return false
  }
}

export async function resolveDirFile(item) {
  if (!item?.dirId) return null
  const entry = dirHandles.value.find((h) => h.id === item.dirId)
  if (!entry?.handle) return null
  try {
    let targetHandle = entry.handle
    if (item.path2) {
      const sub = await entry.handle.getDirectoryHandle(item.path2, { create: false })
      targetHandle = sub
    }
    const fileHandle = await targetHandle.getFileHandle(item.filename, { create: false })
    return await fileHandle.getFile()
  } catch {
    return null
  }
}

// ====== useStorage ======
export function useStorage(key, defaultValue, sanitize, options = {}) {
  ALL_LS_KEYS.add(key)
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
  }, { deep: true, flush: 'sync' })

  function load() {
    loaded.value = true
    if (!canRead()) return
    let stored
    let hasData = false
    try { stored = lsGet(key); hasData = stored !== undefined } catch {}
    if (hasData && !setBeforeLoad) {
      exists.value = true
      saving = true
      value.value = sanitize ? sanitize(stored) : stored
      nextTick(() => { saving = false })
    }
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

  load()
  value.loaded = loaded
  value.set = set
  value.remove = remove
  value.exists = exists
  return value
}

// ====== 重置设置 ======
export function resetAllSettings() {
  if (!confirm(t('confirmReset'))) return
  try { indexedDB.deleteDatabase(DB_ICONS) } catch (e) {}
  try { indexedDB.deleteDatabase(DB_WALLPAPERS) } catch (e) {}
  lsClear()
  try { browser.storage.local.clear() } catch (e) {}
  location.reload()
}

// ====== 导出前检查 ======
async function countDBEntries(dbName) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(dbName)
      req.onsuccess = () => {
        const db = req.result
        const names = db.objectStoreNames
        if (!names || names.length === 0) { resolve(0); return }
        let total = 0, done = 0
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
    countDBEntries(DB_ICONS), countDBEntries(DB_WALLPAPERS),
  ])
  return icons > 0 || wallpapers > 0
}

// ====== 导出 ======
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
    for (const [k, v] of Object.entries(old)) if (!(k in data)) data[k] = v
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

// ====== 导入 ======
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
      try { indexedDB.deleteDatabase(DB_ICONS) } catch (e) {}
      try { indexedDB.deleteDatabase(DB_WALLPAPERS) } catch (e) {}
      lsClear()
      try { await browser.storage.local.clear() } catch (e) {}
      for (const [k, v] of Object.entries(data)) {
        if (k === '__nt_export') continue
        lsSet(k, v)
      }
      alert(t('importDone'))
      location.reload()
    } catch (e) { alert(t('importFailed')) }
  }
  input.click()
}