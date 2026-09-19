<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  mediaMusicMuted,
  mediaVideoMuted, wpVideoMuted,
  videoLoop, videoPaused, musicPaused, mediaVisualSource,
  _desktopAlignImage, _desktopAlignVideo, displayOptimize
} from '../js/usePersist'
import { containerW, containerH, isPortrait, displayMode,
  desktopAlign, desktopAnchor } from '../js/useVisualState'
import { currentWallpaper, wpMediaInfo } from '../js/useThemeWallpaper'
import { mediaUrl, sourceOf } from '../utils/media'
import {
  mediaVisualItem, mediaVisualOn,
  videoType, imgType, videoOn, imageOn, musicItem
} from '../js/useSourceState'
import {
  visualItemW, visualItemH, videoSnapshots, videoEl
} from '../js/useVideoElement'
import { musicEl } from '../js/useAudioElement'
import { getMode, MODES } from '../js/usePlayMode'
import { pickNextItem, navigate } from '../js/useItemNav'
import { stopSource } from '../js/useSourceHelpers'
import { onLayerWheel as tileOnLayerWheel } from '../js/useLayerWheel'
import { scale, tx, ty, resetZoom, imgNatural, imgBaseRect } from '../js/useImageZoom'
import { handleLayerWheel as interactHandleLayerWheel, onLayerMouseDown, onLayerClick as interactOnLayerClick } from '../js/useImageInteract'
import {
  videoTileMode, videoTileStyle, tileCanvasStyle,
  setupTileCanvas, onVisChange as tileOnVisChange
} from '../js/useTileLayout'
import { showDynamicBlur, getBlurSrc, startFitBlurLoop as _startFitBlurLoop, stopFitBlurLoop, onVisChange as _onVisChange, resetBlurBgCache } from '../js/useBlurBg'

function bindVideoEl(el) {
  videoEl.value = el
}

function bindMusicEl(el) {
  musicEl.value = el
}

function captureVideoFrame(el, owner) {
  if (!el || el.readyState < 2) return
  const w = el.videoWidth, h = el.videoHeight
  if (!w || !h) return
  const url = el.getAttribute('src')
  if (!url) return
  requestAnimationFrame(() => {
    if (videoSnapshots.value[owner] && videoSnapshots.value[owner + '_url'] === url) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(el, 0, 0, w, h)
      videoSnapshots.value = {
        ...videoSnapshots.value,
        [owner]: canvas.toDataURL('image/jpeg', 0.7),
        [owner + '_url']: url
      }
    } catch (e) {}
  })
}

function onMediaLoad(e) {
  const el = e?.target
  if (!el) return
  const w = el.videoWidth || el.naturalWidth || 0
  const h = el.videoHeight || el.naturalHeight || 0
  visualItemW.value = w; visualItemH.value = h; wpMediaInfo.value = { w, h }
  if (videoType.value === 'media' && mediaVisualItem.value?.type === 'video') captureVideoFrame(el, 'media')
  if (currentWallpaper.value?.isVideo) captureVideoFrame(el, 'wallpaper')
}

function _handleEnded(type, item) {
  if (!item) return
  const source = sourceOf(item)
  const mode = getMode(source)
  if (mode === MODES.SINGLE_LOOP) {
    const el = type === 'music' ? musicEl.value : videoEl.value
    if (el) { el.currentTime = 0; el.play()?.catch(() => {}) }
    return
  }
  const target = pickNextItem(source, item, null, mode)
  if (!target) {
    if (mode === MODES.SINGLE_PLAY) { stopSource(source); return }
    navigate(source, null)
    return
  }
  navigate(source, target)
}

function _handleError(type, item) {
  if (!item) return
  const source = sourceOf(item)
  const mode = getMode(source)
  if (mode === MODES.SINGLE_PLAY || mode === MODES.SINGLE_LOOP) { stopSource(source); return }
  _handleEnded(type, item)
}

function onVideoEndedLocal(e) {
  const el = e?.target || videoEl.value
  if (el && el.currentTime === 0 && (el.duration === 0 || el.readyState < 2)) return
  const owner = videoType.value
  if (owner === 'media') _handleEnded('video', mediaVisualItem.value)
}

function onVideoError() {
  if (videoType.value === 'media') _handleError('video', mediaVisualItem.value)
}

function onImageError() {
  if (mediaVisualItem.value?.type === 'image') _handleError('image', mediaVisualItem.value)
}

function onMusicEnded() {
  if (musicItem.value) _handleEnded('music', musicItem.value)
}

const tileCanvasRef = ref(null)
const fitBlurCanvasRef = ref(null)
const imgElRef = ref(null)
const layerEl = ref(null)

const imgZoomWrapStyle = computed(() => {
  const isimgType = imgType.value === 'media' || imgType.value === 'wallpaper'
  if (!isimgType) return ''
  const r = imgBaseRect.value
  return {
    position: 'absolute',
    left: r.x + 'px',
    top: r.y + 'px',
    width: r.w + 'px',
    height: r.h + 'px',
    transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`,
    transformOrigin: '0 0'
  }
})

function handleLayerWheel(e) {
  if (interactHandleLayerWheel(e) === true) tileOnLayerWheel(e)
}

function _windowWheelCapture(e) {
  if (e.ctrlKey) {
    e.preventDefault()
    const layer = layerEl.value
    if (!layer) return
    const t = e.target
    if (t && typeof t.closest === 'function') {
      if (t.closest('.icon-cell')) return
      if (t.closest('.ctx-menu')) return
      if (t.closest('.dialog-overlay')) return
      if (t.closest('.ui-widget')) return
      if (t.closest('.float-icon')) return
    }
    if (interactHandleLayerWheel(e, layer) === true) tileOnLayerWheel(e)
    return
  }
  const t = e.target
  if (t && typeof t.closest === 'function') {
    if (t.closest('.icon-cell')) return
    if (t.closest('.ctx-menu')) return
    if (t.closest('.dialog-overlay')) return
    if (t.closest('.ui-widget')) return
    if (t.closest('.float-icon')) return
  }
  const layer = layerEl.value
  if (!layer) return
  if (interactHandleLayerWheel(e, layer) === true) tileOnLayerWheel(e)
}

function _windowMouseDownCapture(e) {
  if (e.button !== 0) return
  const t = e.target
  if (t && typeof t.closest === 'function') {
    if (t.closest('.icon-cell')) return
    if (t.closest('.ctx-menu')) return
    if (t.closest('.dialog-overlay')) return
    if (t.closest('.ui-widget')) return
    if (t.closest('.float-icon')) return
  }
  const layer = layerEl.value
  if (!layer) return
  onLayerMouseDown(e, layer)
}

function onLayerClick(e) { interactOnLayerClick(e) }

const displayClass = computed(() => 'mode-' + displayMode.value)

function onImgLoad() {
  const el = imgElRef.value
  if (!el) return
  const w = el.naturalWidth
  const h = el.naturalHeight
  imgNatural.value = { w, h }
  if (mediaVisualOn.value && imageOn.value) {
    visualItemW.value = w
    visualItemH.value = h
  } else if (imgType.value === 'wallpaper') {
    wpMediaInfo.value = { w, h }
  }
}

const videoSrc = computed(() => {
  const owner = videoType.value
  if (owner === 'media') return mediaUrl(mediaVisualItem.value)
  if (owner === 'wallpaper') return currentWallpaper.value.url
  return ''
})
const videoMuted = computed(() => {
  const owner = videoType.value
  if (owner === 'media') return mediaVideoMuted.value
  if (owner === 'wallpaper') return wpVideoMuted.value
  return true
})
const videoElemLoop = computed(() => {
  const owner = videoType.value
  if (owner === 'wallpaper') return videoLoop.value
  return false
})

setupTileCanvas(tileCanvasRef)

const onMusicError = () => _handleError('music', musicItem.value)

const tileSrc = ref('')

const tileLayerStyle = computed(() => {
  const src = tileSrc.value
  if (!src) return {}
  const useContain = displayOptimize.value
  let bgSize = 'auto'
  if (useContain) {
    const iw = imgNatural.value.w
    const ih = imgNatural.value.h
    const cw = containerW.value
    const ch = containerH.value
    if (iw && ih && cw && ch) {
      const scale = Math.min(cw / iw, ch / ih)
      bgSize = `${Math.round(iw * scale)}px ${Math.round(ih * scale)}px`
    }
  }
  return {
    backgroundImage: `url(${src})`,
    backgroundRepeat: 'repeat',
    backgroundPosition: useContain ? 'center' : '0 0',
    backgroundSize: bgSize
  }
})

watch(
  () => {
    if (mediaVisualOn.value) {
      return imageOn.value && displayMode.value === 'tile' ? mediaUrl(mediaVisualItem.value) : ''
    }
    const c = currentWallpaper.value
    return c && !c.isVideo && displayMode.value === 'tile' ? c.url : ''
  },
  (url) => { tileSrc.value = url || '' },
  { immediate: true }
)

watch(desktopAlign, () => {
  tileSrc.value = tileSrc.value ? tileSrc.value + ' ' : tileSrc.value
  tileSrc.value = tileSrc.value.trim()
})

const LAYER_OFF_X = 3.5
const LAYER_OFF_Y = 5.5

const layerStyle = computed(() => {
  if (!desktopAlign.value) return {}
  const w = containerW.value
  const h = containerH.value
  const ox = -LAYER_OFF_X + 'px'
  const oy = -LAYER_OFF_Y + 'px'
  const area = { inset: 'auto', width: `${w}px`, height: `${h}px` }
  switch (desktopAnchor.value) {
    case 'lb': return { ...area, left: ox, bottom: oy }
    case 'lt': return { ...area, left: ox, top: oy }
    case 'rt': return { ...area, right: ox, top: oy }
    default: return { ...area, right: ox, bottom: oy }
  }
})

function startFitBlurLoop() { _startFitBlurLoop(fitBlurCanvasRef.value) }
function onVisChange() { _onVisChange(tileOnVisChange, tileCanvasRef) }

const imgSrc = ref('')

watch(
  () => {
    if (imgType.value === 'media') return { kind: 'media-img', src: mediaUrl(mediaVisualItem.value) }
    if (imgType.value === 'wallpaper') return { kind: 'wallpaper', src: currentWallpaper.value.url }
    return null
  },
  (disp) => { imgSrc.value = disp?.src || '' },
  { immediate: true }
)

watch([() => mediaVisualItem.value, () => imgType.value, () => currentWallpaper.value?.url, () => displayMode.value], () => {
  resetZoom()
})

watch([showDynamicBlur, fitBlurCanvasRef, videoEl], ([on]) => {
  resetBlurBgCache()
  if (on) startFitBlurLoop()
  else stopFitBlurLoop()
}, { immediate: true })

onMounted(() => {
  document.addEventListener('visibilitychange', onVisChange)
  document.addEventListener('wheel', _windowWheelCapture, { capture: true, passive: false })
  window.addEventListener('mousedown', _windowMouseDownCapture, { capture: true })
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisChange)
  document.removeEventListener('wheel', _windowWheelCapture, { capture: true })
  window.removeEventListener('mousedown', _windowMouseDownCapture, { capture: true })
  stopFitBlurLoop()
})
</script>

<template>
  <div ref="layerEl" class="player-container" :style="layerStyle" @click="onLayerClick">
    <canvas v-if="showDynamicBlur" ref="fitBlurCanvasRef" class="fit-blur-canvas"></canvas>
    <div v-else-if="getBlurSrc()" class="blur-fill">
      <img :src="getBlurSrc()" draggable="false" />
    </div>

    <div v-show="videoSrc" class="video-tile-wrap" :class="{ 'video-tile-wrap--active': videoTileMode }">
      <video
        :ref="bindVideoEl"
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
        @ended="onVideoEndedLocal"
        @error="onVideoError"
      ></video>
      <canvas v-if="videoTileMode" ref="tileCanvasRef" class="video-tile-canvas" :style="tileCanvasStyle"></canvas>
    </div>

    <audio :ref="bindMusicEl" class="media-music" :src="musicItem ? mediaUrl(musicItem) : ''" :muted="mediaMusicMuted" @ended="onMusicEnded" @error="onMusicError" />

    <div v-show="(imgType === 'wallpaper' || imgType === 'media') && displayMode !== 'tile'" class="img-stack">
      <div :style="imgZoomWrapStyle">
        <img
          ref="imgElRef"
          :src="imgSrc"
          class="img-fade"
          draggable="false"
          @load="onImgLoad"
          @error="onImageError"
        />
      </div>
    </div>

    <div v-show="tileSrc" class="tile-stack">
      <div class="tile-bg" :style="tileLayerStyle" />
    </div>

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

.img-fade {
  width: 100%;
  height: 100%;
  display: block;
  transition: none;
}

.tile-bg {
  position: absolute;
  inset: 0;
  transition: none;
  transform-origin: 0 0;
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

.mode-fill {
  object-fit: cover;
}

.mode-fit {
  object-fit: contain;
}

.mode-stretch {
  object-fit: fill;
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
.player-container .media-music {
  display: none;
}
</style>