// The Discord bot's way in (MERGE_PLAN.md has no phase for this; it is the Carnotoilet integration).
//
// Sessions are the browser's identity and stay that way. The bot is one trusted caller that acts
// *for* a Discord user, so it presents a shared secret plus the Discord id it is acting for, and
// the server resolves that id through the same `users.discord_id` link `/auth/discord` writes.
// The secret is what makes the id trustworthy — without it this would be the client-asserted
// `X-User-Id` header Phase 1b removed.
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

/**
 * Reject anything but a correctly keyed request, then attach `req.user` for the Discord id named.
 * A Discord id nobody has linked is 403 `discord_not_linked` — distinct from the 401 for a bad
 * key, so the bot can tell "send them to the site" from "the operator misconfigured me".
 */
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

/**
 * The key alone, for what the bot reads on nobody's behalf — the content library. No Discord id
 * is read, so nothing here can resolve to a user, and a route that needs one must use
 * `requireBotAuth` instead.
 */
function requireBotKey(req, res, next) {
  if (!keyMatches(req.get(KEY_HEADER))) return res.status(401).json({ error: 'bad_bot_key' });
  next();
}

module.exports = { requireBotAuth, requireBotKey, keyMatches };
