import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: path.resolve(__dirname, 'src'),
  base: './',   // relative paths so Electron file:// protocol works
  publicDir: path.resolve(__dirname, 'public'),
  server: {
    port: 5173,
    hmr: false,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    proxy: {
      '/api/': { target: 'http://localhost:3001', changeOrigin: true }
    }
  },
  optimizeDeps: { force: true },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    assetsDir: 'assets'
  }
})
