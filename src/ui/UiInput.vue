<script setup>
import { computed } from 'vue'
import { isPortrait } from '../js/useVisualState'

const props = defineProps({
  id: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  showShortcut: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'enter', 'blur'])

const shortcutText = computed(() => props.showShortcut && !isPortrait.value ? props.showShortcut : '')
</script>

<template>
  <span class="ui-column ui-input">
    <input
      :id="id || undefined"
      class="ui-input-field"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      @input="emit('update:modelValue', $event.target.value)"
      @keydown.enter.prevent.stop="emit('enter')"
      @blur="emit('blur')"
    />
    <template v-if="shortcutText">(<u>{{ shortcutText }}</u>)</template>
  </span>
</template>

<style scoped>
.ui-input-field {
  border: none;
  background: transparent;
  color: inherit;
  outline: none;
  padding: 0;
  width: 222px;
  vertical-align: middle;
}

.ui-input-field::placeholder {
  color: inherit;
  opacity: 0.55;
}
</style>