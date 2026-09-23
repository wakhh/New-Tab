<script setup>
import { computed, useSlots } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  grapheme: { type: String, default: '' },
  text: { type: String, default: '' },
  size: { type: String, default: '' },
  invert: { type: Boolean, default: false },
})

const slots = useSlots()
const hasSlot = computed(() => !!slots.default?.())
const hasSrc = computed(() => !hasSlot.value && !!props.src)
const isGrapheme = computed(() => !hasSlot.value && !props.src && !!props.grapheme)
const placeholder = computed(() => !hasSlot.value && !props.src && !props.grapheme && !!props.text)
const _invertOn = computed(() => props.invert && (hasSrc.value || isGrapheme.value))

const _BOX = computed(() => {
  const n = parseFloat(props.size)
  return isNaN(n) ? props.size : n + 'px'
})

const _textWidthFactor = computed(() => {
  let w = 0
  for (const ch of props.text) w += ch.charCodeAt(0) > 127 ? 1 : 0.6
  return Math.max(0.6, w || 1)
})

const _textFontSize = computed(() => {
  if (isGrapheme.value) return Math.round(parseFloat(_BOX.value) * 0.85) + 'px'
  if (placeholder.value) {
    const f = Math.min(0.85, 0.85 / _textWidthFactor.value)
    return Math.round(parseFloat(_BOX.value) * f) + 'px'
  }
  return undefined
})
</script>

<template>
  <span class="ui-icon ui-icon-box" :style="{ width: _BOX, height: _BOX, aspectRatio: '1 / 1' }">
    <img v-if="hasSrc" :src="src" class="ui-icon-img" :class="{ 'ui-icon-invert': _invertOn }" referrerpolicy="no-referrer" />
    <span v-else-if="isGrapheme" class="ui-icon-grapheme" :class="{ 'ui-icon-invert': _invertOn }" :style="{ fontSize: _textFontSize }">{{ grapheme }}</span>
    <span v-else-if="placeholder" class="ui-icon-text" :style="{ fontSize: _textFontSize }">{{ text }}</span>
    <span v-else class="ui-icon-slot"><slot /></span>
  </span>
</template>

<style scoped>
.ui-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  flex-shrink: 0;
  line-height: 1;
  overflow: visible;
}
.ui-icon-img {
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
  object-fit: contain;
}
.ui-icon-grapheme {
  font-weight: normal;
  background: transparent;
  line-height: 1.2;
  display: block;
  color: var(--widget-text);
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', system-ui, sans-serif;
}
.ui-icon-text {
  color: var(--widget-text);
  background: var(--label-bg);
  border-radius: 6px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  font-weight: 500;
}
.ui-icon-slot {
  background: transparent;
}
.ui-icon-invert {
  filter: invert(1);
}
</style>