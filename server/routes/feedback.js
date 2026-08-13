const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Simple feedback endpoint: accepts { message, url }. Signed-out feedback is still worth having,
// so the session is optional — but it is the session, not a client-supplied id, that attributes it.
router.post('/api/feedback', optionalAuth, async (req, res) => {
  try {
    const { message, url } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message_required' });
    await db.run('INSERT INTO feedback(user_id, message, url) VALUES(?, ?, ?)', req.user?.id ?? null, message, url || null);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/feedback error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
