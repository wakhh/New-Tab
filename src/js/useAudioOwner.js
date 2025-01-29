import { computed } from 'vue'
import { sourceStates, audioSourceKey } from './usePersist'

export const audioItem = computed(() => {
  const key = audioSourceKey.value
  if (!key) return null
  const [src, type] = key.split('-')
  return sourceStates[src]?.[type]?.selectedItem.value || null
})

export const musicOn = computed(() => audioItem.value?.type === 'music')