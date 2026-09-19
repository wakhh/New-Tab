<script setup>
import { computed, useSlots } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  grapheme: { type: String, default: '' },
  text: { type: String, default: '' },
  size: { type: String, default: '' },
  fontSize: { type: String, default: '' },
  imgStyle: { type: Object, default: () => ({}) },
  textStyle: { type: Object, default: () => ({}) },
})

const slots = useSlots()
const hasSlot = computed(() => !!slots.default?.())
const hasSrc = computed(() => !hasSlot.value && !!props.src)
const isGrapheme = computed(() => !hasSlot.value && !props.src && !!props.grapheme)
const placeholder = computed(() => !hasSlot.value && !props.src && !props.grapheme && !!props.text)

const iconBoxStyle = computed(() => {
  if (!props.size) return {}
  const n = parseFloat(props.size)
  const v = isNaN(n) ? props.size : n + 'px'
  return { width: v, height: v, aspectRatio: '1 / 1' }
})

const _BOX = computed(() => {
  if (!props.size) return 32
  const n = parseFloat(props.size)
  return isNaN(n) ? 32 : n
})

const _textWidthFactor = computed(() => {
  let w = 0
  for (const ch of props.text) w += ch.charCodeAt(0) > 127 ? 1 : 0.6
  return Math.max(0.6, w || 1)
})

const autoFontSize = computed(() => {
  if (props.fontSize) return props.fontSize
  if (isGrapheme.value) return Math.round(_BOX.value * 0.85) + 'px'
  if (placeholder.value) {
    const f = Math.min(0.85, 0.85 / _textWidthFactor.value)
    return Math.round(_BOX.value * f) + 'px'
  }
  return ''
})

const mergedTextStyle = computed(() => ({
  fontSize: autoFontSize.value || undefined,
  ...props.textStyle,
}))

const mergedImgStyle = computed(() => ({ ...props.imgStyle }))
</script>

<template>
  <span v-if="iconBoxStyle.width" class="ui-icon ui-icon-box" :style="iconBoxStyle">
    <img
      v-if="hasSrc"
      :src="src"
      class="ui-icon ui-icon-img"
      referrerpolicy="no-referrer"
      :style="mergedImgStyle"
    />
    <span
      v-else-if="isGrapheme"
      class="ui-icon ui-icon-grapheme"
      :style="mergedTextStyle"
    >{{ grapheme }}</span>
    <span
      v-else-if="placeholder"
      class="ui-icon ui-icon-text"
      :style="mergedTextStyle"
    >{{ text }}</span>
    <span v-else class="ui-icon ui-icon-slot"><slot /></span>
  </span>
  <template v-else>
    <img
      v-if="hasSrc"
      :src="src"
      class="ui-icon ui-icon-img"
      referrerpolicy="no-referrer"
      :style="mergedImgStyle"
    />
    <span
      v-else-if="isGrapheme"
      class="ui-icon ui-icon-grapheme"
      :style="mergedTextStyle"
    >{{ grapheme }}</span>
    <span
      v-else-if="placeholder"
      class="ui-icon ui-icon-text"
      :style="mergedTextStyle"
    >{{ text }}</span>
    <span v-else class="ui-icon ui-icon-slot"><slot /></span>
  </template>
</template>

<style scoped>
.ui-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  line-height: 1;
}

.ui-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  flex-shrink: 0;
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
  box-sizing: border-box;
  white-space: nowrap;
  line-height: 1;
  font-weight: 500;
}

.ui-icon-slot {
  background: transparent;
}
</style>