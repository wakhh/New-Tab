// ====== 扩展图标 ======
const SIZES = [16, 32, 48, 128]

function draw(size, fg) {
  const c = new OffscreenCanvas(size, size)
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  const pad = size * 0.13
  const inner = size - pad * 2
  const cell = inner / 3
  const r = cell * 0.34
  ctx.fillStyle = fg
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = pad + col * cell + cell / 2
      const y = pad + row * cell + cell / 2
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return c
}

function setupExtIcon() {
  try {
    if (!chrome.action) return
    const isDark = matchMedia('(prefers-color-scheme: dark)').matches
    const fg = isDark ? '#f5f5f5' : '#1a1a1a'
    const details = {}
    for (const s of SIZES) {
      details[s] = draw(s, fg).getContext('2d').getImageData(0, 0, s, s)
    }
    chrome.action.setIcon({ imageData: details })
  } catch {}
}

try { setupExtIcon() } catch {}

try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setupExtIcon)
} catch {}

// ====== 命令监听 ======
async function openNewTabPopup(source) {
  const url = chrome.runtime.getURL('newtab.html') + (source ? `?src=${encodeURIComponent(source)}` : '')
  const width = 405
  const height = 720
  await chrome.windows.create({ url, type: 'popup', width, height })
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-newtab') {
    openNewTabPopup('command')
  } else if (command === 'close-tabs-after') {
    chrome.tabs.query({ active: true, currentWindow: true }, (activeArr) => {
      const active = activeArr && activeArr[0]
      if (!active) return
      chrome.tabs.query({ currentWindow: true }, (allInWin) => {
        const ids = allInWin.filter(t => t.index > active.index).map(t => t.id)
        if (!ids.length) return
        chrome.tabs.remove(ids).catch(() => {})
      })
    })
  } else if (command === 'close-tabs-before') {
    chrome.tabs.query({ active: true, currentWindow: true }, (activeArr) => {
      const active = activeArr && activeArr[0]
      if (!active) return
      chrome.tabs.query({ currentWindow: true }, (allInWin) => {
        const ids = allInWin.filter(t => t.index < active.index).map(t => t.id)
        if (!ids.length) return
        chrome.tabs.remove(ids).catch(() => {})
      })
    })
  } else if (command === 'close-other-tabs') {
    chrome.tabs.query({ active: true, currentWindow: true }, (activeArr) => {
      const active = activeArr && activeArr[0]
      if (!active) return
      chrome.tabs.query({ currentWindow: true }, (allInWin) => {
        const ids = allInWin.filter(t => t.id !== active.id).map(t => t.id)
        if (!ids.length) return
        chrome.tabs.remove(ids).catch(() => {})
      })
    })
  }
})

// ====== 标签页判断 ======
function _isMyNewTab(url) {
  if (!url) return false
  if (url === 'edge://newtab/' || url === 'chrome://newtab/') return true
  if (!url.includes('newtab.html')) return false
  const qIdx = url.indexOf('?')
  if (qIdx === -1) return true
  const params = new URLSearchParams(url.slice(qIdx + 1))
  return !params.get('src')
}

function _isBrowserBuiltin(url) {
  if (!url) return false
  if (_isMyNewTab(url)) return false
  return url.startsWith('edge://') || url.startsWith('chrome://') || url.startsWith('about:')
}

function _isExtensionPage(url) {
  if (!url) return false
  return url.startsWith('chrome-extension://')
}

// ====== 标签页管理 ======
function _closeNewTab(tabId, retries = 3) {
  chrome.tabs.remove(tabId).catch(() => {
    if (retries > 0) setTimeout(() => _closeNewTab(tabId, retries - 1), 200)
  })
}

function _enforceOrder(windowId, retryCount = 0) {
  chrome.tabs.query({ windowId }, (winTabs) => {
    const pinnedCount = winTabs.filter(t => t.pinned).length
    const order = [
      ...winTabs.filter(t => !t.pinned && _isBrowserBuiltin(t.url)),
      ...winTabs.filter(t => !t.pinned && _isExtensionPage(t.url)),
      ...winTabs.filter(t => !t.pinned && !_isBrowserBuiltin(t.url) && !_isExtensionPage(t.url) && !_isMyNewTab(t.url)),
      ...winTabs.filter(t => _isMyNewTab(t.url)),
    ]
    let i = order.length - 1
    function step() {
      if (i < 0) return
      const targetIdx = pinnedCount + i
      const tab = order[i]
      i--
      if (tab.index === targetIdx) { step(); return }
      chrome.tabs.move(tab.id, { index: targetIdx }, () => {
        if (chrome.runtime.lastError) {
          if (retryCount < 5) setTimeout(() => _enforceOrder(windowId, retryCount + 1), 300)
          return
        }
        step()
      })
    }
    step()
  })
}

chrome.tabs.onActivated.addListener((info) => {
  chrome.tabs.query({}, (allTabs) => {
    const cur = allTabs.find(t => t.id === info.tabId)
    if (!cur) return
    const myNewTabs = allTabs.filter(t => _isMyNewTab(t.url))
    if (_isMyNewTab(cur.url)) {
      for (const nt of myNewTabs) {
        if (nt.id !== cur.id) _closeNewTab(nt.id)
      }
    } else {
      for (const nt of myNewTabs) {
        if (!nt.audible) _closeNewTab(nt.id)
      }
    }
    _enforceOrder(cur.windowId)
  })
})

chrome.tabs.onMoved.addListener((tabId, info) => {
  _enforceOrder(info.windowId)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  if (_isMyNewTab(tab.url)) {
    chrome.tabs.query({}, (allTabs) => {
      const myNewTabs = allTabs.filter(t => _isMyNewTab(t.url))
      for (const nt of myNewTabs) {
        if (nt.id !== tabId) _closeNewTab(nt.id)
      }
      _enforceOrder(tab.windowId)
    })
  } else if (_isBrowserBuiltin(tab.url) || _isExtensionPage(tab.url)) {
    _enforceOrder(tab.windowId)
  }
})