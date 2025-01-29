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
  gap: 12px;
  padding: 0;
  margin: 3px 0;
}
</style>