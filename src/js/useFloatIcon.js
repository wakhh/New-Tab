import { ref } from 'vue'
import { viewportW, viewportH, mouseX, mouseY } from './useVisualState'

export const floatIcon = ref(null)

let centerTimer = null
let seekTimer = null
let floatTimer = null

export function showCenterIcon(icon, duration = 300) {
  clearTimeout(centerTimer)
  const vw = viewportW.value
  const vh = viewportH.value
  floatIcon.value = { icon, x: vw / 2, y: vh / 2, key: Date.now() }
  centerTimer = setTimeout(() => { floatIcon.value = null }, duration)
}

export function showSeekIcon(dir, duration = 300) {
  clearTimeout(seekTimer)
  const vw = viewportW.value
  const vh = viewportH.value
  const x = vw / 2 + (dir < 0 ? -vw / 12 : vw / 12)
  floatIcon.value = { icon: dir < 0 ? '«' : '»', x, y: vh / 2, key: Date.now() }
  seekTimer = setTimeout(() => { floatIcon.value = null }, duration)
}

export function showFloatIcon(icon, x, y) {
  clearTimeout(floatTimer)
  floatIcon.value = { icon, x: x ?? mouseX.value, y: y ?? mouseY.value, key: Date.now() }
  floatTimer = setTimeout(() => { floatIcon.value = null }, 250)
}