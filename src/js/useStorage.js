import { ref, watch } from 'vue'

const isExtension = typeof chrome !== 'undefined' && !!chrome.storage?.local

export function useStorage(key, defaultValue, sanitize, options = {}) {
  const { shouldPersist } = options
  const value = ref(defaultValue)
  const loaded = ref(false)
  let saveQueue = Promise.resolve()
  let setBeforeLoad = false

  const persistEnabled = typeof shouldPersist === 'function'
    ? shouldPersist
    : () => !shouldPersist || shouldPersist.value

  let saving = false
  watch(value, () => {
    if (saving) return
    if (!loaded.value) setBeforeLoad = true
    if (!persistEnabled()) return
    save()
  })

  async function load() {
    try {
      let raw = localStorage.getItem(key)
      if (raw === null && isExtension) {
        const result = await chrome.storage.local.get(key)
        if (result[key] !== undefined) raw = JSON.stringify(result[key])
      }
      if (raw !== null && !setBeforeLoad) {
        const parsed = JSON.parse(raw)
        saving = true
        value.value = sanitize ? sanitize(parsed) : parsed
        saving = false
      }
    } catch (e) {
    }
    loaded.value = true
    if (shouldPersist) {
      if (persistEnabled()) save()
      else remove()
    }
  }

  function save() {
    if (!persistEnabled()) return false
    const payload = JSON.stringify(value.value)
    try { localStorage.setItem(key, payload) } catch (e) {}
    if (isExtension) {
      saveQueue = saveQueue.then(() => chrome.storage.local.set({ [key]: value.value })).catch(() => {})
      return saveQueue
    }
    return true
  }

  function remove() {
    try { localStorage.removeItem(key) } catch (e) {}
    if (isExtension) {
      saveQueue = saveQueue.then(() => chrome.storage.local.remove(key)).catch(() => {})
      return saveQueue
    }
    return true
  }

  function set(newValue) {
    if (!loaded.value) setBeforeLoad = true
    saving = true
    value.value = newValue
    saving = false
    return save()
  }

  if (shouldPersist) {
    watch(persistEnabled, (on) => {
      if (on) save()
      else remove()
    })
  }

  load()

  value.set = set
  value.loaded = loaded
  return value
}

export { isExtension }

export function resetAllSettings() {
  try {
    localStorage.clear()
  } catch (e) {}
  if (isExtension) {
    try { chrome.storage.local.clear() } catch (e) {}
  }
  location.reload()
}