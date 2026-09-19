<script setup>
import { useWidgetVisibility } from '../js/useVisualState'
import PlayerContainer from '../widgets/PlayerContainer.vue'
import IconsContainer from '../widgets/IconsContainer.vue'
import CardsContainer from '../widgets/CardsContainer.vue'
import FloatIcon from '../widgets/FloatIcon.vue'
import ControlBar from '../widgets/ControlBar.vue'
import SettingsBar from '../widgets/SettingsBar.vue'
import WallpaperBar from '../widgets/WallpaperBar.vue'
import DisplayBar from '../widgets/DisplayBar.vue'
import MediaBar from '../widgets/MediaBar.vue'
import { desktopMode } from '../js/usePersist'

const showWallpaperWidget = useWidgetVisibility('tl', { edge: 'tl' })
const showDisplayWidget = useWidgetVisibility('bl', { edge: 'bl' })
const showMediaWidget = useWidgetVisibility('br', { edge: 'br' })
const showControlWidget = useWidgetVisibility('ctrl', { edge: 'bottom' })
</script>

<template>
  <div class="newtab-root">
    <PlayerContainer />
    <IconsContainer v-if="desktopMode === 'icons'" />
    <CardsContainer v-else />
    <SettingsBar />
    <FloatIcon />
    <ControlBar v-show="showControlWidget" />
    <WallpaperBar v-show="showWallpaperWidget" />
    <DisplayBar v-show="showDisplayWidget" />
    <MediaBar v-show="showMediaWidget" />
  </div>
</template>

<style scoped>
.newtab-root {
  width: 100%;
  height: 100%;
  position: relative;
  cursor: default;
}
</style>