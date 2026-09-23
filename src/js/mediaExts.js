// ====== 扩展名白名单 ======
export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif', 'heic', 'heif', 'tiff']
export const MUSIC_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus', 'wma', 'aiff', 'ape', 'mka']
export const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'hvc', 'ts', '3gp', 'mpeg', 'mpg', 'm1v', 'm2v', 'm2ts', 'ogv', 'wmv', 'flv', 'vob']
export const ALL_MEDIA_EXTS = [...IMAGE_EXTS, ...MUSIC_EXTS, ...VIDEO_EXTS]

// ====== 类型检测 ======
export function detectMediaType(name) {
  const ext = String(name || '').split('?')[0].split('#')[0].split('.').pop().toLowerCase()
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (MUSIC_EXTS.includes(ext)) return 'music'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  return null
}

export function videoUrlRegex() {
  return new RegExp(`\\.(${VIDEO_EXTS.join('|')})(\\?|#|$)`, 'i')
}