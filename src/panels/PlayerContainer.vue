<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  optimize,
  mediaAudioMuted,
  mediaVideoMuted, wpVideoMuted,
   videoLoop, visualPaused, wpVideoPlaying
} from '../js/usePersist'
import { containerW, containerH } from '../js/useVisualContainer'
import { handleError, onAudioEnded } from '../js/usePlaybackLifecycle'
import { currentWallpaper } from '../js/useWallpaper'
import { mediaUrl } from '../utils/media'
import { floatIcon } from '../js/useFloatIcon'
import '../js/usePlayerSync'
import {
  visualItem, slideshowOn, mediaActive,
  videoOwner, imageOwner, visualIsVideo, visualIsImage, displayMode,
  desktopAlign, desktopAnchor
} from '../js/useVisualOwner'
import { audioItem } from '../js/useAudioOwner'
import {
  mediaItemW, mediaItemH, inited, videoPosters,
  bindMediaVideo, bindAudioEl,
  onMediaLoad, onVideoEndedLocal, onVideoTimeUpdate,
  onVideoError, onImageError
} from '../js/useVideoElement'
import { playbackToggle } from '../js/usePlaybackActions'
import { showFloatIcon } from '../js/useFloatIcon'
import { onLayerWheel } from '../js/useViewportInput'
import {
  videoTileMode, videoTileStyle, tileCanvasStyle,
  setupTileCanvas, onVisChange as tileOnVisChange
} from '../js/useTileLayout'
import { mediaVideoEl } from '../js/usePlaybackState'
import { getBlurBgCache, startVideoBlurLoop, stopVideoBlurLoop, resetBlurBgCache } from '../js/useBlurBg.js'

const tileCanvasRef = ref(null)
const fitBlurCanvasRef = ref(null)

const displayClass = computed(() => 'mode-' + displayMode.value)

const videoSrc = computed(() => {
  const owner = videoOwner.value
  if (owner === 'media') return mediaUrl(visualItem.value)
  if (owner === 'wallpaper') return currentWallpaper.value.url
  return ''
})
const videoMuted = computed(() => {
  const owner = videoOwner.value
  if (owner === 'media') return mediaVideoMuted.value
  if (owner === 'wallpaper') return wpVideoMuted.value
  return true
})
const videoElemLoop = computed(() => {
  const owner = videoOwner.value
  if (owner === 'wallpaper') return videoLoop.value
  return false
})

setupTileCanvas(tileCanvasRef)

const onAudioError = () => handleError('music', audioItem.value)

function toggleVideoClick(e) {
  const owner = videoOwner.value
  let target = null
  let isPlaying = null
  if (owner === 'media' || slideshowOn.value) {
    target = 'media-visual'
    isPlaying = !visualPaused.value
  } else if (owner === 'wallpaper') {
    target = 'wp-video'
    isPlaying = wpVideoPlaying.value
  }
  if (target) {
    playbackToggle(target, { skipIcon: true })
    const icon = isPlaying ? '▶' : '⏸'
    showFloatIcon(icon, e.clientX, e.clientY)
  }
}

const tileSrc = ref('')

function tileLayerStyle(src) {
  if (!src) return {}
  return {
    backgroundImage: `url(${src})`,
    backgroundRepeat: 'repeat',
    backgroundPosition: optimize.value ? 'center top' : 'left top',
    backgroundSize: optimize.value ? 'contain' : 'auto'
  }
}

watch(
  () => {
    if (mediaActive.value) {
      return visualIsImage.value && displayMode.value === 'tile' ? mediaUrl(visualItem.value) : ''
    }
    const c = currentWallpaper.value
    return c && !c.isVideo && displayMode.value === 'tile' ? c.url : ''
  },
  (url) => { tileSrc.value = url || '' },
  { immediate: true }
)

function getLayerStyle() {
  if (!desktopAlign.value) return {}
  const w = containerW.value
  const h = containerH.value
  const area = { inset: 'auto', width: `${w}px`, height: `${h}px` }
  switch (desktopAnchor.value) {
    case 'lb': return { ...area, left: 0, bottom: 0 }
    case 'lt': return { ...area, left: 0, top: 0 }
    case 'rt': return { ...area, right: 0, top: 0 }
    default: return { ...area, right: 0, bottom: 0 }
  }
}

function _canSkipBlur() {
  const lw = mediaItemW.value
  const lh = mediaItemH.value
  const cw = containerW.value
  const ch = containerH.value
  if (!lw || !lh || !cw || !ch) return false
  if (displayMode.value === 'fit') {
    return Math.abs(lw / lh - cw / ch) < 1e-4
  }
  if (displayMode.value === 'center') {
    return lw >= cw && lh >= ch
  }
  return false
}

function getShowBlur() {
  if (!optimize.value) return false
  const m = displayMode.value
  if (m !== 'fit' && m !== 'center') return false
  if (_canSkipBlur()) return false
  if (mediaActive.value) {
    if (visualIsVideo.value) return !!(videoPosters.value.media || videoPosters.value.media_url)
    return mediaItemW.value > 0 || mediaItemH.value > 0
  }
  if (currentWallpaper.value?.isVideo) return !!videoPosters.value.wallpaper
  return currentWallpaper.value && (mediaItemW.value > 0 || mediaItemH.value > 0)
}

const showDynamicBlur = computed(() => {
  if (!optimize.value) return false
  const m = displayMode.value
  if (m !== 'fit' && m !== 'center') return false
  if (_canSkipBlur()) return false
  if (mediaActive.value) return visualIsVideo.value
  return !!currentWallpaper.value?.isVideo
})

function getBlurSrc() {
  if (!getShowBlur()) return ''
  if (mediaActive.value) {
    if (visualIsVideo.value) return videoPosters.value.media || videoPosters.value.media_url
    return visualIsImage.value ? mediaUrl(visualItem.value) : ''
  }
  return currentWallpaper.value?.isVideo ? videoPosters.value.wallpaper : currentWallpaper.value?.url || ''
}

const imgSrc = ref('')

watch(
  () => {
    if (imageOwner.value === 'slideshow') return { kind: 'slideshow', src: mediaUrl(visualItem.value) }
    if (imageOwner.value === 'wallpaper') return { kind: 'wallpaper', src: currentWallpaper.value.url }
    return null
  },
  (disp) => { imgSrc.value = disp?.src || '' },
  { immediate: true }
)

function onVisChange() {
  tileOnVisChange(tileCanvasRef)
  if (document.hidden) stopVideoBlurLoop()
  else if (showDynamicBlur.value) startFitBlurLoop()
}

function startFitBlurLoop() {
  const canvas = fitBlurCanvasRef.value
  const el = mediaVideoEl.value
  if (!canvas || !el) {
    nextTick(() => {
      if (showDynamicBlur.value) startFitBlurLoop()
    })
    return
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cssW = Math.round(containerW.value)
  const cssH = Math.round(containerH.value)
  if (canvas.width !== cssW * dpr) canvas.width = cssW * dpr
  if (canvas.height !== cssH * dpr) canvas.height = cssH * dpr
  const ctx = canvas.getContext('2d')
  startVideoBlurLoop(el, () => {
    if (!showDynamicBlur.value) return
    const w = Math.round(containerW.value)
    const h = Math.round(containerH.value)
    const d = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas.width !== w * d) canvas.width = w * d
    if (canvas.height !== h * d) canvas.height = h * d
    const blur = getBlurBgCache(el, mediaItemW.value, mediaItemH.value, w, h, d)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(blur, 0, 0)
  })
}

function stopFitBlurLoop() {
  stopVideoBlurLoop()
}

watch([showDynamicBlur, fitBlurCanvasRef, mediaVideoEl], ([on]) => {
  resetBlurBgCache()
  if (on) startFitBlurLoop()
  else stopFitBlurLoop()
}, { immediate: true })

onMounted(() => {
  document.addEventListener('visibilitychange', onVisChange)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisChange)
  stopFitBlurLoop()
})
</script>

<template>
  <div ref="layerEl" class="player-container" :style="getLayerStyle()" @wheel="onLayerWheel" @click="toggleVideoClick">
    <canvas v-if="showDynamicBlur" ref="fitBlurCanvasRef" class="fit-blur-canvas"></canvas>
    <div v-else-if="getBlurSrc()" class="blur-fill">
      <img :src="getBlurSrc()" draggable="false" />
    </div>

    <div v-if="inited" class="video-tile-wrap" :class="{ 'video-tile-wrap--active': videoTileMode }">
      <video
        :ref="bindMediaVideo"
        :class="displayClass"
        :style="videoTileStyle"
        :muted="videoMuted"
        :loop="videoElemLoop"
        :src="videoSrc"
        playsinline
        preload="auto"
        disablepictureinpicture
        controlslist="nodownload nofullscreen noremoteplayback"
        draggable="false"
        @loadeddata="onMediaLoad"
        @loadedmetadata="onVideoTimeUpdate"
        @timeupdate="onVideoTimeUpdate"
        @ended="onVideoEndedLocal"
        @error="onVideoError"
      ></video>
      <canvas v-if="videoTileMode" ref="tileCanvasRef" class="video-tile-canvas" :style="tileCanvasStyle"></canvas>
    </div>

    <audio :ref="bindAudioEl" class="media-audio" :src="audioItem ? mediaUrl(audioItem) : ''" :muted="mediaAudioMuted" @ended="onAudioEnded" @error="onAudioError" />

    <div v-show="imageOwner === 'wallpaper' || imageOwner === 'slideshow'" class="img-stack">
      <img
        :src="imgSrc"
        :class="displayClass"
        class="img-fade"
        draggable="false"
        @load="onMediaLoad"
        @error="onImageError"
      />
    </div>

    <div v-show="tileSrc" class="tile-stack">
      <div class="tile-bg" :style="tileLayerStyle(tileSrc)" />
    </div>

    <Transition name="float-icon">
      <div
        v-if="floatIcon"
        class="float-icon"
        :key="floatIcon.key"
        :style="{ left: floatIcon.x + 'px', top: floatIcon.y + 'px' }"
      >
        {{ floatIcon.icon }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.player-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 0;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.player-container img,
.player-container video {
  width: 100%;
  height: 100%;
  display: block;
}

.img-stack,
.tile-stack {
  position: absolute;
  inset: 0;
}

.img-fade,
.tile-bg {
  position: absolute;
  inset: 0;
  transition: none;
}

.mode-fill {
  object-fit: cover;
}

.mode-fit {
  object-fit: contain;
}

.mode-stretch {
  object-fit: fill;
}

.video-tile-wrap {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.video-tile-wrap--active > video {
  position: absolute;
  pointer-events: auto;
  object-fit: fill;
  z-index: 2;
}
.video-tile-canvas {
  position: absolute;
  inset: 0;
  display: block;
  z-index: 1;
}

.mode-center {
  object-fit: none;
  object-position: center;
}

.fit-blur-canvas {
  position: absolute;
  inset: 0;
  z-index: -1;
  display: block;
  pointer-events: none;
}

.blur-fill {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.blur-fill img {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: translate(-50%, -50%) scale(1.15);
  filter: blur(24px);
}

.player-container video {
  pointer-events: none;
}
.player-container .media-audio {
  display: none;
}
.float-icon {
  position: fixed;
  transform: translate(-50%, -50%);
  font-size: 72px;
  color: var(--panel-text);
  text-shadow: -1px -1px 0 var(--panel-bg), 1px -1px 0 var(--panel-bg), -1px 1px 0 var(--panel-bg), 1px 1px 0 var(--panel-bg), 0 2px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 100;
  line-height: 1;
}
.float-icon-enter-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.float-icon-leave-active {
  transition: opacity 300ms ease, transform 300ms ease;
}
.float-icon-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.6);
}
.float-icon-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(1.2);
}
</style>