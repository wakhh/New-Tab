// 打开独立小窗口（后续需求：Alt+E 快捷键 / 图标点击）
function openWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('window.html'),
    type: 'popup',
    width: 480,
    height: 640
  })
}

// 扩展图标点击 → 打开独立小窗口
chrome.action.onClicked.addListener(() => openWindow())

// Alt+E 快捷键 → 打开独立小窗口
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-window') openWindow()
})
