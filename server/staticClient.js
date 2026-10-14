const express = require('express');
const fs = require('fs');

// A no-op since the SPA moved to app/; its position is load-bearing for the fallback regex.
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
