const SIZES = [16, 32, 48, 128]

function draw(size, fg) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
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

export function setupExtIcon() {
  const isDark = matchMedia('(prefers-color-scheme: dark)').matches
  const fg = isDark ? '#f5f5f5' : '#1a1a1a'
  const details = {}
  for (const s of SIZES) {
    details[s] = draw(s, fg).getContext('2d').getImageData(0, 0, s, s)
  }
  if (typeof chrome !== 'undefined' && chrome.action) {
    try { chrome.action.setIcon({ imageData: details }) } catch {}
  }
  try {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.href = draw(32, fg).toDataURL('image/png')
    const old = document.querySelector('link[rel="icon"]')
    if (old) old.remove()
    document.head.appendChild(link)
  } catch {}
}