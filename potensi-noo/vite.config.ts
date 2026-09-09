import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base '' keeps every asset path relative, so the same build works on GitHub
// Pages (/teadimscm/potensi-noo/), on Cloudflare Pages, and from a local folder.
export default defineConfig({
  base: '',
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
})
