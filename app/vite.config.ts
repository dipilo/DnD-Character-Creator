import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

const devPort = Number(process.env.PORT ?? '4144')
// The session cookie is SameSite=Lax, which only works because the SPA reaches the API
// same-origin: through the Vercel rewrites in production (MERGE_PLAN.md §5.2) and through this
// proxy in dev. Point it elsewhere with VITE_DEV_API_PROXY when the server runs on another port.
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
  // Absolute, not './'. A relative base makes index.html reference ./assets/index-*.js, which the
  // browser resolves against the *client route* — /invite/abc asks for /invite/assets/index-*.js,
  // the SPA rewrite answers with index.html, and every module fails strict MIME checking. Any
  // deploy under a subpath must set this to that subpath rather than going back to relative.
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
  // dice-box ships a base64-embedded physics worker and locates its ammo.wasm /
  // world.*.js assets via its own module URL. Vite's esbuild dep pre-bundling
  // rewrites those references, so the physics engine never loads and rolls hang
  // forever with no dice on screen. Serving it unbundled keeps that resolution intact.
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
        // A manual chunk is a promise that the chunk is worth naming, and Rollup keeps it whole:
        // naming a package here can promote it out of a lazy route's subtree into a *static* import
        // of the entry. That is how `@3d-dice/dice-box` (2.6 MB) came to be modulepreloaded by
        // `index.html` on every page load, though only `/dice` and the ability-score roller mount
        // it and nothing in `src` imports it outside those lazy routes. Left unnamed, Rollup splits
        // it correctly. After touching this, measure `dist/index.html`'s modulepreload list — chunk
        // sizes alone do not show what boot actually pays for.
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
