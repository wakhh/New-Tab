import { ref, watch } from 'vue'
import { viewportW, viewportH, mouseX, mouseY } from './useViewport'
import { visualPaused, wpVideoPlaying } from './usePersist'

export const centerIcon = ref(null)
export const seekIcon = ref(null)

export const floatIcon = ref(null)
let floatTimer = null

export function showFloatIcon(icon, x, y) {
  clearTimeout(floatTimer)
  floatIcon.value = { icon, x: x ?? mouseX.value, y: y ?? mouseY.value, key: Date.now() }
  floatTimer = setTimeout(() => { floatIcon.value = null }, 250)
}

export function hideFloatIcon() {
  clearTimeout(floatTimer)
  floatIcon.value = null
}

export const pendingIcon = ref('')

export function tryShowPending() {
  if (pendingIcon.value) {
    showFloatIcon(pendingIcon.value)
    pendingIcon.value = ''
  }
}

watch(centerIcon, (val) => {
  if (!val) return
  showFloatIcon(val, viewportW.value / 2, viewportH.value / 2)
})

watch(seekIcon, (val) => {
  if (!val) return
  const dir = val.dir
  const vw = viewportW.value
  const vh = viewportH.value
  const x = vw / 2 + (dir < 0 ? -vw / 12 : vw / 12)
  showFloatIcon(dir < 0 ? '«' : '»', x, vh / 2)
})

watch(visualPaused, () => tryShowPending())
watch(wpVideoPlaying, () => tryShowPending())