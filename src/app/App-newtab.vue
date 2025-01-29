<script setup>
import { usePanelVisibility } from '../js/useViewport'
import PlayerContainer from '../panels/PlayerContainer.vue'
import PanelControl from '../panels/PanelControl.vue'
import PanelSettings from '../panels/PanelSettings.vue'
import PanelWallpaper from '../panels/PanelWallpaper.vue'
import PanelDisplay from '../panels/PanelDisplay.vue'
import PanelMedia from '../panels/PanelMedia.vue'

const showWallpaperPanel = usePanelVisibility('tl', { edge: 'tl' })
const showDisplayPanel = usePanelVisibility('bl', { edge: 'bl' })
const showMediaPanel = usePanelVisibility('br', { edge: 'br' })
const showControlBar = usePanelVisibility('ctrl', { edge: 'bottom' })
</script>

<template>
  <div class="newtab-root">
    <PlayerContainer />
    <PanelSettings />
    <PanelControl v-show="showControlBar" />
    <PanelWallpaper v-show="showWallpaperPanel" />
    <PanelDisplay v-show="showDisplayPanel" />
    <PanelMedia v-show="showMediaPanel" />
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