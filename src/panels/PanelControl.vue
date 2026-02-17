<script setup>
import { computed, watch, onBeforeUnmount } from 'vue'
import UiPanel from '../ui/UiPanel.vue'
import UiRow from '../ui/UiRow.vue'
import UiButton from '../ui/UiButton.vue'
import UiText from '../ui/UiText.vue'
import UiNumber from '../ui/UiNumber.vue'
import { t } from '../js/useI18n'
import {
  videoPaused, visualSource,
  mediaVideoMuted, mediaVideoVolume, wpVideoMuted, wpVideoVolume,
  mediaMusicMuted, mediaMusicVolume,
  videoLoop, mediaImgDuration
} from '../js/usePersist'
import { videoElProgress, videoElDuration, videoPlaying } from '../js/useVideoElement'
import { musicElProgress, musicElDuration, musicPlaying } from '../js/useAudioElement'
import { getMode, getDirection, playbackCycleMode } from '../js/usePlayMode'
import { currentWallpaper } from '../js/useThemeWallpaper'
import { mediaVisualItem, mediaImgOn, videoOn, mediaVisualOn, musicItem, musicOn } from '../js/useSourceState'
import { itemId, sourceOf } from '../utils/media'
import { isPortrait } from '../js/useVisualState'
import { displayLists } from '../js/useMediaLists'
import { playbackToggle, playbackStop } from '../js/usePlayToggle'
import { playbackNav } from '../js/useItemNav'
import { playbackSeek } from '../js/useProgressStore'
import { playbackToggleMute, playbackSetVolume } from '../js/useVolumeCtrl'

const isWallpaperVideo = computed(() => !mediaVisualOn.value && !!currentWallpaper.value?.isVideo)
const isWallpaperImage = computed(() => !mediaVisualOn.value && !isWallpaperVideo.value && !!currentWallpaper.value)
const hasVisual = computed(() => {
  if (mediaVisualOn.value) return !!mediaVisualItem.value
  if (isWallpaperVideo.value) return true
  if (isWallpaperImage.value) return true
  return false
})

function _canZoomNow() {
  if (isWallpaperImage.value) return true
  if (mediaImgOn.value && mediaVisualItem.value) {
    const source = sourceOf(mediaVisualItem.value)
    const m = getMode(source)
    return m === 'single-play'
  }
  return false
}

const visualLabel = computed(() => {
  if (mediaVisualOn.value && mediaVisualItem.value) {
    const source = sourceOf(mediaVisualItem.value)
    return itemLabel(mediaVisualItem.value) + listIndexLabel(source, mediaVisualItem.value)
  }
  if (isWallpaperVideo.value) return t('wallpaperVideo')
  if (isWallpaperImage.value) return t('wallpaperImage')
  return ''
})

const visualPlayMode = computed(() => {
  if (isWallpaperVideo.value) return videoLoop.value ? 'on' : 'off'
  if (mediaVisualOn.value && mediaVisualItem.value) {
    const source = sourceOf(mediaVisualItem.value)
    return getMode(source)
  }
  return null
})
const visualPlayDirection = computed(() => {
  if (isWallpaperVideo.value) return null
  if (mediaVisualOn.value && mediaVisualItem.value) {
    const source = sourceOf(mediaVisualItem.value)
    return getDirection(source)
  }
  return null
})

const visualPlaying = computed(() => {
  if (mediaVisualOn.value) {
    if (!videoOn.value) {
      if (getMode(visualSource.value) === 'single-play') return false
      return !videoPaused.value
    }
    return videoPlaying.value
  }
  if (isWallpaperVideo.value) return videoPlaying.value
  return false
})
const visualMuted = computed(() => isWallpaperVideo.value ? wpVideoMuted.value : mediaVideoMuted.value)
const visualVolume = computed(() => isWallpaperVideo.value ? wpVideoVolume.value : mediaVideoVolume.value)
const visualTimeCur = computed(() => {
  if (mediaVisualOn.value && videoOn.value) return videoElProgress.value
  if (isWallpaperVideo.value) return videoElProgress.value
  return 0
})
const visualTimeDur = computed(() => {
  if (mediaVisualOn.value && videoOn.value) return videoElDuration.value
  if (isWallpaperVideo.value) return videoElDuration.value
  return 0
})

const visualCanPlayPause = computed(() => mediaVisualOn.value || isWallpaperVideo.value)
const visualCanMode = computed(() => mediaVisualOn.value || isWallpaperVideo.value)

const musicItemSameAsVisual = computed(() => {
  if (!musicItem.value || !mediaVisualItem.value) return false
  return itemId(musicItem.value) === itemId(mediaVisualItem.value)
})
const hasMusic = computed(() => musicOn.value && !!musicItem.value && !musicItemSameAsVisual.value)
const isPopup = globalThis.__IS_POPUP__

const activeCtrlRows = computed(() => (hasVisual.value ? 1 : 0) + (hasMusic.value ? 1 : 0))

const ROW_CLASS_BASE = 'ctrl-rows-'
function applyRowClass(rows) {
  const el = document.documentElement
  for (let i = 0; i <= 3; i++) el.classList.remove(ROW_CLASS_BASE + i)
  if (rows > 0) el.classList.add(ROW_CLASS_BASE + Math.min(rows, 3))
}
watch(activeCtrlRows, applyRowClass, { immediate: true })
onBeforeUnmount(() => applyRowClass(0))

const musicLabel = computed(() => {
  if (!musicItem.value) return ''
  const source = sourceOf(musicItem.value)
  return itemLabel(musicItem.value) + listIndexLabel(source, musicItem.value)
})
const musicPlayMode = computed(() => {
  if (!musicItem.value) return null
  const source = sourceOf(musicItem.value)
  return getMode(source)
})
const musicPlayDirection = computed(() => {
  if (!musicItem.value) return null
  const source = sourceOf(musicItem.value)
  return getDirection(source)
})

function modeShortcut(mode, isWpVideoWithMusic) {
  if (!mode) return ''
  if (isWpVideoWithMusic) return ''
  const needsDir = mode === 'order-loop' || mode === 'order'
  return needsDir ? ' J/K' : ' K'
}

const modeShortcutVisual = computed(() => {
  if (!visualCanMode.value) return ''
  return modeShortcut(visualPlayMode.value, isWallpaperVideo.value && hasMusic.value)
})
const modeShortcutMusic = computed(() => {
  if (visualCanMode.value && !isWallpaperVideo.value) return ''
  if (!hasMusic.value) return ''
  return modeShortcut(musicPlayMode.value, false)
})

function onVisualSeek(e) {
  playbackSeek(Number(e.target.value), isWallpaperVideo.value ? 'wp-video' : 'media-visual')
}
function onMusicSeek(e) {
  playbackSeek(Number(e.target.value), 'media-music')
}
function onVolumeInput(e, which) { playbackSetVolume(Number(e.target.value), which) }
function onVolumePointerDown(e, which) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const val = Math.round(pct * 100)
  el.value = val
  playbackSetVolume(val, which)
}

const visualVolumeKey = computed(() => isWallpaperVideo.value ? 'wp' : 'media-video')

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function modeLabelOf(playMode, playDirection, isImg = false) {
  if (!playMode) return ''
  if (playMode === 'on') return t('loop')
  if (playMode === 'off') return t('noLoop')
  const isReverse = playDirection === 'backward'
  const map = {
    'single-loop': t('playModeSingleLoop'),
    'order-loop': isReverse ? t('playModeReverseLoop') : t('playModeOrderLoop'),
    'shuffle': t('playModeShuffle'),
    'single-play': isImg ? t('playModeSinglePlayImg') : t('playModeSinglePlayVideo'),
    order: isReverse ? t('playModeReversePlay') : t('playModeOrder')
  }
  return map[playMode] || playMode
}

function srcLabel(source) {
  return source === 'network' ? t('mediaNetwork') : t('mediaLocal')
}

function itemLabel(item) {
  const src = srcLabel(item?.url ? 'network' : 'local')
  const type = item?.type === 'music' ? t('music')
            : item?.type === 'video' ? t('video')
            : t('image')
  return `${src}${type}`
}

function listIndexLabel(source, item) {
  if (!source || !item) return ''
  const list = displayLists[source.src]?.[source.type]?.value
  if (!list?.length) return ''
  const idx = list.findIndex((f) => itemId(f) === itemId(item))
  const i = idx >= 0 ? idx + 1 : 0
  return ` ${i}/${list.length}`
}

</script>

<template>
  <UiPanel panel-id="ctrl" class="ui-panel-ctrl" :class="{ 'ui-panel-ctrl--shift': !isPopup && !isPortrait &&  hasMusic }" @click.stop>
    <div class="ctrl-grid">
      <template v-if="hasVisual">
        <UiText class="ctrl-label" style="grid-column:1" :title="visualLabel && _canZoomNow() ? '(Ctrl+🖱️)' : ''">
          {{ visualLabel }}
          <svg v-if="visualLabel && _canZoomNow()" class="ctrl-zoom-hint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </UiText>
        <UiButton v-if="visualCanMode" style="grid-column:2" :label="modeLabelOf(visualPlayMode, visualPlayDirection, mediaImgOn)" :show-shortcut="modeShortcutVisual" @click="playbackCycleMode(isWallpaperVideo ? 'wp-video' : 'media-visual')" />
        <input v-if="videoOn" style="grid-column:3" class="ctrl-range" type="range" min="0" step="0.1" :max="visualTimeDur || 0" :value="visualTimeCur" title="(Left/Right)" @input="onVisualSeek" @change="$event.target.blur()" />
        <UiNumber v-if="mediaImgOn" style="grid-column:3" v-model="mediaImgDuration" :min="0.5" :max="3600" :step="0.5" :precision="1" :suffix="t('second')" />
        <span v-if="videoOn" style="grid-column:4" class="ui-column ctrl-time">{{ fmtTime(visualTimeCur) }} / {{ fmtTime(visualTimeDur) }}</span>
        <UiButton v-if="mediaVisualOn" style="grid-column:5" label="⏹" title="(Esc)" @click="playbackStop('media-visual')" />
        <UiButton v-if="mediaVisualOn" style="grid-column:6" label="⏮" title="(Up)" @click="playbackNav('prev', 'media-visual')" />
        <UiButton v-if="visualCanPlayPause" style="grid-column:7" :label="visualPlaying ? '⏸' : '▶'" title="(Space)" @click="playbackToggle(isWallpaperVideo ? 'wp-video' : 'media-visual')" />
        <UiButton v-if="mediaVisualOn" style="grid-column:8" label="⏭" title="(Down)" @click="playbackNav('next', 'media-visual')" />
        <UiButton v-if="videoOn" style="grid-column:9" label="" title="(M)" @click="playbackToggleMute(visualVolumeKey)">
          <template #icon>
            <svg v-if="visualMuted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 010 7.07" /><path d="M19.07 4.93a10 10 0 010 14.14" /></svg>
          </template>
        </UiButton>
        <input v-if="videoOn" style="grid-column:10" class="ctrl-range ctrl-volume" type="range" min="0" max="100" :value="visualVolume" title="(-/+)" @input="(e) => onVolumeInput(e, visualVolumeKey)" @change="$event.target.blur()" />
      </template>

      <template v-if="hasMusic">
        <UiText class="ctrl-label" style="grid-column:1">{{ musicLabel }}</UiText>
        <UiButton style="grid-column:2" :label="modeLabelOf(musicPlayMode, musicPlayDirection)" :show-shortcut="modeShortcutMusic" @click="playbackCycleMode('media-music')" />
        <input style="grid-column:3" class="ctrl-range" type="range" min="0" step="0.1" :max="musicElDuration || 0" :value="musicElProgress" title="(Left/Right)" @input="onMusicSeek" @change="$event.target.blur()" />
        <span style="grid-column:4" class="ui-column ctrl-time">{{ fmtTime(musicElProgress) }} / {{ fmtTime(musicElDuration) }}</span>
        <UiButton style="grid-column:5" label="⏹" title="(Esc)" @click="playbackStop('media-music')" />
        <UiButton style="grid-column:6" label="⏮" title="(Up)" @click="playbackNav('prev', 'media-music')" />
        <UiButton style="grid-column:7" :label="musicPlaying ? '⏸' : '▶'" title="(Enter)" @click="playbackToggle('media-music')" />
        <UiButton style="grid-column:8" label="⏭" title="(Down)" @click="playbackNav('next', 'media-music')" />
        <UiButton style="grid-column:9" label="" title="(M)" @click="playbackToggleMute('media-music')">
          <template #icon>
            <svg v-if="mediaMusicMuted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 010 7.07" /><path d="M19.07 4.93a10 10 0 010 14.14" /></svg>
          </template>
        </UiButton>
        <input style="grid-column:10" class="ctrl-range ctrl-volume" type="range" min="0" max="100" :value="mediaMusicVolume" title="(-/+)" @pointerdown="(e) => onVolumePointerDown(e, 'media-music')" @input="(e) => onVolumeInput(e, 'media-music')" @change="$event.target.blur()" />
      </template>
    </div>
  </UiPanel>
</template>

<style scoped>
.ui-panel-ctrl {
  bottom: 12px;
  left: 0;
  right: 0;
  margin: 0 auto;
  z-index: 30;
  width: max-content;
}

.ui-panel-ctrl--shift {
  transform: translateX(-80px);
}

:global(html.mode-popup) .ui-panel-ctrl--shift {
  transform: none;
}

.ctrl-grid {
  display: grid;
  grid-template-columns: repeat(10, max-content);
  grid-template-rows: auto auto;
  gap: 4px 10px;
  align-items: center;
  justify-items: start;
}

:deep(.ctrl-label) {
  padding: 0 6px;
  height: 26px;
  display: inline-flex;
  align-items: center;
}

.ctrl-zoom-hint {
  margin-left: 4px;
  opacity: 0.7;
  cursor: default;
}

:deep(.ui-button),
:deep(.ui-switch) {
  height: 26px;
  display: inline-flex;
  align-items: center;
}

.ctrl-range {
  width: 140px;
  accent-color: var(--accent);
  cursor: pointer;
}
.ctrl-range.ctrl-volume {
  width: 70px;
}
.ctrl-time {
  color: var(--panel-text);
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
}
.ctrl-imgdur-spacer {
  display: inline-block;
  width: 60px;
  height: 26px;
}

@media (orientation: portrait) {
  .ctrl-grid {
    grid-template-columns: auto;
    grid-template-rows: auto auto;
    gap: 4px;
  }
  .ctrl-imgdur-spacer { display: none; }
}
</style>