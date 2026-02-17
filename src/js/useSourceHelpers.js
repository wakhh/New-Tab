import { sourceStates, visualSource, musicSource, selectedSource } from './usePersist'
import { displayLists, shuffleLists } from './useMediaLists'
import { itemId, sourceEquals, sourceOf } from '../utils/media'
import { currentWallpaper } from './useThemeWallpaper'

export function _stateOfSource(source) {
  if (!source) return null
  return sourceStates[source.src]?.[source.type] || null
}

export function stateOfItem(it) {
  if (!it) return null
  return _stateOfSource(sourceOf(it))
}

export function stopSource(source) {
  if (!source) return
  const st = sourceStates[source.src]?.[source.type]
  if (!st) return
}

export function pickPrioritySourceKey({ selectedKey, visualKey, musicKey }) {
  for (const k of [visualKey, musicKey]) {
    if (!k) continue
    if (listOf(k).length > 1) return k
  }
  if (selectedKey && (sourceEquals(selectedKey, visualKey) || sourceEquals(selectedKey, musicKey))) {
    if (listOf(selectedKey).length > 1) return selectedKey
  }
  if (selectedKey) return selectedKey
  return null
}

export function resolveTarget(which, { musicFirst = false } = {}) {
  if (which) return which
  const vsk = visualSource.value
  const ask = musicSource.value
  const visualCands = vsk ? ['media-visual'] : []
  if (currentWallpaper.value?.isVideo) visualCands.push('wp-video')
  const musicCands = ask ? ['media-music'] : []
  const order = musicFirst ? [...musicCands, ...visualCands] : [...visualCands, ...musicCands]
  return order[0] || null
}

export function navTargetSource(which) {
  if (which === 'media-music') return musicSource.value
  if (which === 'media-visual') return visualSource.value
  if (which === 'wp-video') return null
  return pickPrioritySourceKey({
    selectedKey: selectedSource.value,
    visualKey: visualSource.value,
    musicKey: musicSource.value
  })
}

export function listOf(source) {
  if (!source) return []
  return displayLists[source.src]?.[source.type]?.value || []
}

export function shuffleListOf(source) {
  if (!source) return []
  return shuffleLists[source.src]?.[source.type]?.value || []
}