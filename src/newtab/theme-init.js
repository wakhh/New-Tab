(function () {
  var mode = 'system'
  try {
    var v = chrome.storage || browser.storage
    if (v && v.local) {
      v.local.get({ 'theme-mode': 'system', 'lang-pref': 'auto' }).then(function (r) {
        var dark = window.matchMedia('(prefers-color-scheme: dark)').matches
        var themeMode = r['theme-mode'] || 'system'
        var langPref = r['lang-pref'] || 'auto'
        var theme = themeMode === 'system' ? (dark ? 'dark' : 'light') : themeMode
        document.documentElement.dataset.theme = theme
        document.documentElement.style.backgroundColor = theme === 'dark' ? '#111' : '#f5f5f5'
        try {
          var api = (typeof chrome !== 'undefined' && chrome.i18n) || (typeof browser !== 'undefined' && browser.i18n)
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
          v.local.get(['media-visual-source', 'media-audio-source', 'wp-curr-wallpapers']).then(function (s) {
            var wpVideo = false
            var wp = s['wp-curr-wallpapers']
            var t = (wp && wp.light) || (wp && wp.dark)
            if (t && t.isVideo) wpVideo = true
            if ((!s['media-visual-source'] || s['media-visual-source'] === null)
              && (!s['media-audio-source'] || s['media-audio-source'] === null)
              && !wpVideo) {
              setTimeout(function () { window.blur() }, 50)
            }
          })
        } catch (e) {}
      })
    }
  } catch (e) {}
})()