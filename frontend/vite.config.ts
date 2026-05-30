import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Displayed on the login screen. CI injects APP_VERSION (git tag / sha) at build
// time; otherwise fall back to the package.json version for local builds.
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string }
const appVersion = process.env.APP_VERSION || pkg.version

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
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
