import { ref } from "vue";
import { useStorage } from "./useStorage";

const _isPopup = new URL(location.href).searchParams.get('src') === 'popup'

const DEFAULT_NETWORK_FILES = [
  {
    url: "https://res.wx.qq.com/t/webmail/webmail/res/static/images/content-bg.1x.d2fb96c.jpg",
    site: "res.wx.qq.com",
    pathname: "content-bg.1x.d2fb96c.jpg",
    ctime: 0,
    type: "image",
  },
  {
    url: "https://res.wx.qq.com/t/webmail/webmail/res/static/images/content-bg-dark.1x.4541f7e.jpg",
    site: "res.wx.qq.com",
    pathname: "content-bg-dark.1x.4541f7e.jpg",
    ctime: 0,
    type: "image",
  },
];

const _skipPopup = { shouldRead: !_isPopup, shouldWrite: !_isPopup }

// ==================== SettingsBar.vue ====================
export const portraitWidget = useStorage("portrait-widget", null);
export const desktopMode = useStorage("desktop-mode", "icons", null, _skipPopup);
export const iconScale = useStorage("icon-scale", 100);
export const langPref = useStorage("lang-pref", "auto");

export const _settingsSkipPersist = ref(false);
export const settingsOpen = useStorage("settings-open", false, null, { shouldRead: !_isPopup, shouldWrite: () => !_isPopup && !_settingsSkipPersist.value });
export const autoHide = useStorage("auto-hide", false);

// ==================== IconsContainer.vue / CardsContainer.vue ====================
export const shortcutIcons = useStorage("shortcut-icons", [], (v) => (Array.isArray(v) ? v : []), {
  preSave: (arr) => Array.isArray(arr) ? [...arr].sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0)) : arr
});
export const shortcutFolders = useStorage("shortcut-folders", [], (v) => (Array.isArray(v) ? v : []), {
  preSave: (arr) => Array.isArray(arr) ? [...arr].sort((a, b) => (a.startRow ?? 0) - (b.startRow ?? 0) || (a.startCol ?? 0) - (b.startCol ?? 0)) : arr
});

// ==================== WallpaperBar.vue ====================
const themeDefault = window.matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";
export const followSystem = useStorage("theme-follow-system", true);
export const themeMode = useStorage("theme-mode", themeDefault, null, {
  shouldWrite: () => !followSystem.value,
});
export const currWallpapers = useStorage("wp-curr-wallpapers", {
  light: null,
  dark: null,
});
export const followLight = useStorage("wp-follow-light", false);
export const followDark = useStorage("wp-follow-dark", true);
export const urlInput = useStorage("wp-url-input", { light: "", dark: "" });
export const wallpaperSource = useStorage("wp-wallpaper-source", { light: 'bing', dark: null });
export const videoLoop = useStorage("wp-video-loop", true);

// ==================== DisplayBar.vue ====================
export const _displayModeVideo = useStorage("wp-display-mode-video", "tile");
export const _displayModeImage = useStorage("wp-display-mode-image", "fill");
export const displayOptimize = useStorage("wp-optimize", true);
export const _desktopAlignVideo = useStorage("wp-desktop-align-video", false);
export const _desktopAlignImage = useStorage("wp-desktop-align-image", false);
export const _desktopAnchorVideo = useStorage("wp-desktop-anchor-video", "rb");
export const _desktopAnchorImage = useStorage("wp-desktop-anchor-image", "rb");

// ==================== PlayerContainer.vue / ControlBar.vue 音量 mute ====================
export const wpVideoVolume = useStorage("wp-video-volume", 100);
export const wpVideoMuted = useStorage("wp-video-muted", true);
export const mediaVideoVolume = useStorage("media-video-volume", 100);
export const mediaVideoMuted = useStorage("media-video-muted", false);
export const mediaMusicVolume = useStorage("media-music-volume", 100);
export const mediaMusicMuted = useStorage("media-music-muted", false);

// ==================== MediaBar.vue ====================
export const mediaListWidth = useStorage("media-list-width", null);
export const networkFiles = useStorage(
  "media-network-files",
  DEFAULT_NETWORK_FILES,
  (v) => (Array.isArray(v) ? v : []),
);
export const MEDIA_SOURCES = ["local", "network"];
export const MEDIA_TYPES = ["image", "music", "video"];

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
      playMode: useStorage(
        `media-playmode-${key}`,
        type === "image"
          ? "single-play"
          : type === "video"
            ? "single-loop"
            : "order-loop",
      ),
      playDirection: useStorage(`media-direction-${key}`, "forward"),
    };
  }
}

export const selectedSource = useStorage(
  "media-source-selected",
  { src: "local", type: "video" },
  (v) => {
    if (!v || !v.src || !v.type) return { src: "local", type: "video" };
    return v;
  },
);

// ==================== 播放状态 ====================
const _np = { shouldRead: !_isPopup, shouldWrite: !_isPopup }
export const mediaVisualSource = useStorage("media-visual-source", null, (v) => {
  return v && v.src && v.type ? v : null;
}, _np);
export const musicSource = useStorage("media-music-source", null, (v) => {
  return v && v.src && v.type ? v : null;
}, _np);
export const videoPaused = useStorage("play-video-paused", false, null, _np);
export const musicPaused = useStorage("play-music-paused", false, null, _np);
export const videoProgress = useStorage("play-video-progress", null, (v) => {
  if (!v || typeof v !== "object") return null;
  return { key: v.key || null, time: v.time || 0 };
}, _np);
export const musicProgress = useStorage("play-music-progress", null, (v) => {
  if (!v || typeof v !== "object") return null;
  return { key: v.key || null, time: v.time || 0 };
}, _np);
export const mediaImgDuration = useStorage("media-img-duration", 3, null, _np);