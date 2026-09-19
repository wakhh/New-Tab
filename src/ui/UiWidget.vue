<script setup>
import { hoveredWidget } from '../js/useVisualState'
const props = defineProps({ widgetId: { type: String, default: '' } })
function onEnter() { if (props.widgetId) hoveredWidget.value = props.widgetId }
function onLeave() { if (hoveredWidget.value === props.widgetId) hoveredWidget.value = null }
</script>

<template>
  <div class="ui-widget" @mouseenter="onEnter" @mouseleave="onLeave">
    <slot />
  </div>
</template>

<style scoped>
.ui-widget {
  position: fixed;
  z-index: 20;
  padding: 8px 10px;
  user-select: none;
  pointer-events: none;
}
.ui-widget > * {
  pointer-events: auto;
}
</style>