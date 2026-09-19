<script setup>
</script>

<template>
  <span class="ui-column ui-text"><slot /></span>
</template>

<style scoped>
.ui-text {
  user-select: text;
  cursor: text;
  font-variant-numeric: tabular-nums;
  background: var(--label-bg);
}
</style>