// What the Discord bot may read on a linked user's behalf. Every route is `requireBotAuth`, and
// every character decision goes through `lib/characterAccess.js` exactly as the browser routes
// do, so a sheet the site would 404 for this user 404s for the bot too. Read-only for now: HP and
// slot writes come once reads have proven the link.
const express = require('express');
const db = require('../db');
const { resolveCharacterAccess } = require('../lib/characterAccess');
const { SUMMARY_COLUMNS, characterSummary, publicCharacter } = require('../lib/characters');
const { requireBotAuth } = require('../middleware/botAuth');

const router = express.Router();

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

router.get('/api/bot/me', requireBotAuth, (req, res) => {
  res.json({ ok: true, user: { id: req.user.id, username: req.user.username ?? null, discord_id: req.botDiscordId } });
});

// The caller's own characters, summaries only — the same shape and the same reason as
// GET /api/characters: documents carry portraits, and a list is a picker.
router.get('/api/bot/characters', requireBotAuth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT ${SUMMARY_COLUMNS} FROM characters WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC, id ASC`,
      req.user.id,
    );
    res.json({ ok: true, characters: rows.map(characterSummary) });
  } catch (e) {
    console.error('GET /api/bot/characters', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/bot/characters/:id', requireBotAuth, async (req, res) => {
  try {
    if (!ID_PATTERN.test(req.params.id)) return res.status(404).json({ error: 'character_not_found' });
    const row = await db.get('SELECT * FROM characters WHERE id = ?', req.params.id);
    const access = await resolveCharacterAccess(req.user, row);
    if (!access) return res.status(404).json({ error: 'character_not_found' });
    res.json({ ok: true, character: publicCharacter(access.row, access) });
  } catch (e) {
    console.error('GET /api/bot/characters/:id', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
