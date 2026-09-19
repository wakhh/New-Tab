<script setup>
import { computed } from 'vue'
import { isPortrait } from '../js/useVisualState'

const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, default: '' },
  showShortcut: { type: String, default: '' },
  accept: { type: String, default: 'image/*,video/*' }
})

const emit = defineEmits(['select'])

const shortcutText = computed(() => props.showShortcut && !isPortrait.value ? props.showShortcut : '')

function onChange(e) {
  const file = e.target.files?.[0]
  if (file) emit('select', file)
  e.target.value = ''
}
</script>

<template>
  <label :for="id" class="ui-column ui-file-input">
    {{ label }}<template v-if="shortcutText"> (<u>{{ shortcutText }}</u>)</template>
    <input :id="id" type="file" :accept="accept" style="display: none" @change="onChange" />
  </label>
</template>

<style scoped>
.ui-file-input {
  cursor: pointer;
  color: var(--widget-text);
}

.ui-file-input:hover {
  color: var(--accent);
}
</style>