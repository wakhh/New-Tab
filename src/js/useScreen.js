import { ref } from 'vue'

export const screenW = ref(window.screen?.width || 1920)
export const screenH = ref(window.screen?.height || 1080)

export function updateScreenSize() {
  screenW.value = window.screen?.width || screenW.value
  screenH.value = window.screen?.height || screenH.value
}