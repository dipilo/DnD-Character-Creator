const express = require('express');
const fs = require('fs');

// -------- Serve built client (SPA) --------
// When deployed together, serve the Vite-built frontend from ../client/dist
// This allows GET / to load the UI instead of returning 404 "Cannot GET /".
//
// Note for the merge: the SPA now lives in app/, so ../client/dist never exists here and this
// mount is a no-op. MERGE_PLAN.md Phase 6 (Vercel rewrites) decides whether it is repointed or
// deleted. Its position in server.js is load-bearing until then: the fallback regex swallows
// every path that does not start with /api or /auth, so routes like /health and /diag/db must
// stay registered after it, exactly as they were.
function mountStaticClient(app) {
  try {
    const path = require('path');
    const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      // SPA fallback: Express 5 uses path-to-regexp v6, avoid '*' path; use a regex that excludes /api and /auth
      app.get(/^(?!\/(api|auth)).*/, (req, res, next) => {
        res.sendFile(path.join(clientDist, 'index.html'));
      });
    }
  } catch (e) {
    console.warn('Static client serving not configured:', e && e.message);
  }
}

module.exports = { mountStaticClient };
