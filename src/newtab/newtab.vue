<script setup>
import { useWidgetVisibility, hoveredWidget } from '../js/core'
import PlayerContainer from '../widgets/PlayerContainer.vue'
import IconsContainer from '../widgets/IconsContainer.vue'
import CardsContainer from '../widgets/CardsContainer.vue'
import FloatIcon from '../widgets/FloatIcon.vue'
import ControlBar from '../widgets/ControlBar.vue'
import SettingsBar from '../widgets/SettingsBar.vue'
import WallpaperBar from '../widgets/WallpaperBar.vue'
import DisplayBar from '../widgets/DisplayBar.vue'
import MediaBar from '../widgets/MediaBar.vue'
import { desktopMode } from '../js/persist'

const showWallpaperWidget = useWidgetVisibility('tl', { edge: 'tl' })
const showDisplayWidget = useWidgetVisibility('bl', { edge: 'bl' })
const showMediaWidget = useWidgetVisibility('br', { edge: 'br' })
const showControlWidget = useWidgetVisibility('ctrl', { edge: 'bottom' })

function onLayerOver(e) {
  const widget = e.target.closest('[data-widget-id]')
  if (widget) hoveredWidget.value = widget.dataset.widgetId
}
function onLayerOut(e) {
  const widget = e.target.closest('[data-widget-id]')
  if (!widget) return
  const next = e.relatedTarget?.closest('[data-widget-id]')
  if (!next || next.dataset.widgetId !== widget.dataset.widgetId) {
    if (hoveredWidget.value === widget.dataset.widgetId) hoveredWidget.value = null
  }
}
</script>

<template>
  <div class="newtab-root">
    <PlayerContainer />
    <IconsContainer v-if="desktopMode === 'icons'" />
    <CardsContainer v-else />
    <div class="settings-container" @mouseover="onLayerOver" @mouseout="onLayerOut">
      <WallpaperBar v-show="showWallpaperWidget" class="ui-widget-tl" />
      <SettingsBar class="ui-widget-tr" />
      <DisplayBar v-show="showDisplayWidget" class="ui-widget-bl" />
      <MediaBar v-show="showMediaWidget" class="ui-widget-br" />
      <ControlBar v-show="showControlWidget" class="ui-widget-bottom" />
    </div>
    <FloatIcon />
  </div>
</template>

<style scoped>
.newtab-root {
  width: 100%;
  height: 100%;
  position: relative;
  cursor: default;
}
.settings-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 20;
}
.settings-container > :deep(.ui-widget) {
  position: absolute;
}
.ui-widget-tl { top: 12px; left: 12px; }
.ui-widget-tr { top: 12px; right: 12px; text-align: right; }
.ui-widget-bl { bottom: 12px; left: 12px; text-align: left; }
.ui-widget-br { bottom: 12px; right: 12px; z-index: 5; text-align: right; }
.ui-widget-bottom { bottom: 12px; left: 50%; transform: translateX(-50%); z-index: 10; }
</style>