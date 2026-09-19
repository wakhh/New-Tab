<script setup>
import { computed } from 'vue'
import { isPortrait } from '../js/useVisualState'
import { settingsOpen, desktopMode } from '../js/usePersist'

const showCards = computed(() => desktopMode.value === 'cards' && !isPortrait.value && !settingsOpen.value)
</script>

<template>
  <template v-if="showCards">
  </template>
</template>