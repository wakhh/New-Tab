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

async function openNewTabPopup(source) {
  const url = browser.runtime.getURL('newtab.html') + (source ? `?src=${encodeURIComponent(source)}` : '')
  const width = 405
  const height = 720
  await browser.windows.create({ url, type: 'popup', width, height })
}

browser.commands.onCommand.addListener((command) => {
  if (command === 'open-newtab') {
    openNewTabPopup('command')
  }
})