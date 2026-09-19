<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import UiWidget from '../ui/UiWidget.vue'
import UiRow from '../ui/UiRow.vue'
import UiButton from '../ui/UiButton.vue'
import UiCheck from '../ui/UiCheck.vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiText from '../ui/UiText.vue'
import { resetAllSettings, exportSettings, importSettings } from '../js/useStorage'
import { settingsOpen, _settingsSkipPersist, autoHide, portraitWidget, shortcutIcons, shortcutFolders, desktopMode, iconScale, langPref } from '../js/usePersist'
import { isPortrait, edgeTR, hoveredWidget, widgetActive, mouseInViewport } from '../js/useVisualState'
import { t, isBrowserZh, resolveLang } from '../js/useI18n'
import { DEFAULT_ICONS_ZH, DEFAULT_FOLDERS_ZH } from '../js/defaultDataZh'
import { DEFAULT_ICONS_EN, DEFAULT_FOLDERS_EN } from '../js/defaultDataEn'


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
  const list = (Array.isArray(DEFAULT_ICONS) ? DEFAULT_ICONS : []).map(i => ({ ...i, type: 'custom' }))
  list.push({ id: '__builtin_add__', name: '', type: 'builtin', fileId: null, iconUrl: '', darkFileId: null, darkIconUrl: '', url: '', search: false, row: lastPos.row, col: lastPos.col })
  shortcutIcons.set(list)
  shortcutFolders.set(Array.isArray(DEFAULT_FOLDERS) ? [...DEFAULT_FOLDERS] : [])
  settingsOpen.set(false)
}

const scaleActive = ref(false)
let scaleFocusTimer = null
let scaleCloseRaf = null
let savedSettingsOpen = false
let scaleInteracted = false
const SCALE_FOCUS_DELAY = 350

function enterScaleActive() {
  if (scaleActive.value) return
  savedSettingsOpen = settingsOpen.value
  _settingsSkipPersist.value = true
  settingsOpen.value = false
  scaleActive.value = true
}

function exitScaleActive() {
  if (!scaleActive.value) return
  _settingsSkipPersist.value = true
  settingsOpen.value = savedSettingsOpen
  _settingsSkipPersist.value = false
  scaleActive.value = false
  scaleInteracted = false
}

function onScaleEnter() {
  if (scaleCloseRaf) { cancelAnimationFrame(scaleCloseRaf); scaleCloseRaf = null }
  if (scaleFocusTimer) clearTimeout(scaleFocusTimer)
  scaleInteracted = false
  scaleFocusTimer = setTimeout(() => {
    scaleFocusTimer = null
    enterScaleActive()
  }, SCALE_FOCUS_DELAY)
}

function onScaleLeave() {
  if (scaleFocusTimer) { clearTimeout(scaleFocusTimer); scaleFocusTimer = null }
  if (scaleInteracted) {
    savedSettingsOpen = false
    exitScaleActive()
  } else {
    exitScaleActive()
  }
}

function onScaleInput() {
  if (scaleFocusTimer) { clearTimeout(scaleFocusTimer); scaleFocusTimer = null }
  scaleInteracted = true
  enterScaleActive()
}

onBeforeUnmount(() => {
  if (scaleFocusTimer) clearTimeout(scaleFocusTimer)
  if (scaleCloseRaf) cancelAnimationFrame(scaleCloseRaf)
  if (scaleActive.value) exitScaleActive()
})

const showWidget = computed(() => {
  if (scaleActive.value) return true
  if (isPortrait.value) return true
  if (!mouseInViewport.value && autoHide.value) return false
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
  <UiWidget v-show="showWidget" widget-id="tr" :class="{ 'ui-widget-tr': true,'ui-widget-tr-close': !settingsOpen && !scaleActive && !isPortrait }">
    <UiRow>
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
      <UiButton
        :class="{ 'scale-hidden': scaleActive, 'settings-close-button': !settingsOpen && !scaleActive &&!isPortrait }"
        :label="settingsOpen ? t('closeSettings') : t('openSettings')"
        :show-shortcut="isPortrait ? '' : 'S'"
        @click="toggleSettings"
      />
    </UiRow>
    <UiRow v-if="(settingsOpen || scaleActive) && !isPortrait">
      <UiButton v-if="desktopEmpty && desktopMode === 'icons'" :label="t('addDefaultIcons')" @click="addDefaultIcons" />
      <template v-else-if = "desktopMode === 'icons'">
        <UiText :class="{ 'scale-hidden': scaleActive }">{{ t('iconScale') }}</UiText>
        <input type="range" min="0" max="200" step="5" v-model.number="iconScale" class="icon-scale-slider" @mouseenter="onScaleEnter" @mouseleave="onScaleLeave" @input="onScaleInput" />
        <UiText>{{ iconScale }}%</UiText>
      </template>
      <UiSwitch
        :class="{ 'scale-hidden': scaleActive }"
        v-model="desktopMode"
        :options="[{ value: 'icons', label: t('desktopModeIcons') }, { value: 'cards', label: t('desktopModeCards') }]"
      />
    </UiRow>
    <UiRow v-if="settingsOpen && !scaleActive">
      <UiButton :label="t('importSettings')" @click="importSettings" />
      <UiButton :label="t('exportSettings')" @click="exportSettings" />
      <UiButton :label="t('resetAllSettings')" @click="resetAllSettings" />
    </UiRow>
    <template v-if="settingsOpen && !scaleActive && isPortrait">
      <UiRow>
        <UiCheck id="pt-wallpaper" :model-value="portraitWidget === 'wallpaper'" :label="t('toggleWallpaperWidget')" @update:model-value="setWidget('wallpaper')" />
      </UiRow>
      <UiRow>
        <UiCheck id="pt-display" :model-value="portraitWidget === 'display'" :label="t('toggleDisplayWidget')" @update:model-value="setWidget('display')" />
      </UiRow>
      <UiRow>
        <UiCheck id="pt-media" :model-value="portraitWidget === 'media'" :label="t('toggleMediaWidget')" @update:model-value="setWidget('media')" />
      </UiRow>
      <UiRow>
        <UiCheck id="pt-control" :model-value="portraitWidget === 'control'" :label="t('toggleControlWidget')" @update:model-value="setWidget('control')" />
      </UiRow>
    </template>
  </UiWidget>
</template>

<style scoped>
.ui-widget-tr { 
  top: 12px; 
  right: 12px;
}
.ui-widget-tr-close {
  margin: 14px 10px;
  padding: unset;
}
.ui-widget-tr > :deep(.ui-row) { justify-content: flex-end !important; }
.ui-widget-tr-close > :first-child {
  margin: unset;
}
.scale-hidden { visibility: hidden !important; }
.settings-close-button {
  margin: unset !important;
  /* padding: unset !important; */
}
.icon-scale-slider {
  width: 80px;
  height: 4px;
  accent-color: var(--accent);
  cursor: pointer;
  align-self: center;
}
</style>