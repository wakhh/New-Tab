<script setup>
</script>

<template>
  <span class="ui-column ui-row"><slot /></span>
</template>

<style scoped>
.ui-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: var(--ui-row-gap);
  padding: 0;
  height: auto;
  pointer-events: none;
}
.ui-row > * {
  pointer-events: auto;
}
</style>