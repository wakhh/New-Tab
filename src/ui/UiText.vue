<script setup>
</script>

<template>
  <span class="ui-column ui-text"><slot /></span>
</template>

<style scoped>
.ui-text {
  user-select: text;
  cursor: text;
  min-width: 0;
}

.ui-text::before {
  content: 'ⓘ';
  margin-right: 2px;
  opacity: 0.75;
}
</style>