import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// ====== Vite 配置 ======
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: '.build-tmp',
    emptyOutDir: false,
    sourcemap: true,
    minify: true,
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, 'src/newtab/newtab.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
})