import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
      '/icons': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/avatars': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/chore-images': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
