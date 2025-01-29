import { ref, watch } from 'vue'
import { followSystem, themeMode } from './usePersist'

export { themeMode, followSystem }

export const themeSystemDark = ref(false)
const mediaQM = window.matchMedia('(prefers-color-scheme: dark)')
themeSystemDark.value = mediaQM.matches
mediaQM.addEventListener('change', (e) => { themeSystemDark.value = e.matches })

watch([followSystem, themeSystemDark], ([on, dark]) => {
  if (on) themeMode.value = dark ? 'dark' : 'light'
}, { immediate: true })

watch(themeMode, (t) => {
  document.documentElement.setAttribute('data-theme', t)
}, { immediate: true })

export function cycleTheme() {
  themeMode.set(themeMode.value === 'light' ? 'dark' : 'light')
}