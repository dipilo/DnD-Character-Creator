const express = require('express');
const db = require('../db');
const { getRequestUser } = require('../middleware/auth');

const router = express.Router();

// Simple feedback endpoint: accepts { userId?, message, url }
router.post('/api/feedback', async (req, res) => {
  try {
    const { message, url } = req.body || {};
    const user = await getRequestUser(req);
    if (!message) return res.status(400).json({ error: 'message_required' });
    await db.run('INSERT INTO feedback(user_id, message, url) VALUES(?, ?, ?)', (user ? user.id : null), message, url || null);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/feedback error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
