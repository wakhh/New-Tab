<script setup>
import { computed } from 'vue'
import UiPanel from '../ui/UiPanel.vue'
import UiRow from '../ui/UiRow.vue'
import UiButton from '../ui/UiButton.vue'
import UiText from '../ui/UiText.vue'
import UiNumber from '../ui/UiNumber.vue'
import { t } from '../js/useI18n'
import {
  visualPaused, audioPaused, wpVideoPlaying, visualSourceKey,
  mediaVideoMuted, mediaVideoVolume, wpVideoMuted, wpVideoVolume,
  mediaAudioMuted, mediaAudioVolume,
  videoLoop, slideSeconds
} from '../js/usePersist'
import { mediaVisualTimeCur, mediaVisualTimeDur, mediaAudioTimeCur, mediaAudioTimeDur, mediaVideoPlaying, mediaAudioPlaying } from '../js/usePlaybackState'
import { modeForKey, dirForKey } from '../js/usePlaybackEngine'
import { currentWallpaper } from '../js/useWallpaper'
import { visualItem, slideshowOn, videoOn } from '../js/useVisualOwner'
import { audioItem, musicOn } from '../js/useAudioOwner'
import { itemKey } from '../utils/media'
import { itemLabel, listIndexLabel, fmtTime, modeLabelOf } from '../js/useControlUI'
import { isPortrait } from '../js/useViewport'
import {
  playbackToggle, playbackNav, playbackCycleMode, playbackCycleDirection,
  playbackStop, playbackSeek, playbackToggleMute, playbackSetVolume
} from '../js/usePlaybackActions'

const isMediaVisual = computed(() => slideshowOn.value || videoOn.value)
const isWallpaperVideo = computed(() => !isMediaVisual.value && !!currentWallpaper.value?.isVideo)
const isWallpaperImage = computed(() => !isMediaVisual.value && !isWallpaperVideo.value && !!currentWallpaper.value)
const hasVisual = computed(() => {
  if (isMediaVisual.value) return !!visualItem.value
  if (isWallpaperVideo.value) return true
  if (isWallpaperImage.value) return true
  return false
})

const visualIsVideo = computed(() => isMediaVisual.value ? visualItem.value?.type === 'video' : isWallpaperVideo.value)

const visualLabel = computed(() => {
  if (isMediaVisual.value && visualItem.value) {
    const srcKey = (visualItem.value.url ? 'network' : 'local') + '-' + visualItem.value.type
    return itemLabel(visualItem.value) + listIndexLabel(srcKey, visualItem.value)
  }
  if (isWallpaperVideo.value) return t('wallpaperVideo')
  if (isWallpaperImage.value) return t('wallpaperImage')
  return ''
})

const visualPlayMode = computed(() => {
  if (isWallpaperVideo.value) return videoLoop.value ? 'on' : 'off'
  if (isMediaVisual.value && visualItem.value) {
    const srcKey = (visualItem.value.url ? 'network' : 'local') + '-' + visualItem.value.type
    return modeForKey(srcKey)
  }
  return null
})
const visualPlayDirection = computed(() => {
  if (isWallpaperVideo.value) return null
  if (isMediaVisual.value && visualItem.value) {
    const srcKey = (visualItem.value.url ? 'network' : 'local') + '-' + visualItem.value.type
    return dirForKey(srcKey)
  }
  return null
})

const visualPlaying = computed(() => {
  if (isMediaVisual.value) {
    if (!visualIsVideo.value) {
      if (modeForKey(visualSourceKey.value) === 'single-play') return false
      return !visualPaused.value
    }
    return mediaVideoPlaying.value
  }
  if (isWallpaperVideo.value) return mediaVideoPlaying.value
  return false
})
const audioPlaying = computed(() => mediaAudioPlaying.value)
const visualMuted = computed(() => isWallpaperVideo.value ? wpVideoMuted.value : mediaVideoMuted.value)
const visualVolume = computed(() => isWallpaperVideo.value ? wpVideoVolume.value : mediaVideoVolume.value)
const visualTimeCur = computed(() => isMediaVisual.value && visualIsVideo.value ? mediaVisualTimeCur.value : 0)
const visualTimeDur = computed(() => isMediaVisual.value && visualIsVideo.value ? mediaVisualTimeDur.value : 0)

const visualCanPlayPause = computed(() => isMediaVisual.value || isWallpaperVideo.value)
const visualCanStop = computed(() => isMediaVisual.value)
const visualCanNav = computed(() => isMediaVisual.value)
const visualCanMode = computed(() => isMediaVisual.value || isWallpaperVideo.value)
const visualHasSeek = computed(() => isMediaVisual.value && visualIsVideo.value)
const visualHasVolume = computed(() => isWallpaperVideo.value || (isMediaVisual.value && visualIsVideo.value))
const visualCanMute = computed(() => visualHasVolume.value)

const audioItemSameAsVisual = computed(() => {
  if (!audioItem.value || !visualItem.value) return false
  return itemKey(audioItem.value) === itemKey(visualItem.value)
})
const hasAudio = computed(() => musicOn.value && !!audioItem.value && !audioItemSameAsVisual.value)

const audioLabel = computed(() => {
  if (!audioItem.value) return ''
  const srcKey = (audioItem.value.url ? 'network' : 'local') + '-' + audioItem.value.type
  return itemLabel(audioItem.value) + listIndexLabel(srcKey, audioItem.value)
})
const audioPlayMode = computed(() => {
  if (!audioItem.value) return null
  const srcKey = (audioItem.value.url ? 'network' : 'local') + '-' + audioItem.value.type
  return modeForKey(srcKey)
})
const audioPlayDirection = computed(() => {
  if (!audioItem.value) return null
  const srcKey = (audioItem.value.url ? 'network' : 'local') + '-' + audioItem.value.type
  return dirForKey(srcKey)
})

const modeShortcutVisual = computed(() => {
  if (!visualCanMode.value) return ''
  if (isWallpaperVideo.value && hasAudio.value) return ''
  return ' K'
})
const modeShortcutAudio = computed(() => {
  if (visualCanMode.value && !isWallpaperVideo.value) return ''
  if (!hasAudio.value) return ''
  return ' K'
})

function onVisualSeek(e) {
  if (isMediaVisual.value) playbackSeek(Number(e.target.value), 'media-visual')
}
function onAudioSeek(e) {
  playbackSeek(Number(e.target.value), 'media-audio')
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
</script>

<template>
  <UiPanel panel-id="ctrl" class="ui-panel-ctrl" :class="{ 'ui-panel-ctrl--dual-right': !isPortrait && hasVisual && hasAudio && isMediaVisual && visualIsVideo }" @click.stop>
      <UiRow v-if="hasVisual">
        <UiText class="ctrl-slot-label">{{ visualLabel }}</UiText>
        <UiButton v-if="visualCanMode" :label="modeLabelOf(visualPlayMode, visualPlayDirection)" :show-shortcut="modeShortcutVisual" @click="playbackCycleMode(isWallpaperVideo ? 'wp-video' : 'media-visual')" />

        <template v-if="visualHasSeek">
          <input
            class="ctrl-range"
            type="range"
            min="0"
            step="0.1"
            :max="visualTimeDur || 0"
            :value="visualTimeCur"
            title="(Left/Right)"
            @input="onVisualSeek"
            @change="$event.target.blur()"
          />
          <span class="ctrl-time">{{ fmtTime(visualTimeCur) }} / {{ fmtTime(visualTimeDur) }}</span>
        </template>

        <UiButton v-if="visualCanStop" label="⏹" title="(Esc)" @click="playbackStop('media-visual')" />
        <UiButton v-if="visualCanNav" label="⏮" title="(Up)" @click="playbackNav('prev', 'media-visual')" />
        <UiButton
          v-if="visualCanPlayPause"
          :label="visualPlaying ? '⏸' : '▶'"
          title="(Space)"
          @click="playbackToggle(isWallpaperVideo ? 'wp-video' : 'media-visual')"
        />
        <UiButton v-if="visualCanNav" label="⏭" title="(Down)" @click="playbackNav('next', 'media-visual')" />
        <UiNumber
          v-if="slideshowOn"
          v-model="slideSeconds"
          :min="0.5"
          :max="3600"
          :step="0.5"
          :precision="1"
          :suffix="t('second')"
        />

        <UiButton
          v-if="visualCanMute"
          :label="visualMuted ? '🔈' : '🔊'"
          title="(M)"
          @click="playbackToggleMute(visualVolumeKey)"
        />
        <input
          v-if="visualHasVolume"
          class="ctrl-range ctrl-volume"
          type="range"
          min="0"
          max="100"
          :value="visualVolume"
          title="(-/+)"
          @input="(e) => onVolumeInput(e, visualVolumeKey)"
          @change="$event.target.blur()"
        />
      </UiRow>

      <UiRow v-if="hasAudio" class="ctrl-block">
        <UiText class="ctrl-slot-label">{{ audioLabel }}</UiText>
        <UiButton v-if="hasAudio" :label="modeLabelOf(audioPlayMode, audioPlayDirection)" :show-shortcut="modeShortcutAudio" @click="playbackCycleMode('media-audio')" />

        <template v-if="hasAudio">
          <input
            class="ctrl-range"
            type="range"
            min="0"
            step="0.1"
            :max="mediaAudioTimeDur || 0"
            :value="mediaAudioTimeCur"
            title="(Left/Right)"
            @input="onAudioSeek"
            @change="$event.target.blur()"
          />
          <span class="ctrl-time">{{ fmtTime(mediaAudioTimeCur) }} / {{ fmtTime(mediaAudioTimeDur) }}</span>
        </template>

        <UiButton v-if="hasAudio" label="⏹" title="(Esc)" @click="playbackStop('media-audio')" />
        <UiButton v-if="hasAudio" label="⏮" title="(Up)" @click="playbackNav('prev', 'media-audio')" />
        <UiButton
          v-if="hasAudio"
          :label="audioPlaying ? '⏸' : '▶'"
          title="(Enter)"
          @click="playbackToggle('media-audio')"
        />
        <UiButton v-if="hasAudio" label="⏭" title="(Down)" @click="playbackNav('next', 'media-audio')" />

        <UiButton
          v-if="hasAudio"
          :label="mediaAudioMuted ? '🔈' : '🔊'"
          title="(M)"
          @click="playbackToggleMute('media-audio')"
        />
        <input
          v-if="hasAudio"
          class="ctrl-range ctrl-volume"
          type="range"
          min="0"
          max="100"
          :value="mediaAudioVolume"
          title="(-/+)"
          @pointerdown="(e) => onVolumePointerDown(e, 'media-audio')"
          @input="(e) => onVolumeInput(e, 'media-audio')"
          @change="$event.target.blur()"
        />
      </UiRow>
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
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 12px;
}
.ui-panel-ctrl--dual-right {
  transform: translateX(-60px);
  flex-direction: column !important;
  flex-wrap: nowrap !important;
  gap: 2px !important;
  width: fit-content !important;
  align-items: flex-end !important;
}

@media (orientation: portrait) {
  .ui-panel-ctrl {
    flex-direction: column;
    width: fit-content;
    max-width: calc(100vw - 24px);
  }
  .ui-panel-ctrl--dual-right {
    transform: translateX(-50%) !important;
    flex-direction: column !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    width: fit-content !important;
  }
  :deep(.ctrl-block) {
    flex-wrap: wrap !important;
  }
}

.ctrl-slot-label {
  padding: 0 6px;
  height: 26px;
  display: inline-flex;
  align-items: center;
}

:deep(.ui-button),
:deep(.ui-switch) {
  height: 26px;
  display: inline-flex;
  align-items: center;
}

.ctrl-range {
  width: 140px;
  accent-color: #fff;
  cursor: pointer;
}
.ctrl-range.ctrl-volume {
  width: 70px;
}
.ctrl-time {
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
}
</style>