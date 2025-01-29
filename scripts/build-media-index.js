// 媒体索引生成脚本（npm run media-index）
// 遍历 Pictures/Music/Videos 三个文件夹（仅根目录和一级子文件夹），
// 在项目根目录生成 media-index.json（方便扩展页面 fetch 读取）。
// 单个文件记录 5 个属性：
//   path1    根目录名（Pictures | Music | Videos）
//   path2    一级子文件夹名（根目录下直接文件为 ''）
//   filename 文件名
//   mtime    修改时间（毫秒时间戳，供时间排序）
//   type     媒体类型（image | music | video）
// 只收录图片/音乐/视频扩展名的文件；空文件夹不参与。
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// 媒体类型判定（按扩展名）
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif']
const MUSIC_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']

function detectType(filename) {
  const ext = String(filename).split('.').pop().toLowerCase()
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (MUSIC_EXTS.includes(ext)) return 'music'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  return null
}

const items = []

for (const path1 of ['Pictures', 'Music', 'Videos']) {
  const dir = join(ROOT, path1)
  if (!existsSync(dir)) continue
  const entries = readdirSync(dir)
  const files = []
  const subdirs = []
  for (const name of entries) {
    let st
    try {
      st = statSync(join(dir, name))
    } catch {
      continue
    }
    if (st.isFile()) files.push([name, st])
    else if (st.isDirectory()) subdirs.push(name)
  }

  // 根目录下的直接文件
  for (const [name, st] of files) {
    const type = detectType(name)
    if (type) items.push({ path1, path2: '', filename: name, mtime: st.mtimeMs, type })
  }

  // 一级子文件夹下的文件
  for (const sub of subdirs) {
    const subDir = join(dir, sub)
    let subEntries
    try {
      subEntries = readdirSync(subDir)
    } catch {
      continue
    }
    for (const name of subEntries) {
      let st
      try {
        st = statSync(join(subDir, name))
      } catch {
        continue
      }
      if (!st.isFile()) continue
      const type = detectType(name)
      if (type) items.push({ path1, path2: sub, filename: name, mtime: st.mtimeMs, type })
    }
  }
}

// 紧凑输出（文件数可能上千，缩进会显著增大体积影响 fetch 效率）
writeFileSync(join(ROOT, 'media-index.json'), JSON.stringify(items) + '\n')
console.log(`media-index: ${items.length} files -> media-index.json`)
