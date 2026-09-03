const express = require('express');
const db = require('../db');

const router = express.Router();

// Health check endpoint for monitoring.
//
// Mounted at `/api/health` as well because that is the only prefix the client can reach: Vercel
// rewrites `/api/*` and `/auth/*` to this host and nothing else, so a browser asking for `/health`
// gets the SPA's index.html back. The keep-alive ping uses it to hold a free-tier host awake
// (`.github/workflows/keepalive.yml`, `store/backendKeepAlive.ts`), so it touches no database.
const health = (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
};
router.get('/health', health);
router.get('/api/health', health);

  // Lightweight DB diagnostics, gated on DIAG_TOKEN.
  //
  // This answers with the database URL and every table's schema, so an unset token used to mean
  // "publish it": the route was live and unauthenticated on the deployed host. Absent or wrong
  // both read as 404 rather than 403, for the same reason a character id does.
  router.get('/diag/db', async (req, res) => {
    try {
      const token = process.env.DIAG_TOKEN || process.env.DIAGNOSTIC_TOKEN;
      if (!token || req.get('X-Diag-Token') !== token) {
        return res.status(404).json({ error: 'not_found' });
      }

      const expected = [
        'users','campaigns','players','availability','campaign_members',
        'invites','feedback','groups','group_members','group_suggestions'
      ];

      // List tables and schema SQL
      const schemaRows = await db.all("SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','index')");
      const tableSql = {};
      const present = new Set();
      for (const r of schemaRows) {
        if (r.type === 'table') present.add(r.name);
        if (!tableSql[r.name] && r.sql) tableSql[r.name] = r.sql;
      }

      // Counts per expected table (if exists)
      const tables = {};
      for (const t of expected) {
        const exists = present.has(t);
        let count = null;
        if (exists) {
          try {
            const row = await db.get(`SELECT COUNT(*) as c FROM ${t}`);
            count = row ? row.c : 0;
          } catch (e) {
            count = null;
          }
        }
        tables[t] = { exists, count, sql: tableSql[t] || null };
      }

      res.json({
        ok: true,
        db_url: process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL || null,
        environment: process.env.NODE_ENV || 'development',
        tables
      });
    } catch (e) {
      console.error('/diag/db error', e);
      res.status(500).json({ error: e.message });
    }
  });

module.exports = router;
