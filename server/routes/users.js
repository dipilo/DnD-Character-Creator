const express = require('express');
const db = require('../db');

const router = express.Router();

// GET user info
router.get('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
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
