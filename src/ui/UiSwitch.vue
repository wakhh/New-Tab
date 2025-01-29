<script setup>
import { computed } from 'vue'
import { isPortrait } from '../js/useViewport'

const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { type: String, default: '' },
  showShortcut: { type: String, default: '' },
  showShortcuts: { type: [Array, Object], default: () => [] },
  prefix: { type: String, default: '' }
})

const emit = defineEmits(['select'])

function onClick(opt) {
  if (opt.disabled) return
  emit('select', opt.value, props.modelValue === opt.value)
}

function optShortcut(opt, i) {
  if (isPortrait.value) return ''
  if (opt.shortcut) return opt.shortcut
  if (Array.isArray(props.showShortcuts)) return props.showShortcuts[i] || ''
  return props.showShortcuts[opt.value] || ''
}

const groupShortcut = computed(() => props.showShortcut && !isPortrait.value ? props.showShortcut : '')
</script>

<template>
  <span class="ui-column ui-switch" @click.stop>
    <template v-if="prefix">{{ prefix }}</template>
    <template v-for="(opt, i) in options" :key="opt.value">
      <span v-if="i > 0" class="ui-divider">|</span>
      <span
        class="ui-switch-item"
        :class="{ active: modelValue === opt.value, 'ui-muted': opt.disabled }"
        @click="onClick(opt)"
      >
        {{ opt.label }}<template v-if="optShortcut(opt, i)"> (<u>{{ optShortcut(opt, i) }}</u>)</template>
      </span>
    </template>
    <template v-if="groupShortcut"> (<u>{{ groupShortcut }}</u>)</template>
  </span>
</template>

<style scoped>
.ui-switch {
  color: var(--panel-text);
}

.ui-switch-item {
  cursor: pointer;
  margin: 0 2px;
  color: inherit;
}

.ui-switch-item:not(.active):hover {
  color: var(--accent);
}

.ui-switch-item.active {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ui-switch-item.ui-muted {
  color: var(--panel-text);
  opacity: 0.5;
  cursor: default;
}
.ui-switch-item.ui-muted:hover {
  color: var(--panel-text);
}

.ui-divider {
  opacity: 0.5;
  margin: 0 2px;
}
</style>