<script setup>
import { computed } from 'vue'
import { isPortrait } from '../js/useVisualState'

const props = defineProps({
  label: { type: String, default: '' },
  showShortcut: { type: String, default: '' },
  title: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['click'])
const shortcutText = computed(() => props.showShortcut && !isPortrait.value ? props.showShortcut : '')
</script>

<template>
  <span
    class="ui-column ui-button"
    :class="{ 'ui-button--disabled': disabled }"
    :title="title"
    @click="!disabled && emit('click')"
  >
    <slot name="icon" />
    {{ label }}<template v-if="shortcutText"> (<u>{{ shortcutText }}</u>)</template>
  </span>
</template>

<style scoped>
.ui-button {
  cursor: pointer;
  color: var(--widget-text);
}

.ui-button:hover {
  color: var(--accent);
}

.ui-button.active {
  color: var(--accent);
}

.ui-button--disabled {
  cursor: default;
  opacity: 0.35;
  pointer-events: none;
}
</style>