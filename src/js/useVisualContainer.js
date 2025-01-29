import { computed } from 'vue'
import { desktopAlign } from './useVisualOwner'
import { screenW, screenH } from './useScreen'
import { viewportW, viewportH } from './useViewport'

export const containerW = computed(() => desktopAlign.value ? screenW.value : viewportW.value)
export const containerH = computed(() => desktopAlign.value ? screenH.value : viewportH.value)