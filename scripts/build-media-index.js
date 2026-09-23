import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { platform } from 'node:os'
import { IMAGE_EXTS, MUSIC_EXTS, VIDEO_EXTS } from '../src/js/mediaExts.js'

// ====== 常量 ======
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const WIN_KNOWN_FOLDERS = {
  Pictures: 'My Pictures',
  Music:    'My Video',
  Videos:   'My Video',
}

// ====== Windows 系统文件夹 ======
function expandEnv(str) {
  return str.replace(/%([^%]+)%/g, (_, v) => process.env[v] || `%${v}%`)
}

function getWinKnownFolder(name) {
  try {
    const guid = WIN_KNOWN_FOLDERS[name]
    const out = execSync(
      `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders" /v "${guid}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    const m = out.match(/REG_(?:EXPAND_)?SZ\s+(.+)/)
    if (!m) return null
    return expandEnv(m[1].trim())
  } catch { return null }
}

function ensureJunction(name) {
  const linkPath = join(ROOT, name)
  if (existsSync(linkPath)) return
  if (platform() !== 'win32') {
    console.warn(`warn: ${name} 不存在，非 Windows 平台跳过`)
    return
  }
  const target = getWinKnownFolder(name)
  if (!target || !existsSync(target)) {
    console.warn(`warn: 无法获取 ${name} 的系统文件夹路径`)
    return
  }
  execSync(`mklink /J "${linkPath}" "${target}"`, { stdio: 'ignore' })
  console.log(`linked: ${name} -> ${target}`)
}

for (const name of Object.keys(WIN_KNOWN_FOLDERS)) ensureJunction(name)

// ====== 媒体收集 ======
const ALL_EXTS = [...IMAGE_EXTS, ...MUSIC_EXTS, ...VIDEO_EXTS]

function detectType(filename, allowedExts) {
  const ext = String(filename).split('.').pop().toLowerCase()
  if (!allowedExts.includes(ext)) return null
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (MUSIC_EXTS.includes(ext)) return 'music'
  if (VIDEO_EXTS.includes(ext)) return 'video'
  return null
}

function _collectFrom(dir, path1, path2, allowedExts) {
  if (!existsSync(dir)) return []
  const out = []
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    let st
    try { st = statSync(join(dir, name)) } catch { continue }
    if (st.isFile()) {
      const type = detectType(name, allowedExts)
      if (type) out.push({ path1, path2, filename: name, mtime: st.mtimeMs, type })
    }
  }
  return out
}

const items = []

for (const path1 of ['Pictures', 'Music', 'Videos']) {
  const dir = join(ROOT, path1)
  if (!existsSync(dir)) continue
  const allowedExts = path1 === 'Music' ? MUSIC_EXTS : ALL_EXTS

  items.push(..._collectFrom(dir, path1, '', allowedExts))

  let entries
  try { entries = readdirSync(dir) } catch { continue }
  for (const name of entries) {
    let st
    try { st = statSync(join(dir, name)) } catch { continue }
    if (st.isDirectory()) {
      items.push(..._collectFrom(join(dir, name), path1, name, allowedExts))
    }
  }
}

// ====== 输出 ======
items.sort((a, b) => b.mtime - a.mtime)

writeFileSync(join(ROOT, 'media-index.json'), JSON.stringify(items) + '\n')
console.log(`media-index: ${items.length} files -> media-index.json`)