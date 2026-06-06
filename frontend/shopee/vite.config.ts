import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Allow serving the repo-root /fixtures (symlinked into public/) during dev.
  // Pinned to 5174 so the browser-use driver's LISTING_BASE_URL is deterministic
  // (5173 is left for H1's dashboard Vite server). strictPort: fail loudly rather
  // than silently hopping to another port and breaking the agent's deep links.
  server: {
    port: 5174,
    strictPort: true,
    fs: { allow: ['..'] },
  },
})
