import { build } from 'vite'
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync, watch as fsWatch } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

// ====== 常量 ======
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const tmp = resolve(root, '.build-tmp')

const PRODUCTS = ['newtab.html', 'assets', 'manifest.json', 'background.js', '_locales', 'icons']

const watch = process.argv.includes('--watch')

// ====== 系统删除 ======
function sysRm(target) {
  const q = String(target).replace(/"/g, '')
  try {
    if (process.platform === 'win32') {
      execSync(`if exist "${q}" rd /s /q "${q}"`, { shell: 'cmd.exe', stdio: 'ignore' })
    } else {
      execSync(`rm -rf -- "${q}"`, { stdio: 'ignore' })
    }
  } catch (e) {
    /* 目标不存在时忽略 */
  }
}

// ====== 产物复制 ======
async function copyOutput() {
  // HTML
  const htmlSrc = resolve(tmp, 'src/newtab')
  if (existsSync(htmlSrc)) {
    for (const f of readdirSync(htmlSrc)) {
      if (f.endsWith('.html')) {
        const src = join(htmlSrc, f)
        const dest = resolve(root, f)
        let content = readFileSync(src, 'utf-8').replaceAll('../../assets/', './assets/')
        writeFileSync(dest, content, 'utf-8')
        console.log('copy →', f)
      }
    }
  }

  // assets
  const assetsSrc = resolve(tmp, 'assets')
  const assetsDest = resolve(root, 'assets')
  sysRm(assetsDest)
  if (existsSync(assetsSrc)) cpSync(assetsSrc, assetsDest, { recursive: true })

  // public 静态文件
  for (const f of ['manifest.json', 'background.js', 'theme-init.js']) {
    const src = resolve(root, 'public', f)
    if (existsSync(src)) cpSync(src, resolve(root, f), { force: true })
  }

  // _locales
  const localesSrc = resolve(root, 'public', '_locales')
  const localesDest = resolve(root, '_locales')
  if (existsSync(localesSrc)) {
    sysRm(localesDest)
    cpSync(localesSrc, localesDest, { recursive: true })
  }

  // icons
  const iconsSrc = resolve(root, 'public', 'icons')
  const iconsDest = resolve(root, 'icons')
  if (existsSync(iconsSrc)) {
    sysRm(iconsDest)
    cpSync(iconsSrc, iconsDest, { recursive: true })
  }
}

// ====== 主流程 ======
async function main() {
  try {
    sysRm(tmp)

    const config = { configFile: resolve(root, 'vite.config.js') }
    if (!watch) {
      await build(config)
      await copyOutput()
      sysRm(tmp)
      console.log('✅ 构建完成，产物已复制到扩展目录（项目根目录）')
    } else {
      const watcher = await build({ ...config, build: { watch: {} } })
      watcher.on('event', (e) => {
        if (e.code === 'BUNDLE_END') {
          copyOutput().then(() => console.log('✅ watch 构建完成，产物已更新'))
        }
      })
      const publicDir = resolve(root, 'public')
      if (existsSync(publicDir)) {
        fsWatch(publicDir, { recursive: true }, () => {
          copyOutput().then(() => console.log('✅ public 变更，产物已同步'))
        })
      }
    }
  } catch (e) {
    console.error('构建失败:', e)
    process.exitCode = 1
  }
}

main()