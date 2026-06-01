import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

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
  plugins: [
    react(),
    // Old devices on the LAN (e.g. a 2014 Galaxy Tab 4 running a ~2018 Opera /
    // Chromium ~61) cannot parse the modern syntax Vite 8 + React 19 emit by
    // default (`?.`, `??`, class fields), so they showed a blank white screen.
    // `renderModernChunks: false` emits a single SystemJS bundle, transpiled and
    // polyfilled down to the target below, for ALL browsers. This deliberately
    // avoids the dual-bundle case where a browser supports ES modules but not the
    // modern syntax inside them and would still fail on the modern chunk.
    legacy({
      targets: ['chrome >= 61'],
      renderModernChunks: false,
    }),
  ],
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
