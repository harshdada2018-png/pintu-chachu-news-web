import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { spawn } from 'node:child_process'
import http from 'node:http'

function autoBackendPlugin() {
  let backendProc = null
  return {
    name: 'auto-backend',
    configureServer() {
      // Check if backend port 5000 is active
      const req = http.get('http://127.0.0.1:5000/api/storage/status', () => {
        console.log('⚡ [Vite Dev] Backend server is already running on http://127.0.0.1:5000')
      })
      req.on('error', () => {
        console.log('🚀 [Vite Dev] Auto-launching backend server (node server/server.js)...')
        backendProc = spawn('node', ['server/server.js'], { stdio: 'inherit', shell: true })
      })
      const cleanup = () => {
        if (backendProc) {
          backendProc.kill()
          backendProc = null
        }
      }
      process.on('exit', cleanup)
      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), autoBackendPlugin()],
  server: {
    watch: {
      ignored: ['**/vedio/**', '**/*.mp4', '**/server/data/**']
    },
    host: '0.0.0.0', // Expose to all local IPs and Electron apps like ResponsivelyApp
    port: 5173,
    open: false,
    cors: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false
      },
      '/sitemap.xml': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false
      },
      '/robots.txt': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
