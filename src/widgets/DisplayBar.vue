<script setup>
import { computed } from 'vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiCheck from '../ui/UiCheck.vue'
import UiText from '../ui/UiText.vue'
import UiButton from '../ui/UiButton.vue'
import { t } from '../js/i18n'
import { displayOptimize, mediaRotateMap } from '../js/persist'
import { displayMode, desktopAlign, desktopAnchor, canDesktopAlign, viewportW, viewportH, containerW, containerH, currentWallpaper, viewportRatio, areaRatio, curW, curH, curRatio, curExcess, setDisplayMode, tileVideoCount, videoOn, mediaVisualOn, visualType, getRotateKey } from '../js/core'

// ====== 标签工具 ======
const _SUPERSCRIPT = ['⁰','¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹']
function _toSuperscript(n) {
  return String(n).split('').map(d => _SUPERSCRIPT[+d] || d).join('')
}

const tileLabel = computed(() => {
  const base = t('modeTile')
  if (!videoOn.value || tileVideoCount.value <= 1) return base
  return base + _toSuperscript(tileVideoCount.value)
})


const areaInfo = computed(() => `${containerW.value} x ${containerH.value}`)
const viewportInfo = computed(() => `${viewportW.value} x ${viewportH.value}`)
const curInfo = computed(() => curW.value && curH.value ? `${curW.value} x ${curH.value}` : '')

const curTypeKey = computed(() => {
  const kind = visualType.value === 'media-video' || visualType.value === 'wallpaper-video'
    ? 'video'
    : 'image'
  const dir = curRatio.value === 'portrait' ? 'portrait' : curRatio.value === 'landscape' ? 'landscape' : ''
  if (dir) return dir + (kind === 'video' ? 'Video' : 'Image')
  return kind + 'Resolution'
})

// ====== 显示选项 ======
const displayOptions = computed(() =>
  ['fill', 'fit', 'center', 'stretch', 'tile'].map((m) => ({
    value: m,
    label: m === 'tile' ? tileLabel.value : t('mode' + m.charAt(0).toUpperCase() + m.slice(1)),
    disabled: videoOn.value && m === 'stretch'
  }))
)

const cornerOptions = computed(() =>
  ['lt', 'rt', 'lb', 'rb'].map((c) => {
    const map = { lt: '↖', rt: '↗', lb: '↙', rb: '↘' }
    return { value: c, label: map[c] }
  })
)

const canRotate = computed(() => !!(currentWallpaper || mediaVisualOn))
const curRotate = computed(() => {
  const k = getRotateKey()
  if (!k) return 0
  const v = mediaRotateMap.value[k]
  return v === 90 || v === 180 || v === 270 ? v : 0
})
function clickRotate() {
  if (!canRotate.value) return
  const k = getRotateKey()
  if (!k) return
  const old = curRotate.value
  const next = (old + 90) % 360
  if (next === 0) {
    const copy = { ...mediaRotateMap.value }
    delete copy[k]
    mediaRotateMap.set(copy)
  } else {
    mediaRotateMap.set({ ...mediaRotateMap.value, [k]: next })
  }
}
</script>

<template>
  <div class="ui-widget" data-widget-id="bl">
    <div class="ui-row">
      <UiText>
        <template v-if="desktopAlign">
          <template v-if="areaRatio === 'portrait'">{{ t('screenPortrait') }} </template>
          <template v-else-if="areaRatio === 'landscape'">{{ t('screenLandscape') }} </template>
          <template v-else>{{ t('screenResolution') }} </template>
          {{ areaInfo }}
        </template>
        <template v-else>
          <template v-if="viewportRatio === 'portrait'">{{ t('viewportPortrait') }} </template>
          <template v-else-if="viewportRatio === 'landscape'">{{ t('viewportLandscape') }} </template>
          <template v-else>{{ t('viewportResolution') }} </template>
          {{ viewportInfo }}
        </template>
      </UiText>
    </div>

    <div class="ui-row" v-if="currentWallpaper || mediaVisualOn">
      <UiText>
        {{ t(curTypeKey) }}
        {{ curInfo }}
        <template v-if="curExcess">{{ t(curExcess) }}</template>
      </UiText>
      <UiButton v-if="canRotate" :label="curRotate ? '↺ ' + curRotate + '°' : '↺'" :title="t('rotateCCW')" @click="clickRotate" />
    </div>

    <div class="ui-row" v-if="(currentWallpaper || mediaVisualOn) && canDesktopAlign">
      <UiCheck
        id="wallpaper-desktop-align"
        v-model="desktopAlign"
        :label="t(videoOn ? 'desktopAlignVideo' : 'desktopAlignImage')"
      />
      <UiSwitch
        :options="cornerOptions"
        :prefix="t('cornerOrigin')"
        cycle
        v-model="desktopAnchor"
      />
    </div>

    <div class="ui-row" v-if="currentWallpaper || mediaVisualOn">
      <UiSwitch
        :options="displayOptions"
        :model-value="displayMode"
        showShortcut="Z"
        @select="setDisplayMode"
      />
      <UiCheck
        id="wallpaper-displayOptimize"
        v-model="displayOptimize"
        :label="t('displayOptimize')"
      />
    </div>
  </div>
</template>

<style scoped>
</style>