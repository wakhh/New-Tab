import { createApp } from 'vue'
import App from '../app/App-newtab.vue'
import '../css/app.css'
import '../css/ui-column.css'
import '../js/useKeyboard'
import { setupExtIcon } from '../js/useExtIcon'

setupExtIcon()

try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setupExtIcon)
} catch {}

const src = new URL(location.href).searchParams.get('src')
if (src === 'popup') {
  document.documentElement.classList.add('mode-popup')
  globalThis.__IS_POPUP__ = true
}

createApp(App).mount('#app')