<script setup>
import { computed } from 'vue'
import { isPortrait } from '../js/useVisualState'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  showShortcut: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const shortcutText = computed(() => props.showShortcut && !isPortrait.value ? props.showShortcut : '')

function onClick() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <span class="ui-column ui-check" @click="onClick">
    <span class="ui-check-box" :class="{ checked: modelValue }"></span>
    <span class="ui-check-label">{{ label }}<template v-if="shortcutText"> (<u>{{ shortcutText }}</u>)</template></span>
  </span>
</template>

<style scoped>
.ui-check {
  cursor: pointer;
  color: var(--widget-text);
}

.ui-check-box {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--widget-text);
  border-radius: 3px;
  background: transparent;
  vertical-align: -2px;
  position: relative;
  transition: border-color 0.15s;
}

.ui-check-box.checked::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0;
  width: 4px;
  height: 8px;
  border: solid var(--widget-text);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.ui-check-label {
  margin-left: 4px;
  cursor: pointer;
}
</style>