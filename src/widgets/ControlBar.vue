<script setup>
import { computed } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiText from '../ui/UiText.vue'
import UiNumber from '../ui/UiNumber.vue'
import { t } from '../js/i18n'
import {
  mediaVisualSource,
  mediaVideoMuted, mediaVideoVolume, wpVideoMuted, wpVideoVolume,
  mediaMusicMuted, mediaMusicVolume,
  videoLoop, mediaImgDuration
} from '../js/persist'
import {
  videoElProgress, videoElDuration, videoPlaying,
  musicElProgress, musicElDuration, musicPlaying,
  currentWallpaper, isPortrait, mediaImgOn, videoOn, mediaVisualOn, displayMode, viewportW,
  getLoop, getReverse, isShuffle,
  playbackCycleMode, playbackCycleDirection, playbackReshuffle, playbackToggle, playbackStop, playbackSeek, playbackToggleMute, playbackSetVolume, mediaVisualItem, musicItem, musicOn, displayLists, playbackNav,
  itemId, sourceOf
} from '../js/core'
import { IS_POPUP } from '../js/persist'

// ====== 视觉源状态 ======
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
  if (mediaImgOn.value && mediaVisualItem.value && displayMode.value !== "tile") {
    const source = sourceOf(mediaVisualItem.value)
    return !getLoop(source)
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

const visualState = computed(() => {
  if (isWallpaperVideo.value) return { type: 'wp-video', loop: videoLoop.value, reverse: false, shuffle: false }
  if (mediaVisualOn.value && mediaVisualItem.value) {
    const source = sourceOf(mediaVisualItem.value)
    const isImg = mediaImgOn.value
    return { type: isImg ? 'image' : 'media-video', loop: getLoop(source), reverse: getReverse(source), shuffle: isShuffle(source) }
  }
  return null
})
const musicState = computed(() => {
  if (!musicItem.value) return null
  const source = sourceOf(musicItem.value)
  return { type: 'music', loop: getLoop(source), reverse: getReverse(source), shuffle: isShuffle(source) }
})

const visualPlaying = computed(() => {
  if (mediaVisualOn.value) {
    if (!videoOn.value) return !!getLoop(mediaVisualSource.value)
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

// ====== 音乐源状态 ======
const musicItemSameAsVisual = computed(() => {
  if (!musicItem.value || !mediaVisualItem.value) return false
  return itemId(musicItem.value) === itemId(mediaVisualItem.value)
})
const hasMusic = computed(() => musicOn.value && !!musicItem.value && !musicItemSameAsVisual.value)

const musicLabel = computed(() => {
  if (!musicItem.value) return ''
  const source = sourceOf(musicItem.value)
  return itemLabel(musicItem.value) + listIndexLabel(source, musicItem.value)
})

// ====== 标签与格式化 ======
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

// ====== 标签与格式化 ======
function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function onSeekHover(e, dur) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const t = p * dur
  el.title = fmtTime(t)
}

function modeLabelOf(state) {
  if (!state) return ''
  if (state.type === 'wp-video') return state.loop ? t('playModeSingleLoop') : t('playModeSinglePlayVideo')
  if (!state.loop) {
    if (state.type === 'image') return t('playModeSinglePlayImg')
    return t('playModeSingleLoop')
  }
  return state.reverse ? t('playModeReverseLoop') : t('playModeOrderLoop')
}
function modeShortcut(state) {
  if (!state) return ''
  if (state.type === 'wp-video') return ''
  if (state.loop) return ' J/K'
  return ' K'
}

function srcLabel(source) {
  if (source === 'network') return t('mediaNetwork')
  if (source === 'dir') return t('mediaDir')
  return t('mediaLocal')
}

function itemLabel(item) {
  let src
  if (item?.url) src = 'network'
  else if (item?.dirId) src = 'dir'
  else src = 'local'
  const type = item?.type === 'music' ? t('music')
            : item?.type === 'video' ? t('video')
            : t('image')
  return `${srcLabel(src)} ${type}`
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
  <div class="ui-widget ui-widget-ctrl" data-widget-id="ctrl" @click.stop>
    <template v-if="hasVisual">
      <UiText class="ctrl-label" style="grid-column:1" :title="visualLabel && _canZoomNow() ? '(Ctrl+🖱️)' : ''">
        {{ visualLabel }}{{ visualLabel && _canZoomNow() ? ' 🔎︎' : '' }}
      </UiText>
      <UiButton v-if="visualCanMode" style="grid-column:2" :label="modeLabelOf(visualState)" :show-shortcut="modeShortcut(visualState)" @click="playbackCycleMode(isWallpaperVideo ? 'wp-video' : 'media-visual')" />
      <input v-if="videoOn" style="grid-column:3" class="ctrl-range" type="range" min="0" step="0.1" :max="visualTimeDur || 0" :value="visualTimeCur" @mousemove="(e) => onSeekHover(e, visualTimeDur)" @mouseleave="(e) => e.currentTarget.title = ''" title="" @input="onVisualSeek" @change="$event.target.blur()" />
      <UiNumber v-if="mediaImgOn && getLoop(mediaVisualSource)" style="grid-column:3" v-model="mediaImgDuration" :min="0.5" :max="3600" :step="0.5" :precision="1" :suffix="t('second')" />
      <UiText v-if="videoOn" style="grid-column:4" >{{ fmtTime(visualTimeCur) }} / {{ fmtTime(visualTimeDur) }}</UiText>
      <UiButton v-if="mediaVisualOn" style="grid-column:5" label="⏹" title="(S)" @click="playbackStop('media-visual')" />
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
      <UiNumber v-if="videoOn" style="grid-column:11" :model-value="visualVolume" :min="0" :max="100" suffix="%" @update:model-value="v => playbackSetVolume(v, visualVolumeKey)" />
    </template>

    <template v-if="hasMusic">
      <UiText class="ctrl-label" style="grid-column:1">{{ musicLabel }}</UiText>
      <UiButton style="grid-column:2" :label="modeLabelOf(musicState)" :show-shortcut="modeShortcut(musicState)" @click="playbackCycleMode('media-music')" />
      <input style="grid-column:3" class="ctrl-range" type="range" min="0" step="0.1" :max="musicElDuration || 0" :value="musicElProgress" @mousemove="(e) => onSeekHover(e, musicElDuration)" @mouseleave="(e) => e.currentTarget.title = ''" title="" @input="onMusicSeek" @change="$event.target.blur()" />
      <UiText style="grid-column:4" >{{ fmtTime(musicElProgress) }} / {{ fmtTime(musicElDuration) }}</UiText>
      <UiButton style="grid-column:5" label="⏹" title="(S)" @click="playbackStop('media-music')" />
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
      <UiNumber style="grid-column:11" :model-value="mediaMusicVolume" :min="0" :max="100" suffix="%" @update:model-value="v => playbackSetVolume(v, 'media-music')" />
    </template>
  </div>
</template>

<style scoped>
.ui-widget-ctrl {
  display: grid;
  grid-template-columns: repeat(11, max-content);
  grid-auto-rows: auto;
  gap: var(--ui-row-gap) var(--ui-col-gap);
  align-items: center;
  align-content: center;
  justify-items: start;
}
.ui-widget-ctrl > :deep(*) {
  margin: 0;
  pointer-events: auto;
}

.ctrl-range {
  width: 140px;
  height: 4px;
  accent-color: var(--accent);
  cursor: pointer;
}
.ctrl-range.ctrl-volume {
  width: 70px;
}
</style>