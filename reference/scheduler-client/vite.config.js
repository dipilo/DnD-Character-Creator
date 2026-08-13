import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 5173,
    host: '0.0.0.0' // Allow external connections
  },
  build: {
    // Optimize for production - using default esbuild minifier (faster than terser)
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large libraries into separate chunks
          vendor: ['react', 'react-dom'],
          calendar: ['@fullcalendar/core', '@fullcalendar/react', '@fullcalendar/daygrid', '@fullcalendar/interaction']
        }
      }
    },
    // Compress assets
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000
  }
})