<script setup>
import { floatIcon } from '../js/core'
</script>

<template>
  <Transition name="float-icon">
    <div
      v-if="!!floatIcon"
      class="float-icon"
      :key="floatIcon.key"
      :style="{ left: floatIcon.x + 'px', top: floatIcon.y + 'px' }"
    >
      {{ floatIcon.icon }}
    </div>
  </Transition>
</template>

<style scoped>
.float-icon {
  position: fixed;
  transform: translate(-50%, -50%);
  font-size: 72px;
  color: var(--widget-text);
  text-shadow: -1px -1px 0 var(--widget-bg), 1px -1px 0 var(--widget-bg), -1px 1px 0 var(--widget-bg), 1px 1px 0 var(--widget-bg), 0 2px 12px var(--text-shadow-blur);
  pointer-events: none;
  z-index: 100;
  line-height: 1;
  opacity: 0.5;
}
.float-icon-enter-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.float-icon-leave-active {
  transition: opacity 300ms ease, transform 300ms ease;
}
.float-icon-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.6);
}
.float-icon-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(1.2);
}
</style>