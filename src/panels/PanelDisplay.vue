<script setup>
import { computed } from 'vue'
import UiPanel from '../ui/UiPanel.vue'
import UiRow from '../ui/UiRow.vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiCheck from '../ui/UiCheck.vue'
import UiText from '../ui/UiText.vue'
import { t } from '../js/useI18n'
import { optimize } from '../js/usePersist'
import { desktopAlign, desktopAnchor, visualIsVideo, mediaActive, visualOwner, displayMode } from '../js/useVisualOwner'
import { maximized, viewportW, viewportH } from '../js/useViewport'
import { screenW, screenH } from '../js/useScreen'
import { containerW, containerH } from '../js/useVisualContainer'
import { currentWallpaper } from '../js/useWallpaper'
import { viewportRatio, areaRatio, curW, curH, curRatio, isVideoSource, curExcess, setDisplayMode } from '../js/useLayoutMode'


const areaInfo = computed(() => `${containerW.value} x ${containerH.value}`)
const viewportInfo = computed(() => `${viewportW.value} x ${viewportH.value}`)
const curInfo = computed(() => curW.value && curH.value ? `${curW.value} x ${curH.value}` : '')
const viewportAreaDiffers = computed(() => {
  return viewportW.value !== screenW.value || viewportH.value !== screenH.value
})

const curTypeKey = computed(() => {
  const kind = visualOwner.value === 'media-video' || visualOwner.value === 'wallpaper-video'
    ? 'video'
    : 'image'
  const dir = curRatio.value === 'portrait' ? 'portrait' : curRatio.value === 'landscape' ? 'landscape' : ''
  return dir ? dir + (kind === 'video' ? 'Video' : 'Image') : kind
})

const displayOptions = computed(() =>
  ['fill', 'fit', 'center', 'tile', 'stretch'].map((m) => ({
    value: m,
    label: t('mode' + m.charAt(0).toUpperCase() + m.slice(1)),
    disabled: isVideoSource.value && m === 'stretch'
  }))
)

function setDesktopAnchor(v) { desktopAnchor.set(v) }

const cornerOptions = computed(() =>
  ['lt', 'rt', 'lb', 'rb'].map((c) => {
    const map = { lt: '↖', rt: '↗', lb: '↙', rb: '↘' }
    return { value: c, label: map[c] }
  })
)
</script>

<template>
  <UiPanel panel-id="bl" class="ui-panel-bl">
    <UiRow>
      <UiText>
        <template v-if="desktopAlign">
          <template v-if="areaRatio === 'portrait'">{{ t('screenPortrait') }} </template>
          <template v-else-if="areaRatio === 'landscape'">{{ t('screenLandscape') }} </template>
          {{ areaInfo }}
        </template>
        <template v-else>
          <template v-if="viewportRatio === 'portrait'">{{ t('viewportPortrait') }} </template>
          <template v-else-if="viewportRatio === 'landscape'">{{ t('viewportLandscape') }} </template>
          {{ viewportInfo }}
        </template>
      </UiText>
    </UiRow>

    <UiRow v-if="currentWallpaper || mediaActive">
      <UiText>
        {{ t(curTypeKey) }}
        {{ curInfo }}
        <template v-if="curExcess">{{ t(curExcess) }}</template>
      </UiText>
    </UiRow>

    <UiRow v-if="(currentWallpaper || mediaActive) && viewportRatio === 'landscape' && maximized && viewportAreaDiffers">
      <UiCheck
        id="wallpaper-desktop-align"
        v-model="desktopAlign"
        :label="t(visualIsVideo ? 'desktopAlignVideo' : 'desktopAlignImage')"
      />
      <UiSwitch
        :options="cornerOptions"
        :model-value="desktopAnchor"
        :prefix="t('cornerOrigin')"
        @select="setDesktopAnchor"
      />
    </UiRow>

    <UiRow v-if="currentWallpaper || mediaActive">
      <UiSwitch
        :options="displayOptions"
        :model-value="displayMode"
        showShortcut="Z"
        @select="setDisplayMode"
      />
      <UiCheck
        id="wallpaper-optimize"
        v-model="optimize"
        :label="t('optimize')"
      />
    </UiRow>
  </UiPanel>
</template>

<style scoped>
.ui-panel-bl { bottom: 12px; left: 12px; }
</style>