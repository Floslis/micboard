import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative Pfade: die fertige App läuft in jedem Ordner (Webspace, Pi, Desktop)
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // Beim Entwickeln die Schnittstelle vom lokalen server.mjs holen (npm run server)
    proxy: { '/api': 'http://localhost:8080', '/images': 'http://localhost:8080' },
  },
})
