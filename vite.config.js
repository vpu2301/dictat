import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))

export default defineConfig({
  plugins: [react()],
  // The app must always be served from 5173 — playwright.config.js, the
  // backend CORS allow-list and the OIDC redirect URIs all hard-code it.
  // strictPort makes vite fail loudly instead of silently sliding to 5174.
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '0.0.0'),
  },
})
