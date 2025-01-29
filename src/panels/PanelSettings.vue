<script setup>
import { computed } from 'vue'
import UiPanel from '../ui/UiPanel.vue'
import UiRow from '../ui/UiRow.vue'
import UiButton from '../ui/UiButton.vue'
import UiCheck from '../ui/UiCheck.vue'
import { resetAllSettings } from '../js/useStorage'
import { settingsOpen, autoHide, portraitPanel } from '../js/usePersist'
import { isPortrait, edgeTR, hoveredPanel, panelActive } from '../js/useViewport'
import { t } from '../js/useI18n'

const showPanel = computed(() => {
  if (isPortrait.value) return true
  if (settingsOpen.value) {
    if (!autoHide.value) return true
    if (panelActive.value === 'tr') return true
    return edgeTR.value || hoveredPanel.value === 'tr'
  }
  return edgeTR.value || hoveredPanel.value === 'tr'
})

function toggleSettings() {
  settingsOpen.set(!settingsOpen.value)
}

function setPanel(key) {
  portraitPanel.set(portraitPanel.value === key ? null : key)
}
</script>

<template>
  <UiPanel v-show="showPanel" panel-id="tr" class="ui-panel-tr">
    <UiRow>
      <UiButton
        :label="settingsOpen ? t('closeSettings') : t('openSettings')"
        :show-shortcut="isPortrait ? '' : 'S'"
        @click="toggleSettings"
      />
    </UiRow>
    <UiRow v-if="settingsOpen && !isPortrait">
      <UiCheck
        id="auto-hide"
        v-model="autoHide"
        :label="t('autoHide')"
        show-shortcut="H"
      />
    </UiRow>
    <UiRow v-if="settingsOpen">
      <UiButton :label="t('resetAllSettings')" @click="resetAllSettings" />
    </UiRow>
    <template v-if="settingsOpen && isPortrait">
      <UiRow>
        <UiCheck id="pt-wallpaper" :model-value="portraitPanel === 'wallpaper'" :label="t('toggleWallpaperPanel')" @update:model-value="setPanel('wallpaper')" />
      </UiRow>
      <UiRow>
        <UiCheck id="pt-media" :model-value="portraitPanel === 'media'" :label="t('toggleMediaPanel')" @update:model-value="setPanel('media')" />
      </UiRow>
      <UiRow>
        <UiCheck id="pt-display" :model-value="portraitPanel === 'display'" :label="t('toggleDisplayPanel')" @update:model-value="setPanel('display')" />
      </UiRow>
      <UiRow>
        <UiCheck id="pt-control" :model-value="portraitPanel === 'control'" :label="t('toggleControlPanel')" @update:model-value="setPanel('control')" />
      </UiRow>
    </template>
  </UiPanel>
</template>

<style scoped>
.ui-panel-tr { top: 12px; right: 12px; }
.ui-panel-tr > :deep(.ui-row) { justify-content: flex-end !important; }
</style>