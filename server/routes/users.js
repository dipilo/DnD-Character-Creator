const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET user info. Public before Phase 1b, which let anyone enumerate every account on the server
// by walking the id space. Callers wanting their own profile should use GET /api/me.
router.get('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const u = await db.get('SELECT id, username, discord_id, created_at FROM users WHERE id = ?', id);
    if (!u) return res.status(404).json({ error: 'user_not_found' });
    res.json({ ok: true, user: u });
  } catch (e) {
    console.error('GET /api/users/:id', e);
    res.status(500).json({ error: e.message });
  }
});


module.exports = router;
