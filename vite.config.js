import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // The deploy workflow sets BASE_PATH; GitHub Pages (reydesigns.github.io)
  // serves from the root, as do dev and Vercel.
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
  // strictPort: a second session's server fails loudly instead of drifting to
  // 5174 while the scripts keep testing :5173. Parallel worktree sessions pass
  // their own port: `npm run dev -- --port 5174` + BASE_URL=http://localhost:5174.
  server: { port: 5173, strictPort: true, open: false },
  build: {
    // Videos and fonts are emitted as files rather than inlined as base64.
    assetsInlineLimit: 4096,
    // Two chunks pass Vite's 500 kB default. Drawing3D (three.js, ~545 kB,
    // 138 kB gzip) is already lazy: it is fetched only on the landing page from
    // 40rem up, never on phones. The entry chunk is just over (~505 kB, ~184 kB
    // gzip) since the Vinyl Player's scene and audio joined the Works grid; the
    // card's thumbnail draws the same scene, so it loads with the page. Neither
    // warning would have anything left to tell us.
    chunkSizeWarningLimit: 600,
  },
})
