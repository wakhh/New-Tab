<script setup>
import { computed } from 'vue'
import { isPortrait } from '../js/core'
import { settingsOpen, desktopMode } from '../js/persist'

const showCards = computed(() => desktopMode.value === 'cards' && !isPortrait.value && !settingsOpen.value)
</script>

<template>
  <template v-if="showCards">
  </template>
</template>