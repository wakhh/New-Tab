import { ref } from 'vue'
import { useStorage } from './useStorage'

export const _displayModeVideo = useStorage('wp-display-mode-video', 'tile')
export const _displayModeImage = useStorage('wp-display-mode-image', 'fill')
export const optimize = useStorage('wp-optimize', true)
export const _desktopAlignVideo = useStorage('wp-desktop-align-video', false)
export const _desktopAlignImage = useStorage('wp-desktop-align-image', false)
export const _desktopAnchorVideo = useStorage('wp-desktop-anchor-video', 'rb')
export const _desktopAnchorImage = useStorage('wp-desktop-anchor-image', 'rb')
export const videoLoop = useStorage('wp-video-loop', true)

export const settingsOpen = useStorage('settings-open', false)

const DEFAULT_WP_LIGHT = { url: 'https://res.wx.qq.com/t/webmail/webmail/res/static/images/content-bg.1x.d2fb96c.jpg', isVideo: false, kind: 'url', name: 'content-bg.1x.d2fb96c.jpg' }
const DEFAULT_WP_DARK = { url: 'https://res.wx.qq.com/t/webmail/webmail/res/static/images/content-bg-dark.1x.4541f7e.jpg', isVideo: false, kind: 'url', name: 'content-bg-dark.1x.4541f7e.jpg' }
export const currWallpapers = useStorage('wp-curr-wallpapers', {
  light: DEFAULT_WP_LIGHT,
  dark: DEFAULT_WP_DARK
}, (v) => {
  if (!v || typeof v !== 'object') return { light: DEFAULT_WP_LIGHT, dark: DEFAULT_WP_DARK }
  return v
})
export const followLight = useStorage('wp-follow-light', false)
export const followDark = useStorage('wp-follow-dark', false)
export const urlInput = useStorage('wp-url-input', { light: '', dark: '' })
export const followSystem = useStorage('theme-follow-system', true)
const themeDefault = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
export const themeMode = useStorage('theme-mode', themeDefault, null, { shouldPersist: () => !followSystem.value })

export const wpVideoVolume = useStorage('wp-video-volume', 0)
export const wpVideoMuted = useStorage('wp-video-muted', true)
export const mediaVideoVolume = useStorage('media-video-volume', 30)
export const mediaVideoMuted = useStorage('media-video-muted', false)
export const mediaMusicVolume = useStorage('media-music-volume', 30)
export const mediaMusicMuted = useStorage('media-music-muted', false)

export const videoPaused = useStorage('play-video-paused', false)
export const musicPaused = useStorage('play-music-paused', false)

export const videoProgress = useStorage('play-video-progress', null, (v) => {
  if (!v || typeof v !== 'object') return null
  return { key: v.key || null, time: v.time || 0 }
})
export const musicProgress = useStorage('play-music-progress', null, (v) => {
  if (!v || typeof v !== 'object') return null
  return { key: v.key || null, time: v.time || 0 }
})

export const MEDIA_SOURCES = ['local', 'network']
export const MEDIA_TYPES = ['image', 'music', 'video']

export const sourceStates = {}
for (const src of MEDIA_SOURCES) {
  sourceStates[src] = {}
  for (const type of MEDIA_TYPES) {
    const key = `${src}-${type}`
    sourceStates[src][type] = {
      folder: useStorage(`media-folder-${key}`, 'all'),
      sortBy: useStorage(`media-sortby-${key}`, 'time'),
      sortDir: useStorage(`media-sortdir-${key}`, 'desc'),
      selectedItem: useStorage(`media-selected-${key}`, null),
      playMode: useStorage(`media-playmode-${key}`, type === 'image' ? 'single-play' : type === 'video' ? 'single-loop' : 'order-loop'),
      playDirection: useStorage(`media-direction-${key}`, 'forward')
    }
  }
}

const DEFAULT_NETWORK_FILES = [
  { url: 'https://res.wx.qq.com/t/webmail/webmail/res/static/images/content-bg.1x.d2fb96c.jpg', site: 'res.wx.qq.com', pathname: 'content-bg.1x.d2fb96c.jpg', ctime: 0, type: 'image' },
  { url: 'https://res.wx.qq.com/t/webmail/webmail/res/static/images/content-bg-dark.1x.4541f7e.jpg', site: 'res.wx.qq.com', pathname: 'content-bg-dark.1x.4541f7e.jpg', ctime: 0, type: 'image' }
]
export const networkFiles = useStorage('media-network-files', DEFAULT_NETWORK_FILES, (v) => (Array.isArray(v) ? v : []))

export const selectedSource = useStorage('media-source-selected', { src: 'local', type: 'video' }, (v) => {
  if (!v || !v.src || !v.type) return { src: 'local', type: 'video' }
  return v
})
export const visualSource = useStorage('media-visual-source', null, (v) => {
  return v && v.src && v.type ? v : null
})
export const musicSource = useStorage('media-music-source', null, (v) => {
  return v && v.src && v.type ? v : null
})

export const mediaImgDuration = useStorage('media-img-duration', 3)
export const mediaListWidth = useStorage('media-list-width', null)
export const autoHide = useStorage('auto-hide', false)

export const portraitPanel = useStorage('portrait-panel', null)