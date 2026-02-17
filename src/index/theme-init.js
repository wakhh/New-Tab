(function () {
  var mode = 'system'
  try {
    mode = localStorage.getItem('theme-mode') || 'system'
  } catch (e) {}
  var dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  var theme = mode === 'system' ? (dark ? 'dark' : 'light') : mode
  document.documentElement.dataset.theme = theme
  document.documentElement.style.backgroundColor = theme === 'dark' ? '#111' : '#f5f5f5'
  
  try {
    var api = typeof chrome !== 'undefined' && chrome.i18n ? chrome.i18n : (typeof browser !== 'undefined' && browser.i18n ? browser.i18n : null)
    if (api) {
      var name = api.getMessage('appName')
      if (name) document.title = name
    }
  } catch (e) {}

  if (dark) {
    var l = document.querySelector('link[rel="icon"]')
    if (l) l.href = './icons/dark-icon.png'
  }

  try {
    var vsk = localStorage.getItem('media-visual-source')
    var ask = localStorage.getItem('media-audio-source')
    var wpRaw = localStorage.getItem('wp-curr-wallpapers')
    var wpVideo = false
    if (wpRaw) {
      var wp = JSON.parse(wpRaw)
      var t = (wp && wp.light) || (wp && wp.dark)
      if (t && t.isVideo) wpVideo = true
    }
    if ((!vsk || vsk === 'null') && (!ask || ask === 'null') && !wpVideo) {
      setTimeout(function () { window.blur() }, 50)
    }
  } catch (e) {}
})()