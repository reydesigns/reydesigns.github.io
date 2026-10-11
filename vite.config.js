import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // GitHub Pages serves the site from /portfolio/; the deploy workflow sets
  // BASE_PATH. Everywhere else (dev, Vercel) it stays at the root.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Design sources live in Assets/. Only web-ready files are ever imported;
      // the 186 MB case-study.png and the .heic original are never referenced,
      // so they stay out of the bundle.
      '@assets': fileURLToPath(new URL('./Assets', import.meta.url)),
    },
  },
  server: { port: 5173, open: false },
  build: {
    // Videos and fonts are emitted as files rather than inlined as base64.
    assetsInlineLimit: 4096,
    // The one chunk over Vite's 500 kB default is Drawing3D (three.js, ~528 kB,
    // 133 kB gzip). It is already lazy — fetched only on the landing page from
    // 40rem up, never on phones — so the warning has nothing left to tell us.
    chunkSizeWarningLimit: 600,
  },
})
