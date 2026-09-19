<script setup>
import { ref, computed, watch } from 'vue'
import UiWidget from '../ui/UiWidget.vue'
import UiRow from '../ui/UiRow.vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiCheck from '../ui/UiCheck.vue'
import UiText from '../ui/UiText.vue'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import UiFileInput from '../ui/UiFileInput.vue'
import { t } from '../js/useI18n'
import {
  followLight,
  followDark,
  followSystem,
  themeMode,
  urlInput,
  currWallpapers,
  wallpaperSource,
  mediaVisualSource,
} from '../js/usePersist'
import { mediaVisualItem } from '../js/useSourceState'
import { wpObjectUrls } from '../js/useThemeWallpaper'
import { mediaUrl } from '../utils/media'
import { newFileId, putFile } from '../js/useWallpaperFiles'


const DEFAULT_URLS = {
  light: 'https://res.wx.qq.com/t/webmail/webmail/res/static/images/content-bg.1x.d2fb96c.jpg',
  dark: 'https://res.wx.qq.com/t/webmail/webmail/res/static/images/content-bg-dark.1x.4541f7e.jpg'
}

let bingIdx = 0
const BING_MAX = 8

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
  return !!currWallpapers.value?.[other] || wallpaperSource.value?.[other] === 'bing'
})
const followingOther = computed(() => !!followOtherVal.value && hasOtherWallpaper.value)

const modeOptions = computed(() => [
  { value: 'light', label: t('lightMode') },
  { value: 'dark', label: t('darkMode') }
])
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
const displayName = computed(() => {
  const wpVal = currentWallpaper.value
  if (!wpVal) return ''
  return wpVal.name || ''
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

const urlInputValue = computed({
  get: () => urlInput.value[themeMode.value] || '',
  set: (v) => {
    const next = { ...urlInput.value }
    next[themeMode.value] = v
    urlInput.set(next)
  }
})

function setWallpaper(rec) {
  const side = themeMode.value
  if (sameRef(currWallpapers.value[side], rec)) return
  const next = { ...currWallpapers.value }
  next[side] = { ...rec, ts: Date.now() }
  currWallpapers.set(next)
}
function clearWallpaper() {
  const side = themeMode.value
  if (!currWallpapers.value[side]) return
  const next = { ...currWallpapers.value }
  next[side] = null
  currWallpapers.set(next)
  const nextSrc = { ...wallpaperSource.value }
  nextSrc[side] = null
  wallpaperSource.set(nextSrc)
}
function reuseOther() {
  const side = themeMode.value
  const other = anotherMode.value
  const wp = currWallpapers.value[other]
  if (!wp) return false
  if (sameRef(currWallpapers.value[side], wp)) return false
  const next = { ...currWallpapers.value }
  next[side] = { ...wp, ts: Date.now() }
  currWallpapers.set(next)
  followOtherVal.value = false
  const nextSrc = { ...wallpaperSource.value }
  nextSrc[side] = null
  wallpaperSource.set(nextSrc)
  mediaVisualSource.set(null)
  return true
}
function isVideoUrl(url) {
  if (!url) return false
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url) || /^data:video\//.test(url)
}
function uploadWallpaper(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('no file'))
    const isVideo = file.type.startsWith('video/')
    if (!file.type.startsWith('image/') && !isVideo) return reject(new Error('invalid type'))
    const fileId = newFileId()
    putFile(fileId, file).then(() => {
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
function applyUrl() {
  const url = (urlInputValue.value || '').trim() || DEFAULT_URLS[themeMode.value]
  if (!url) return
  applyUrlWallpaper(url)
    .then(() => { urlInputValue.value = '' })
    .catch(() => {})
}
function onFileSelected(file) {
  uploadWallpaper(file).catch(() => {})
}

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
  <UiWidget widget-id="tl" class="ui-widget-tl">
    <UiRow>
      <UiSwitch
        :options="modeOptions"
        showShortcut="D"
        v-model="themeMode"
      />
      <UiCheck id="wallpaper-follow-system" v-model="followSystem" :label="t('followSystem')" />
    </UiRow>

    <UiRow v-if="hasOtherWallpaper">
      <UiCheck id="wallpaper-follow-other" v-model="followOtherVal" :label="followOtherLabel" />
      <UiButton v-if="canReuse && !currentSource" :label="reuseLabel" @click="reuseOther()" />
    </UiRow>

    <UiRow v-if="!followingOther">
      <UiCheck id="wallpaper-source-bing" :model-value="currentSource === 'bing'" :label="t('followBingDaily')" @update:model-value="selectBing" />
      <UiButton v-if="currentSource !== 'bing'" :label="t('switchBingWeekly')" @click="randomBing" />
    </UiRow>

    <template v-if="!currentSource && !followingOther">
      <UiRow>
        <UiInput class="wp-url" id="wallpaper-url-input" v-model="urlInputValue" :placeholder="t('urlPlaceholder')" @enter="applyUrl" />
        <UiButton :label="t('apply')" @click="applyUrl" />
      </UiRow>

      <UiRow>
        <UiFileInput id="wallpaper-file-input" :label="t('uploadWallpaper')" showShortcut="O" @select="onFileSelected" />
        <UiButton v-if="canReuseVisual" :label="reuseVisualLabel" @click="reuseVisual()" />
      </UiRow>

      <UiRow v-if="currentWallpaper">
        <UiText class="wp-name" :title="displayName">{{ displayName }}</UiText>
        <UiButton label="✕" @click="clearWallpaper()" />
      </UiRow>
    </template>
  </UiWidget>
</template>

<style scoped>
.ui-widget-tl { top: 12px; left: 12px; }
.wp-url {
  width: 212px;
}
.wp-name {
  max-width: 212px;
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wp-name::-webkit-scrollbar {
  display: none;
}
</style>