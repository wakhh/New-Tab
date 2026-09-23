<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiCheck from '../ui/UiCheck.vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiText from '../ui/UiText.vue'
import UiNumber from '../ui/UiNumber.vue'
import { resetAllSettings, exportSettings, importSettings } from '../js/storage'
import { settingsOpen, _settingsSkipPersist, autoHide, portraitWidget, shortcutIcons, shortcutFolders, desktopMode, iconScale, langPref, IS_POPUP } from '../js/persist'
import { isPortrait, edgeTR, hoveredWidget, widgetActive, mouseInViewport } from '../js/core'
import { t, isBrowserZh, resolveLang } from '../js/i18n'
import { DEFAULT_ICONS_ZH, DEFAULT_FOLDERS_ZH } from '../js/zh_desktop'
import { DEFAULT_ICONS_EN, DEFAULT_FOLDERS_EN } from '../js/en_desktop'

// ====== 工具函数 ======
function isEmptyList(v) {
  return !v || (Array.isArray(v) && v.length === 0)
}

const BUILTIN_ADD_ID = '__builtin_add__'
function hasRealIcons(v) {
  if (!Array.isArray(v)) return false
  return v.some(i => i && i.id !== BUILTIN_ADD_ID && i.type !== 'builtin')
}

const desktopEmpty = computed(() => !hasRealIcons(shortcutIcons.value) && isEmptyList(shortcutFolders.value))

function addDefaultIcons() {
  if (!desktopEmpty.value) return
  const useZh = resolveLang(langPref.value) === 'zh'
  const DEFAULT_ICONS = useZh ? DEFAULT_ICONS_ZH : DEFAULT_ICONS_EN
  const DEFAULT_FOLDERS = useZh ? DEFAULT_FOLDERS_ZH : DEFAULT_FOLDERS_EN
  const GRID_ROWS = 11, GRID_COLS = 25
  const occupied = new Set((Array.isArray(DEFAULT_ICONS) ? DEFAULT_ICONS : []).map(i => `${i.row},${i.col}`))
  let lastPos = { row: 0, col: GRID_COLS }
  for (let c = GRID_COLS - 1; c >= 0; c--) {
    for (let r = GRID_ROWS - 1; r >= 0; r--) {
      if (!occupied.has(`${r},${c}`)) { lastPos = { row: r, col: c }; break }
    }
    if (lastPos.col < GRID_COLS) break
  }
  const list = (Array.isArray(DEFAULT_ICONS) ? DEFAULT_ICONS : [])
  list.push({ id: '__builtin_add__', name: '', type: 'builtin', fileId: null, iconUrl: '', darkFileId: null, darkIconUrl: '', url: '', search: false, row: lastPos.row, col: lastPos.col })
  shortcutIcons.set(list)
  shortcutFolders.set(Array.isArray(DEFAULT_FOLDERS) ? DEFAULT_FOLDERS : [])
  settingsOpen.set(false)
}

// ====== 图标缩放交互 ======
const scaleActive = ref(false)
let scaleFocusTimer = null
let scaleCloseRaf = null
let scaleTriedEdit = false
let scaleHovered = false
let scaleFocused = false
let scaleLeaveTimer = null
const SCALE_FOCUS_DELAY = 350
const SCALE_LEAVE_DELAY = 100

function syncScaleActive() {
  const want = scaleHovered || scaleFocused
  if (want === scaleActive.value) return
  if (want) {
    _settingsSkipPersist.value = true
    settingsOpen.value = false
    _settingsSkipPersist.value = false
  } else {
    if (!scaleTriedEdit) {
      _settingsSkipPersist.value = true
      settingsOpen.value = true
      _settingsSkipPersist.value = false
    }
  }
  scaleActive.value = want
}

function onScaleEnter() {
  scaleHovered = true
  if (scaleLeaveTimer) { clearTimeout(scaleLeaveTimer); scaleLeaveTimer = null }
  if (scaleCloseRaf) { cancelAnimationFrame(scaleCloseRaf); scaleCloseRaf = null }
  if (scaleFocusTimer) clearTimeout(scaleFocusTimer)
  scaleFocusTimer = setTimeout(() => {
    scaleFocusTimer = null
    syncScaleActive()
  }, SCALE_FOCUS_DELAY)
}

function onScaleLeave() {
  scaleHovered = false
  if (scaleFocusTimer) { clearTimeout(scaleFocusTimer); scaleFocusTimer = null }
  if (scaleLeaveTimer) clearTimeout(scaleLeaveTimer)
  scaleLeaveTimer = setTimeout(() => {
    scaleLeaveTimer = null
    syncScaleActive()
  }, SCALE_LEAVE_DELAY)
}

function markTriedEdit() {
  if (scaleTriedEdit) return
  scaleTriedEdit = true
  settingsOpen.remove()
}

function onScaleInput() {
  if (scaleFocusTimer) { clearTimeout(scaleFocusTimer); scaleFocusTimer = null }
  markTriedEdit()
  syncScaleActive()
}

function onScaleFocus() {
  scaleFocused = true
  markTriedEdit()
  if (scaleFocusTimer) { clearTimeout(scaleFocusTimer); scaleFocusTimer = null }
  syncScaleActive()
}

function onScaleBlur() {
  scaleFocused = false
  syncScaleActive()
}

onBeforeUnmount(() => {
  if (scaleFocusTimer) clearTimeout(scaleFocusTimer)
  if (scaleCloseRaf) cancelAnimationFrame(scaleCloseRaf)
  if (scaleActive.value) exitScaleActive()
})

// ====== 组件显隐与事件 ======
const showWidget = computed(() => {
  if (scaleActive.value) return true
  if (isPortrait.value) return true
  if ((!mouseInViewport.value && autoHide.value) || IS_POPUP.value) return false
  if (settingsOpen.value) {
    if (!autoHide.value) return true
    if (widgetActive.value === 'tr') return true
    return edgeTR.value || hoveredWidget.value === 'tr'
  }
  return edgeTR.value || hoveredWidget.value === 'tr'
})

function toggleSettings() {
  settingsOpen.set(!settingsOpen.value)
}

function setWidget(key) {
  portraitWidget.set(portraitWidget.value === key ? null : key)
}

const autoLabel = isBrowserZh ? '自动' : 'Auto'
</script>

<template>
  <div v-show="showWidget" class="ui-widget" data-widget-id="tr">
    <div class="ui-row">
      <UiSwitch
        v-if="settingsOpen && !scaleActive && !isPortrait"
        v-model="langPref"
        :options="[{ value: 'zh', label: '简体中文' }, { value: 'en', label: 'English' }, { value: 'auto', label: autoLabel }]"
      />
      <UiCheck v-if="settingsOpen && !scaleActive && !isPortrait"
        id="auto-hide"
        v-model="autoHide"
        :label="t('autoHide')"
        show-shortcut="H"
      />
      <UiButton v-if="!IS_POPUP"
        :class="{ 'scale-hidden': scaleActive }"
        :label="settingsOpen ? t('closeSettings') : t('openSettings')"
        :show-shortcut="isPortrait ? '' : 'Esc'"
        @click="toggleSettings"
      />
    </div>
    <div class="ui-row" v-if="(settingsOpen || scaleActive) && !isPortrait">
      <UiButton v-if="desktopEmpty && desktopMode === 'icons'" :label="t('addDefaultIcons')" @click="addDefaultIcons" />
      <template v-else-if = "desktopMode === 'icons'">
        <UiText :class="{ 'scale-hidden': scaleActive }">{{ t('iconScale') }}</UiText>
        <input type="range" min="0" max="200" step="5" v-model.number="iconScale" class="icon-scale-slider" @mouseenter="onScaleEnter" @mouseleave="onScaleLeave" @input="onScaleInput" />
        <UiNumber v-model="iconScale" :min="0" :max="200" :step="5" suffix="%" @mouseenter="onScaleEnter" @mouseleave="onScaleLeave" @focus="onScaleFocus" @blur="onScaleBlur" @input="onScaleInput" />
      </template>
      <UiSwitch
        :class="{ 'scale-hidden': scaleActive }"
        v-model="desktopMode"
        cycle
        :options="[{ value: 'icons', label: t('desktopModeIcons') }, { value: 'cards', label: t('desktopModeCards') }]"
      />
    </div>
    <div class="ui-row" v-if="settingsOpen && !scaleActive">
      <UiButton :label="t('importSettings')" @click="importSettings" />
      <UiButton :label="t('exportSettings')" @click="exportSettings" />
      <UiButton :label="t('resetAllSettings')" @click="resetAllSettings" />
    </div>
    <template v-if="settingsOpen && !scaleActive && isPortrait">
      <div class="ui-row">
        <UiCheck id="pt-wallpaper" :model-value="portraitWidget === 'wallpaper'" :label="t('toggleWallpaperWidget')" @update:model-value="setWidget('wallpaper')" />
      </div>
      <div class="ui-row">
        <UiCheck id="pt-display" :model-value="portraitWidget === 'display'" :label="t('toggleDisplayWidget')" @update:model-value="setWidget('display')" />
      </div>
      <div class="ui-row">
        <UiCheck id="pt-media" :model-value="portraitWidget === 'media'" :label="t('toggleMediaWidget')" @update:model-value="setWidget('media')" />
      </div>
      <div class="ui-row">
        <UiCheck id="pt-control" :model-value="portraitWidget === 'control'" :label="t('toggleControlWidget')" @update:model-value="setWidget('control')" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.scale-hidden { visibility: hidden !important; }
</style>