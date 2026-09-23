(function () {
  // ====== 工具 ======
  function ls(k) { try { return JSON.parse(localStorage.getItem(k)) } catch (e) { return null } }

  // ====== 主题初始化 ======
  var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  var followSystem = ls('theme-follow-system')
  var userMode = ls('theme-mode')
  var dark = followSystem !== false ? sysDark : (userMode === 'dark')
  var slot = dark ? 'dark' : 'light'
  var followLight = ls('wp-follow-light')
  var followDark = ls('wp-follow-dark')
  if (dark && followDark) slot = 'light'
  if (!dark && followLight) slot = 'dark'

  // ====== 背景初始化 ======
  var wp = ls('wp-curr-wallpapers') || {}
  var bg = ls('wp-bg-colors') || {}
  var hasWp = !!wp[slot]
  var bgColor = bg[slot]
  document.documentElement.dataset.theme = slot
  var initBg = dark ? '#111' : '#f5f5f5'
  if (!hasWp && bgColor) initBg = bgColor
  document.documentElement.style.backgroundColor = initBg
  if (!hasWp && bgColor) {
    document.documentElement.style.setProperty('--bg', bgColor)
  }
})()