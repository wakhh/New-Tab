import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// 构建到临时目录 .build-tmp，由 scripts/build-extension.js 复制到项目根目录（扩展目录）
// 注意：项目根目录含硬链接文件夹 Pictures/Videos/Music，构建绝不能直接输出/清空根目录
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: '.build-tmp',
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, 'src/index/newtab.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
})