<script setup>
import { computed } from 'vue'
import UiPanel from '../ui/UiPanel.vue'
import UiRow from '../ui/UiRow.vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiCheck from '../ui/UiCheck.vue'
import UiText from '../ui/UiText.vue'
import { t } from '../js/useI18n'
import { optimize } from '../js/usePersist'
import { displayMode, desktopAlign, desktopAnchor } from '../js/useVisualState'
import { videoOn, mediaVisualOn, visualType } from '../js/useSourceState'
import { maximized, viewportW, viewportH ,screenW, screenH, containerW, containerH } from '../js/useVisualState'
import { currentWallpaper } from '../js/useThemeWallpaper'
import { viewportRatio, areaRatio, curW, curH, curRatio, isvideoType, curExcess, setDisplayMode } from '../js/useLayoutMode'
import { tileVideoCount } from '../js/useTileLayout'

const _SUPERSCRIPT = ['⁰','¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹']
function _toSuperscript(n) {
  return String(n).split('').map(d => _SUPERSCRIPT[+d] || d).join('')
}

const tileLabel = computed(() => {
  const base = t('modeTile')
  if (!isvideoType.value || tileVideoCount.value <= 1) return base
  return base + _toSuperscript(tileVideoCount.value)
})


const areaInfo = computed(() => `${containerW.value} x ${containerH.value}`)
const viewportInfo = computed(() => `${viewportW.value} x ${viewportH.value}`)
const curInfo = computed(() => curW.value && curH.value ? `${curW.value} x ${curH.value}` : '')
const viewportAreaDiffers = computed(() => {
  return viewportW.value !== screenW.value || viewportH.value !== screenH.value
})

const curTypeKey = computed(() => {
  const kind = visualType.value === 'media-video' || visualType.value === 'wallpaper-video'
    ? 'video'
    : 'image'
  const dir = curRatio.value === 'portrait' ? 'portrait' : curRatio.value === 'landscape' ? 'landscape' : ''
  return dir ? dir + (kind === 'video' ? 'Video' : 'Image') : kind
})

const displayOptions = computed(() =>
  ['fill', 'fit', 'center', 'stretch', 'tile'].map((m) => ({
    value: m,
    label: m === 'tile' ? tileLabel.value : t('mode' + m.charAt(0).toUpperCase() + m.slice(1)),
    disabled: isvideoType.value && m === 'stretch'
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

    <UiRow v-if="currentWallpaper || mediaVisualOn">
      <UiText>
        {{ t(curTypeKey) }}
        {{ curInfo }}
        <template v-if="curExcess">{{ t(curExcess) }}</template>
      </UiText>
    </UiRow>

    <UiRow v-if="(currentWallpaper || mediaVisualOn) && viewportRatio === 'landscape' && maximized && viewportAreaDiffers">
      <UiCheck
        id="wallpaper-desktop-align"
        v-model="desktopAlign"
        :label="t(videoOn ? 'desktopAlignVideo' : 'desktopAlignImage')"
      />
      <UiSwitch
        :options="cornerOptions"
        :model-value="desktopAnchor"
        :prefix="t('cornerOrigin')"
        @select="setDesktopAnchor"
      />
    </UiRow>

    <UiRow v-if="currentWallpaper || mediaVisualOn">
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