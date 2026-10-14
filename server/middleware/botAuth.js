// A shared secret plus the Discord id acted for, resolved through `users.discord_id`.
const crypto = require('node:crypto');
const db = require('../db');
const { config } = require('../config');

const KEY_HEADER = 'x-bot-key';
const DISCORD_HEADER = 'x-discord-id';
const DISCORD_ID_PATTERN = /^\d{5,25}$/;

function keyMatches(presented) {
  const expected = typeof config.botApiKey === 'string' ? config.botApiKey : '';
  if (!expected || typeof presented !== 'string' || presented.length === 0) return false;
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Rejects anything but a correctly keyed request, then attaches `req.user`. */
async function requireBotAuth(req, res, next) {
  try {
    if (!keyMatches(req.get(KEY_HEADER))) return res.status(401).json({ error: 'bad_bot_key' });
    const discordId = String(req.get(DISCORD_HEADER) || '').trim();
    if (!DISCORD_ID_PATTERN.test(discordId)) return res.status(400).json({ error: 'discord_id_required' });
    const user = await db.get('SELECT * FROM users WHERE discord_id = ?', discordId);
    if (!user) return res.status(403).json({ error: 'discord_not_linked' });
    req.user = user;
    req.botDiscordId = discordId;
    next();
  } catch (e) {
    next(e);
  }
}

/** No Discord id is read, so a route needing a user must use `requireBotAuth`. */
function requireBotKey(req, res, next) {
  if (!keyMatches(req.get(KEY_HEADER))) return res.status(401).json({ error: 'bad_bot_key' });
  next();
}

module.exports = { requireBotAuth, requireBotKey, keyMatches };
