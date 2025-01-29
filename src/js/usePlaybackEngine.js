import { sourceStates } from './usePersist'
import { itemKey, itemSourceKeyOf } from '../utils/media'
import { displayLists, shuffleLists } from './useMediaLists'

function _idxOf(list, item) {
  if (!item) return -1
  const k = itemKey(item)
  return list.findIndex((f) => itemKey(f) === k)
}

export const MODES = {
  ORDER: 'order',
  ORDER_LOOP: 'order-loop',
  SHUFFLE: 'shuffle',
  SINGLE_PLAY: 'single-play',
  SINGLE_LOOP: 'single-loop'
}

export const DIR = { FORWARD: 'forward', BACKWARD: 'backward' }

export const PLAY_MODES = [
  MODES.ORDER_LOOP,
  MODES.SHUFFLE,
  MODES.ORDER,
  MODES.SINGLE_LOOP,
  MODES.SINGLE_PLAY
]

export function modeForKey(key) {
  if (!key) return MODES.ORDER_LOOP
  const [src, type] = key.split('-')
  return sourceStates?.[src]?.[type]?.playMode?.value || MODES.ORDER_LOOP
}

export function dirForKey(key) {
  if (!key) return DIR.FORWARD
  const [src, type] = key.split('-')
  return sourceStates?.[src]?.[type]?.playDirection?.value || DIR.FORWARD
}

export function stateOfItem(it) {
  if (!it) return null
  const ks = itemSourceKeyOf(it)
  if (!ks) return null
  const [src, type] = ks.split('-')
  return sourceStates?.[src]?.[type] || null
}

export function listOf(srcKey) {
  if (!srcKey) return []
  const [src, type] = srcKey.split('-')
  return displayLists[src]?.[type]?.value || []
}

export function shuffleListOf(srcKey) {
  if (!srcKey) return []
  const [src, type] = srcKey.split('-')
  return shuffleLists[src]?.[type]?.value || []
}

export function pickNextItem(srcKey, item, dir = 'next', mode, direction) {
  if (!srcKey) return null
  const m = mode || modeForKey(srcKey)
  const d = direction ?? dirForKey(srcKey)

  const isAuto = dir === null

  if (m === MODES.SINGLE_LOOP && isAuto) return item || null
  if (m === MODES.SINGLE_PLAY && isAuto) return null

  if (m === MODES.SHUFFLE) {
    return _pickShuffle(srcKey, item, dir, d)
  }

  const isLoop = m === MODES.ORDER_LOOP || (isAuto ? false : (m === MODES.SINGLE_LOOP || m === MODES.SINGLE_PLAY))
  return _pickLinear(srcKey, item, dir, d, isLoop)
}

function _pickLinear(srcKey, item, userDir, autoDir, isLoop) {
  const list = listOf(srcKey)
  if (!list.length) return null

  if (list.length === 1) return isLoop ? list[0] : null

  const effDir = userDir || (autoDir === DIR.BACKWARD ? 'prev' : 'next')
  const isNext = effDir !== 'prev'

  const curIdx = _idxOf(list, item)
  let nextIdx = isNext ? curIdx + 1 : curIdx - 1

  if (nextIdx < 0) {
    if (!isLoop) return null
    nextIdx = list.length - 1
  } else if (nextIdx >= list.length) {
    if (!isLoop) return null
    nextIdx = 0
  }

  return list[nextIdx] || null
}

function _pickShuffle(srcKey, item, userDir, autoDir) {
  const shuffled = shuffleListOf(srcKey)
  if (!shuffled.length) return listOf(srcKey)[0] || null
  if (!item) return shuffled[0]

  const curKey = itemKey(item)
  let idx = shuffled.findIndex((f) => itemKey(f) === curKey)
  if (idx < 0) {
    idx = Math.floor(Math.random() * shuffled.length)
  } else {
    const effDir = userDir || (autoDir === DIR.BACKWARD ? 'prev' : 'next')
    idx += (effDir === 'prev' ? -1 : 1)
    if (idx < 0) idx = shuffled.length - 1
    else if (idx >= shuffled.length) idx = 0
  }
  return shuffled[idx] || null
}

export function pickPrioritySourceKey({ selectedKey, visualKey, audioKey }) {
  for (const k of [visualKey, audioKey]) {
    if (!k) continue
    if (listOf(k).length > 1) return k
  }
  if (selectedKey && (selectedKey === visualKey || selectedKey === audioKey)) {
    if (listOf(selectedKey).length > 1) return selectedKey
  }
  if (selectedKey) return selectedKey
  return null
}