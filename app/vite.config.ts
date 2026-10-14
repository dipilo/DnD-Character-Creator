import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

const devPort = Number(process.env.PORT ?? '4144')
// SameSite=Lax needs same-origin: Vercel rewrites in prod, this proxy in dev.
const devApiTarget = process.env.VITE_DEV_API_PROXY ?? 'http://localhost:3001'
const publicHmrHost = process.env.VITE_PUBLIC_HOST
const publicHmrPort = Number(process.env.VITE_PUBLIC_PORT ?? String(devPort))
const hmrConfig = publicHmrHost
  ? {
      host: publicHmrHost,
      clientPort: publicHmrPort,
    }
  : undefined

// https://vite.dev/config/
export default defineConfig({
  // Must stay absolute: a relative base resolves assets against the client route and 404s.
  base: '/',
  plugins: [
    inspectAttr(),
    react({
      include: /\.[jt]sx$/
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Unbundled: dep pre-bundling rewrites its asset URLs and the physics never loads.
  optimizeDeps: {
    exclude: ['@3d-dice/dice-box'],
  },
  server: {
    host: '0.0.0.0',
    port: devPort,
    strictPort: true,
    allowedHosts: true,
    hmr: hmrConfig,
    proxy: {
      '/api': { target: devApiTarget },
      '/auth': { target: devApiTarget },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: devPort,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Naming a package can promote it into a static entry import; measure the modulepreload list.
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');

          if (normalizedId.includes('/src/data/sourceFiles/')) {
            return `source-${path.basename(normalizedId, path.extname(normalizedId))}`;
          }

          if (normalizedId.includes('/node_modules/react/') || normalizedId.includes('/node_modules/react-dom/') || normalizedId.includes('/node_modules/react-router')) {
            return 'vendor-react';
          }

          if (normalizedId.includes('/node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }

          if (normalizedId.includes('/node_modules/@react-pdf/') || normalizedId.includes('/node_modules/pdf-lib/') || normalizedId.includes('/node_modules/jspdf/')) {
            return 'vendor-pdf';
          }

          if (normalizedId.includes('/node_modules/recharts/')) {
            return 'vendor-charts';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1200
  }
});
