<script setup>
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 1e9 },
  step: { type: Number, default: 1 },
  precision: { type: Number, default: null },
  suffix: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

function clamp(n) {
  if (Number.isNaN(n)) n = props.min
  n = Math.max(props.min, Math.min(props.max, n))
  if (props.precision != null) n = Number(n.toFixed(props.precision))
  return n
}

function onInput(e) {
  const v = Number(e.target.value)
  if (!Number.isNaN(v)) emit('update:modelValue', clamp(v))
}

function onBlur(e) {
  const v = Number(e.target.value)
  emit('update:modelValue', clamp(v))
  e.target.value = props.modelValue
}
</script>

<template>
  <span class="ui-column ui-number">
    <input
      type="number"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      @input="onInput"
      @blur="onBlur"
      @keydown.enter="$event.target.blur()"
    />
    <span v-if="suffix" class="ui-number-suffix">{{ suffix }}</span>
  </span>
</template>

<style scoped>
.ui-number {
  display: inline-flex;
  align-items: center;
}
.ui-number input {
  width: 32px;
  height: calc(var(--ui-height) - 6px);
  border: none;
  border-bottom: var(--ui-border) solid var(--border-subtle);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: center;
  outline: none;
  -moz-appearance: textfield;
}
.ui-number input::-webkit-outer-spin-button,
.ui-number input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.ui-number-suffix {
  opacity: 0.7;
  font-size: var(--ui-font);
}
</style>