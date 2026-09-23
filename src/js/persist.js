// persist  —  所有持久化状态集中声明（全是 useStorage 调用）

import { ref } from "vue";
import { useStorage } from "./storage";

// ====== 环境检测 ======
const _src = new URL(location.href).searchParams.get('src')
export const IS_POPUP = _src === 'popup'
export const IS_OPTIONS = _src === 'options'

if (IS_POPUP) {
  document.documentElement.classList.add('mode-popup')
}

// ====== 媒体枚举 ======
export const MEDIA_SOURCES = ["dir", "local", "network"];
export const MEDIA_TYPES = ["image", "music", "video"];

// ====== 应用设置 ======
export const _settingsSkipPersist = ref(false);
export const desktopMode = useStorage("desktop-mode", "icons", null, { shouldRead: !IS_POPUP, shouldWrite: !IS_POPUP });
export const portraitWidget = useStorage("portrait-widget", null);
export const iconScale = useStorage("icon-scale", 100);
export const langPref = useStorage("lang-pref", "auto");
export const settingsOpen = useStorage("settings-open", false, null, { shouldRead: !IS_POPUP, shouldWrite: () => !IS_POPUP && !_settingsSkipPersist.value });
export const autoHide = useStorage("auto-hide", false);
export const emojiScrollPos = useStorage(IS_POPUP ? 'shortcut-emoji-scroll-popup' : 'shortcut-emoji-scroll', 0)

if (IS_OPTIONS) {
  _settingsSkipPersist.value = true
  settingsOpen.value = true
  _settingsSkipPersist.value = false
}

// ====== 图标文件夹 ======
export const shortcutIcons = useStorage("shortcut-icons", [], (v) => (Array.isArray(v) ? v : []), {
  preSave: (arr) => Array.isArray(arr) ? [...arr].sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0)) : arr
});
export const shortcutFolders = useStorage("shortcut-folders", [], (v) => (Array.isArray(v) ? v : []), {
  preSave: (arr) => Array.isArray(arr) ? [...arr].sort((a, b) => (a.startRow ?? 0) - (b.startRow ?? 0) || (a.startCol ?? 0) - (b.startCol ?? 0)) : arr
});

// ====== 主题壁纸 ======
const themeDefault = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
export const followSystem = useStorage("theme-follow-system", true);
export const themeMode = useStorage("theme-mode", themeDefault, null, {
  shouldWrite: () => !followSystem.value,
});
export const currWallpapers = useStorage("wp-curr-wallpapers", { light: null, dark: null });
export const mediaRotateMap = useStorage('media-rotate-map', {});
export const currBackgroundColors = useStorage("wp-bg-colors", { light: null, dark: null });
export const followLight = useStorage("wp-follow-light", false);
export const followDark = useStorage("wp-follow-dark", true);
export const wallpaperSource = useStorage("wp-wallpaper-source", { light: 'bing', dark: null });
export const videoLoop = useStorage("wp-video-loop", true);

// ====== 显示模式 ======
export const _displayModeVideo = useStorage("wp-display-mode-video", "tile");
export const _displayModeImage = useStorage("wp-display-mode-image", "fill");
export const displayOptimize = useStorage("wp-optimize", true);
export const _desktopAlignVideo = useStorage("wp-desktop-align-video", false);
export const _desktopAlignImage = useStorage("wp-desktop-align-image", false);
export const _desktopAnchorVideo = useStorage("wp-desktop-anchor-video", "rb");
export const _desktopAnchorImage = useStorage("wp-desktop-anchor-image", "rb");

// ====== 音量 ======
export const wpVideoVolume = useStorage("wp-video-volume", 100);
export const wpVideoMuted = useStorage("wp-video-muted", true);
export const mediaVideoVolume = useStorage("media-video-volume", 100);
export const mediaVideoMuted = useStorage("media-video-muted", false);
export const mediaMusicVolume = useStorage("media-music-volume", 100);
export const mediaMusicMuted = useStorage("media-music-muted", false);

// ====== 媒体栏 ======
export const mediaListWidth = useStorage("media-list-width", null);
export const networkFiles = useStorage("media-network-files", [], (v) => (Array.isArray(v) ? v : []));
export const selectedDirId = useStorage("media-dir-selected", null);

// ====== 媒体源状态 ======
export const sourceStates = {};
for (const src of MEDIA_SOURCES) {
  sourceStates[src] = {};
  for (const type of MEDIA_TYPES) {
    const key = `${src}-${type}`;
    sourceStates[src][type] = {
      folder: useStorage(`media-folder-${key}`, "all"),
      sortBy: useStorage(`media-sortby-${key}`, "time"),
      sortDir: useStorage(`media-sortdir-${key}`, "desc"),
      selectedItem: useStorage(`media-selected-${key}`, null),
      loop: useStorage(`media-loop-${key}`, type !== "image"),
      reverse: useStorage(`media-reverse-${key}`, false),
      shuffleSeed: useStorage(`media-shuffle-seed-${key}`, 0),
    };
  }
}

// ====== 工具函数 ======
export function resolveOwnedItem(source) {
  if (!source) return null
  const st = sourceStates[source.src]?.[source.type]
  if (!st) return null
  return st.selectedItem.value || null
}

// ====== 当前选中源 ======
export const selectedSource = useStorage("media-source-selected",
  { src: "network", type: "video" },
  (v) => (v && v.src && v.type ? v : { src: "network", type: "video" }),
);

// ====== 播放状态 ======
const _np = { shouldRead: !IS_POPUP, shouldWrite: !IS_POPUP }
export const mediaVisualSource = useStorage("media-visual-source", null,
  (v) => (v && v.src && v.type ? v : null), _np);
export const musicSource = useStorage("media-music-source", null,
  (v) => (v && v.src && v.type ? v : null), _np);
export const videoPaused = useStorage("play-video-paused", false, null, _np);
export const musicPaused = useStorage("play-music-paused", false, null, _np);
export const videoProgress = useStorage("play-video-progress", null,
  (v) => (v && typeof v === "object" ? { key: v.key || null, time: v.time || 0 } : null), _np);
export const musicProgress = useStorage("play-music-progress", null,
  (v) => (v && typeof v === "object" ? { key: v.key || null, time: v.time || 0 } : null), _np);
export const mediaImgDuration = useStorage("media-img-duration", 3, null, _np);