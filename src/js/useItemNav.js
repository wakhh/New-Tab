import { sourceStates, musicPaused, videoPaused, visualSource, musicSource } from './usePersist'
import { videoEl } from './useVideoElement'
import { musicEl } from './useAudioElement'
import { itemId, sourceOf } from '../utils/media'
import { MODES, DIR, getMode, getDirection } from './usePlayMode'
import { listOf, shuffleListOf, _stateOfSource, navTargetSource, stopSource } from './useSourceHelpers'
import { clearVideoProgress, clearMusicProgress } from './useProgressStore'

function _idxOf(list, item) {
  if (!item) return -1
  const k = itemId(item)
  return list.findIndex((f) => itemId(f) === k)
}

function _pickLinear(source, item, userDir, autoDir, isLoop) {
  const list = listOf(source)
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

function _pickShuffle(source, item, userDir, autoDir) {
  const shuffled = shuffleListOf(source)
  if (!shuffled.length) return listOf(source)[0] || null
  if (!item) return shuffled[0]

  const curKey = itemId(item)
  let idx = shuffled.findIndex((f) => itemId(f) === curKey)
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

export function pickNextItem(source, item, dir = 'next', mode, direction) {
  if (!source) return null
  const m = mode || getMode(source)
  const d = direction ?? getDirection(source)

  const isAuto = dir === null

  if (m === MODES.SINGLE_LOOP && isAuto) return item || null
  if (m === MODES.SINGLE_PLAY && isAuto) return null

  if (m === MODES.SHUFFLE) {
    return _pickShuffle(source, item, dir, d)
  }

  const isLoop = m === MODES.ORDER_LOOP || (isAuto ? false : (m === MODES.SINGLE_LOOP || m === MODES.SINGLE_PLAY))
  return _pickLinear(source, item, dir, d, isLoop)
}

export function navigate(source, target, opts = {}) {
  if (!source) return
  const st = sourceStates[source.src]?.[source.type]
  if (!st) return
  if (!target) return
  st.selectedItem.set(target)
}

export function playbackNav(dir, which) {
  const source = navTargetSource(which)
  if (!source) return false

  const st = _stateOfSource(source)
  if (!st) return false

  const curItem = st.selectedItem.value
  const target = pickNextItem(source, curItem, dir, st.playMode.value, st.playDirection.value)
  if (!target) return false

  st.playDirection.set(dir === 'prev' ? DIR.BACKWARD : DIR.FORWARD)

  const type = source.type
  if (type === 'music') musicPaused.value = false
  else if (type === 'video') videoPaused.value = false
  navigate(source, target)
  return true
}

export function playbackSelectItem(item) {
  if (!item) return
  const source = sourceOf(item)
  if (!source) return
  const src = source.src
  const type = source.type
  const st = sourceStates[src]?.[type]
  if (!st) return
  const curItem = st.selectedItem.value
  const sameItem = curItem && itemId(curItem) === itemId(item)

  if (sameItem) {
    replay(type, item)
  } else {
    if (st.playMode.value !== MODES.SHUFFLE && curItem) {
      const list = listOf(source)
      const curIdx = list.findIndex(it => itemId(it) === itemId(curItem))
      const tgtIdx = list.findIndex(it => itemId(it) === itemId(item))
      if (curIdx >= 0 && tgtIdx >= 0 && Math.abs(tgtIdx - curIdx) === 1) {
        st.playDirection.set(tgtIdx > curIdx ? DIR.FORWARD : DIR.BACKWARD)
      }
    }
    if (type === 'music') musicPaused.value = false
    else if (type === 'video') videoPaused.value = false
    navigate(source, item)
  }

  if (type === 'image' || type === 'video') visualSource.set(source)
  else musicSource.set(source)
}

function replay(type, item) {
  if (!item) return
  if (type === 'music') {
    clearMusicProgress(); musicPaused.value = false
    if (musicEl.value) { musicEl.value.currentTime = 0; musicEl.value.play()?.catch(() => {}) }
  } else if (type === 'video') {
    clearVideoProgress(); videoPaused.value = false
    if (videoEl.value) { videoEl.value.currentTime = 0; videoEl.value.play()?.catch(() => {}) }
  }
}