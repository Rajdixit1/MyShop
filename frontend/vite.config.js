import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend port can be overridden with VITE_API_PORT (useful for LAN/device testing).
const API_PORT = process.env.VITE_API_PORT || '8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // uploaded product photos are served by the backend from /uploads
      '/uploads': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
})