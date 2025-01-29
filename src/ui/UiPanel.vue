<script setup>
import { hoveredPanel } from '../js/useViewport'
const props = defineProps({ panelId: { type: String, default: '' } })
function onEnter() { if (props.panelId) hoveredPanel.value = props.panelId }
function onLeave() { if (hoveredPanel.value === props.panelId) hoveredPanel.value = null }
</script>

<template>
  <div class="ui-panel" @mouseenter="onEnter" @mouseleave="onLeave">
    <slot />
  </div>
</template>

<style scoped>
.ui-panel {
  position: fixed;
  z-index: 20;
  padding: 8px 10px;
  user-select: none;
}
</style>