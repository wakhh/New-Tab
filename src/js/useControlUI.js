import { t } from './useI18n'
import { displayLists } from './useMediaLists'
import { itemKey } from '../utils/media'

export function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function modeLabelOf(playMode, playDirection) {
  if (!playMode) return ''
  if (playMode === 'on') return t('loop')
  if (playMode === 'off') return t('noLoop')
  const isReverse = playDirection === 'backward'
  const map = {
    'single-loop': t('playModeSingleLoop'),
    'order-loop': isReverse ? t('playModeReverseLoop') : t('playModeOrderLoop'),
    'shuffle': t('playModeShuffle'),
    'single-play': t('playModeSinglePlay'),
    order: isReverse ? t('playModeReversePlay') : t('playModeOrder')
  }
  return map[playMode] || playMode
}

export function directionLabelOf(playDirection) {
  if (!playDirection) return ''
  return playDirection === 'backward' ? '↑' : '↓'
}

function srcLabel(source) {
  return source === 'network' ? t('mediaNetwork') : t('mediaLocal')
}

export function itemLabel(item) {
  const src = srcLabel(item?.url ? 'network' : 'local')
  const type = item?.type === 'music' ? t('music')
            : item?.type === 'video' ? t('video')
            : t('image')
  return `${src}${type}`
}

export function listIndexLabel(srcKey, item) {
  if (!srcKey || !item) return ''
  const [src, type] = srcKey.split('-')
  const list = displayLists[src]?.[type]?.value
  if (!list?.length) return ''
  const idx = list.findIndex((f) => itemKey(f) === itemKey(item))
  const i = idx >= 0 ? idx + 1 : 0
  return ` ${i}/${list.length}`
}