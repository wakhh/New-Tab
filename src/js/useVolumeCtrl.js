import {
  wpVideoMuted, videoPaused, mediaVideoMuted, mediaMusicMuted,
  wpVideoVolume, mediaVideoVolume, mediaMusicVolume,
  visualSource, musicSource
} from './usePersist'
import { currentWallpaper } from './useThemeWallpaper'

const lastVolume = { wp: null, 'media-video': null, 'media-music': null }
const VOLUME_BINDINGS = {
  'wp': { muted: wpVideoMuted, volume: wpVideoVolume },
  'media-video': { muted: mediaVideoMuted, volume: mediaVideoVolume },
  'media-music': { muted: mediaMusicMuted, volume: mediaMusicVolume }
}

export function playbackToggleMute(which) {
  const b = VOLUME_BINDINGS[which]
  if (!b) return
  if (!b.muted.value) {
    lastVolume[which] = b.volume.value
    b.volume.set(0); b.muted.set(true)
  } else {
    const v = lastVolume[which]
    const restore = (v != null && v > 0) ? v : 30
    lastVolume[which] = null
    b.volume.set(restore); b.muted.set(false)
  }
}

export function playbackSetVolume(val, which) {
  const b = VOLUME_BINDINGS[which]
  if (!b) return
  const n = Math.max(0, Math.min(100, Math.round(Number(val) || 0)))
  if (n === 0) b.muted.set(true); else if (b.muted.value) b.muted.set(false)
  b.volume.set(n); return n
}

export function playbackMuteAll() {
  const targets = []
  if (currentWallpaper.value?.isVideo) targets.push('wp')
  if (visualSource.value) targets.push('media-video')
  if (musicSource.value) targets.push('media-music')
  if (targets.length === 0) return
  const anyUnmuted = targets.some(w => !VOLUME_BINDINGS[w].muted.value)
  for (const which of targets) {
    const b = VOLUME_BINDINGS[which]
    if (anyUnmuted) {
      if (!b.muted.value) {
        lastVolume[which] = b.volume.value
        b.volume.set(0); b.muted.set(true)
      }
    } else {
      const v = lastVolume[which]
      const restore = (v != null && v > 0) ? v : 30
      lastVolume[which] = null
      b.muted.set(false); b.volume.set(restore)
    }
  }
}

export function playbackAdjustVolume(delta) {
  wpVideoVolume.set(Math.max(0, Math.min(100, wpVideoVolume.value + delta)))
  mediaVideoVolume.set(Math.max(0, Math.min(100, mediaVideoVolume.value + delta)))
  mediaMusicVolume.set(Math.max(0, Math.min(100, mediaMusicVolume.value + delta)))
}