<script setup>
import { computed } from 'vue'
import { isPortrait } from '../js/useVisualState'

const props = defineProps({
  id: { type: String, required: true },
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  showShortcut: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const shortcutText = computed(() => props.showShortcut && !isPortrait.value ? props.showShortcut : '')
</script>

<template>
  <span class="ui-column ui-check">
    <input
      :id="id"
      type="checkbox"
      :checked="modelValue"
      @change="emit('update:modelValue', $event.target.checked)"
    />
    <label :for="id">{{ label }}<template v-if="shortcutText"> (<u>{{ shortcutText }}</u>)</template></label>
  </span>
</template>

<style scoped>
.ui-check {
  cursor: pointer;
  color: var(--panel-text);
}

.ui-check:hover {
  opacity: 0.7;
}

.ui-check input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  width: 14px;
  height: 14px;
  margin: 0;
  vertical-align: -1px;
  border: 1.5px solid var(--panel-text);
  border-radius: 3px;
  background: transparent;
  position: relative;
  transition: border-color 0.15s;
}

.ui-check:hover input[type='checkbox'] {
  opacity: 0.7;
}

.ui-check input[type='checkbox']::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0;
  width: 4px;
  height: 8px;
  border: solid var(--panel-text);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  opacity: 0;
}

.ui-check input[type='checkbox']:checked::after {
  opacity: 1;
}

.ui-check label {
  margin-left: 4px;
  cursor: pointer;
}
</style>