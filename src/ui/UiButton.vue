<script setup>
import { computed } from 'vue'
import { isPortrait } from '../js/useVisualState'

const props = defineProps({
  label: { type: String, default: '' },
  showShortcut: { type: String, default: '' },
  title: { type: String, default: '' }
})

const emit = defineEmits(['click'])
const shortcutText = computed(() => props.showShortcut && !isPortrait.value ? props.showShortcut : '')
</script>

<template>
  <span class="ui-column ui-button" :title="title" @click="emit('click')">
    <slot name="icon" />
    {{ label }}<template v-if="shortcutText"> (<u>{{ shortcutText }}</u>)</template>
  </span>
</template>

<style scoped>
.ui-button {
  cursor: pointer;
  color: var(--panel-text);
}

.ui-button:hover {
  color: var(--accent);
}

.ui-button.active {
  color: var(--accent);
}
</style>