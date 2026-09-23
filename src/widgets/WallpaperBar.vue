<script setup>
import { ref, computed, watch } from 'vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiCheck from '../ui/UiCheck.vue'
import UiText from '../ui/UiText.vue'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import UiFileInput from '../ui/UiFileInput.vue'
import { t } from '../js/i18n'
import { videoUrlRegex } from '../js/mediaExts'
import {
  followLight,
  followDark,
  followSystem,
  themeMode,
  currWallpapers,
  currBackgroundColors,
  wallpaperSource,
  mediaVisualSource,
} from '../js/persist'
import { mediaVisualItem, wpObjectUrls, mediaUrl } from '../js/core'
import { newWallpaperFileId, putWallpaperFile } from '../js/storage'

// ====== 常量与校验 ======
const DEFAULT_URLS = {
  light: 'https://res.wx.qq.com/t/webmail/webmail/res/static/images/content-bg.1x.d2fb96c.jpg',
  dark: 'https://res.wx.qq.com/t/webmail/webmail/res/static/images/content-bg-dark.1x.4541f7e.jpg'
}

let bingIdx = 0
const BING_MAX = 8

function isValidColor(val) {
  if (!val) return false
  if (/^https?:\/\//i.test(val)) return false
  if (/^data:/i.test(val)) return false
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(val)) return true
  if (/^(rgb|hsl|lab|lch|oklab|oklch)a?\s*\(/i.test(val)) return true
  if (/^[a-z]+$/i.test(val) && CSS.supports('color', val)) return true
  return false
}
function isValidUrl(val) {
  return /^https?:\/\//i.test(val) || /^data:/i.test(val)
}

// ====== 主题与跟随模式 ======
const anotherMode = computed(() => themeMode.value === 'light' ? 'dark' : 'light')

const followOtherVal = computed({
  get: () => themeMode.value === 'light' ? followLight.value : followDark.value,
  set: (v) => {
    if (themeMode.value === 'light') { followLight.set(!!v); if (v) followDark.set(false) }
    else { followDark.set(!!v); if (v) followLight.set(false) }
    if (v) mediaVisualSource.set(null)
  }
})

const hasOtherWallpaper = computed(() => {
  const other = anotherMode.value
  return !!currWallpapers.value?.[other] || !!currBackgroundColors.value?.[other] || wallpaperSource.value?.[other] === 'bing'
})
const followingOther = computed(() => !!followOtherVal.value && hasOtherWallpaper.value)

const modeOptions = computed(() => {
  const l = followSystem.value ? t('dialogLightStyle') : t('lightMode')
  const d = followSystem.value ? t('dialogDarkStyle') : t('darkMode')
  return [
    { value: 'light', label: l },
    { value: 'dark', label: d }
  ]
})
const followOtherLabel = computed(() =>
  themeMode.value === 'light' ? t('followDarkWallpaper') : t('followLightWallpaper')
)
const reuseLabel = computed(() =>
  themeMode.value === 'light' ? t('reuseDarkWallpaper') : t('reuseLightWallpaper')
)
const canReuse = computed(() => !followOtherVal.value && hasOtherWallpaper.value)
const currentSource = computed(() => wallpaperSource.value?.[themeMode.value] || null)

function withSrc(rec) {
  if (!rec) return null
  const url = rec.kind === 'file' ? wpObjectUrls.value[rec.fileId] : rec.url
  return url ? { ...rec, url } : null
}
function sameRef(a, b) {
  if (!a || !b) return false
  if (a.kind === 'file' && b.kind === 'file') return !!a.fileId && a.fileId === b.fileId
  if ((a.kind === 'url' || a.kind === 'local') && (b.kind === 'url' || b.kind === 'local')) return a.url === b.url
  return false
}
const currentWallpaper = computed(() => withSrc(currWallpapers.value[themeMode.value]))
const currentBgColor = computed(() => {
  const side = themeMode.value
  if (currWallpapers.value[side]) return null
  return currBackgroundColors.value[side] || null
})
const displayName = computed(() => {
  const wpVal = currentWallpaper.value
  if (wpVal) return wpVal.name || ''
  if (currentBgColor.value) return currentBgColor.value
  return ''
})

const canReuseVisual = computed(() => {
  const item = mediaVisualItem.value
  if (!item) return false
  if (item.type !== 'image' && item.type !== 'video') return false
  const url = mediaUrl(item)
  const wpUrl = currentWallpaper.value?.url
  return !wpUrl || wpUrl !== url
})
const reuseVisualLabel = computed(() => {
  const item = mediaVisualItem.value
  if (!item) return ''
  return item.type === 'image' ? t('reuseCurrentImage') : t('reuseCurrentVideo')
})
function reuseVisual() {
  const item = mediaVisualItem.value
  if (!item) return
  const url = mediaUrl(item)
  if (!url) return
  setWallpaper({ kind: 'url', url, name: item.filename || item.pathname || t('unnamed'), isVideo: item.type === 'video' })
  followOtherVal.value = false
  mediaVisualSource.set(null)
}

const urlInput = ref({ light: "", dark: "" });
const urlInputValue = computed({
  get: () => urlInput.value[themeMode.value] || '',
  set: (v) => {
    const next = { ...urlInput.value }
    next[themeMode.value] = v
    urlInput.value = next
  }
})

// ====== 壁纸操作 ======
function setWallpaper(rec) {
  const side = themeMode.value
  if (sameRef(currWallpapers.value[side], rec)) return
  const next = { ...currWallpapers.value }
  next[side] = { ...rec, ts: Date.now() }
  currWallpapers.set(next)
  const nextBg = { ...currBackgroundColors.value }
  nextBg[side] = null
  currBackgroundColors.set(nextBg)
}
function setBackgroundColor(color) {
  const side = themeMode.value
  if (currBackgroundColors.value[side] === color) return
  const next = { ...currBackgroundColors.value }
  next[side] = color
  currBackgroundColors.set(next)
  const nextWp = { ...currWallpapers.value }
  nextWp[side] = null
  currWallpapers.set(nextWp)
  const nextSrc = { ...wallpaperSource.value }
  nextSrc[side] = null
  wallpaperSource.set(nextSrc)
}
function clearWallpaper() {
  const side = themeMode.value
  if (!currWallpapers.value[side] && !currBackgroundColors.value[side]) return
  const next = { ...currWallpapers.value }
  next[side] = null
  currWallpapers.set(next)
  const nextBg = { ...currBackgroundColors.value }
  nextBg[side] = null
  currBackgroundColors.set(nextBg)
  const nextSrc = { ...wallpaperSource.value }
  nextSrc[side] = null
  wallpaperSource.set(nextSrc)
}
function reuseOther() {
  const side = themeMode.value
  const other = anotherMode.value
  const wp = currWallpapers.value[other]
  const bg = currBackgroundColors.value[other]
  if (wp) {
    if (sameRef(currWallpapers.value[side], wp)) return false
    const next = { ...currWallpapers.value }
    next[side] = { ...wp, ts: Date.now() }
    currWallpapers.set(next)
    const nextBg = { ...currBackgroundColors.value }
    nextBg[side] = null
    currBackgroundColors.set(nextBg)
  } else if (bg) {
    if (currBackgroundColors.value[side] === bg) return false
    const next = { ...currBackgroundColors.value }
    next[side] = bg
    currBackgroundColors.set(next)
    const nextWp = { ...currWallpapers.value }
    nextWp[side] = null
    currWallpapers.set(nextWp)
  } else {
    return false
  }
  followOtherVal.value = false
  const nextSrc = { ...wallpaperSource.value }
  nextSrc[side] = null
  wallpaperSource.set(nextSrc)
  mediaVisualSource.set(null)
  return true
}
function isVideoUrl(url) {
  if (!url) return false
  return videoUrlRegex().test(url) || /^data:video\//.test(url)
}
function uploadWallpaper(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('no file'))
    const isVideo = file.type.startsWith('video/')
    if (!file.type.startsWith('image/') && !isVideo) return reject(new Error('invalid type'))
    const fileId = newWallpaperFileId()
    putWallpaperFile(fileId, file).then(() => {
      wpObjectUrls.value = { ...wpObjectUrls.value, [fileId]: URL.createObjectURL(file) }
      setWallpaper({ kind: 'file', fileId, name: file.name || t('unnamedFile'), isVideo })
      followOtherVal.value = false
      mediaVisualSource.set(null)
      resolve()
    }).catch(reject)
  })
}
function applyUrlWallpaper(url) {
  return new Promise((resolve, reject) => {
    if (!url || !/^https?:\/\//i.test(url)) return reject(new Error('invalid url'))
    const isVideo = isVideoUrl(url)
    const probe = isVideo ? document.createElement('video') : new Image()
    const done = (ok) => {
      if (!ok) return reject(new Error('load failed'))
      const name = url.split('/').pop().split('?')[0] || t('unnamedFile')
      setWallpaper({ kind: 'url', url, name, isVideo })
      followOtherVal.value = false
      mediaVisualSource.set(null)
      resolve()
    }
    if (isVideo) { probe.preload = 'metadata'; probe.onloadedmetadata = () => done(true); probe.onerror = () => done(false) }
    else { probe.onload = () => done(true); probe.onerror = () => done(false) }
    probe.src = url
    setTimeout(() => done(false), 15000)
  })
}
function applyInput() {
  let raw = (urlInputValue.value || '').trim()
  if (!raw) raw = DEFAULT_URLS[themeMode.value]
  if (isValidColor(raw)) {
    setBackgroundColor(raw)
    return
  }
  applyUrlWallpaper(raw).catch(() => {})
}

const applyRaw = computed(() => (urlInputValue.value || '').trim())
const applyDisabled = computed(() => {
  const raw = applyRaw.value
  const side = themeMode.value
  const wp = currentWallpaper.value
  const bg = currentBgColor.value
  if (!raw) {
    if (wp || bg) return true
    return false
  }
  if (isValidColor(raw)) {
    if (bg && raw.toLowerCase() === bg.toLowerCase()) return true
  } else if (isValidUrl(raw)) {
    if (wp?.url === raw) return true
  }
  return false
})
const applyFlash = computed(() => !applyDisabled.value && applyRaw.value !== '')
function onFileSelected(file) {
  uploadWallpaper(file).catch(() => {})
}

// ====== Bing 每日壁纸 ======
async function fetchBingWallpaper(idx = 0) {
  try {
    const resp = await fetch(`https://www.bing.com/HPImageArchive.aspx?format=js&idx=${idx}&n=1&mkt=zh-CN`)
    if (!resp.ok) throw new Error('bing http ' + resp.status)
    const data = await resp.json()
    const url = data?.images?.[0]?.url
    if (!url) throw new Error('bing no url')
    const fullUrl = `https://www.bing.com${url}`
    let name = 'Bing'
    const idMatch = url.match(/[?&]id=([^&]+)/)
    if (idMatch) name = idMatch[1]
    else {
      const last = url.split('/').pop()
      name = last.split('?')[0] || 'Bing'
    }
    return { url: fullUrl, name }
  } catch (e) { console.warn('[wallpaper] bing failed', e); return null }
}

async function applyBingWallpaper(idx = 0) {
  const res = await fetchBingWallpaper(idx)
  if (!res) return
  setWallpaper({ kind: 'url', url: res.url, name: res.name, isVideo: false })
  mediaVisualSource.set(null)
}

async function applyBingToSlot(slot, idx = 0) {
  const res = await fetchBingWallpaper(idx)
  if (!res) return
  const next = { ...currWallpapers.value }
  next[slot] = { kind: 'url', url: res.url, name: res.name, isVideo: false, ts: Date.now() }
  currWallpapers.set(next)
}

async function enableBingSource() {
  const side = themeMode.value
  const nextSrc = { ...wallpaperSource.value }
  nextSrc[side] = 'bing'
  wallpaperSource.set(nextSrc)
}

function selectBing(on) {
  const side = themeMode.value
  const nextSrc = { ...wallpaperSource.value }
  nextSrc[side] = on ? 'bing' : null
  wallpaperSource.set(nextSrc)
  if (on) { bingIdx = 0; mediaVisualSource.set(null) }
}

function randomBing() {
  bingIdx = (bingIdx + 1) % BING_MAX
  applyBingWallpaper(bingIdx)
}

async function ensureBingSlotsLoaded() {
  const src = wallpaperSource.value
  if (!src) return
  for (const slot of ['light', 'dark']) {
    if (src[slot] !== 'bing') continue
    const cur = currWallpapers.value?.[slot]
    const remote = await fetchBingWallpaper(0)
    if (!remote) continue
    if (cur && cur.url === remote.url) continue
    const next = { ...currWallpapers.value }
    next[slot] = { kind: 'url', url: remote.url, name: remote.name, isVideo: false, ts: Date.now() }
    currWallpapers.set(next)
  }
}

watch(themeMode, (newMode) => {
  const next = { ...urlInput.value }
  next[newMode] = ''
  urlInput.value = next
}, { flush: 'post' })

watch(
  () => [
    wallpaperSource.loaded.value, currWallpapers.loaded.value,
    wallpaperSource.value?.light, wallpaperSource.value?.dark,
    followDark.value, followLight.value,
    themeMode.value,
  ],
  () => {
    ensureBingSlotsLoaded()
  },
  { immediate: true }
)

watch(
  () => [followLight.loaded.value, followDark.loaded.value],
  ([a, b]) => { if (a && b && followLight.value && followDark.value) followDark.set(false) },
  { immediate: true }
)
</script>

<template>
  <div class="ui-widget" data-widget-id="tl">
    <div class="ui-row">
      <UiSwitch
        :options="modeOptions"
        showShortcut="D"
        cycle
        v-model="themeMode"
      />
      <UiCheck id="wallpaper-follow-system" v-model="followSystem" :label="t('followSystem')" />
    </div>

    <div class="ui-row" v-if="hasOtherWallpaper">
      <UiCheck id="wallpaper-follow-other" v-model="followOtherVal" :label="followOtherLabel" />
      <UiButton v-if="canReuse && !currentSource" :label="reuseLabel" @click="reuseOther()" />
    </div>

    <div class="ui-row" v-if="!followingOther">
      <UiCheck id="wallpaper-source-bing" :model-value="currentSource === 'bing'" :label="t('followBingDaily')" @update:model-value="selectBing" />
      <UiButton v-if="currentSource !== 'bing'" :label="t('switchBingWeekly')" @click="randomBing" />
    </div>

    <template v-if="!currentSource && !followingOther">
      <div class="ui-row">
        <UiInput class="wp-url" id="wallpaper-url-input" v-model="urlInputValue" :placeholder="t('urlPlaceholder')" @enter="applyInput" />
        <UiButton :label="t('apply')" :disabled="applyDisabled" :class="{ 'ui-button--flash': applyFlash }" @click="applyInput" />
      </div>

      <div class="ui-row">
        <UiFileInput id="wallpaper-file-input" :label="t('uploadWallpaper')" showShortcut="O" @select="onFileSelected" />
        <UiButton v-if="canReuseVisual" :label="reuseVisualLabel" @click="reuseVisual()" />
      </div>

      <div class="ui-row" v-if="currentWallpaper || currentBgColor">
        <UiText class="wp-name" :title="displayName">{{ displayName }}</UiText>
        <UiButton label="✕" @click="clearWallpaper()" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.wp-url {
  width: 240px;
}
.wp-name {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wp-name::-webkit-scrollbar {
  display: none;
}
</style>