// Server-side sessions (MERGE_PLAN.md Phase 1b).
//
// Before this, "authentication" was an `X-User-Id` header the client asserted and the server
// believed, so editing one integer in devtools made you any user on the system. A session id is
// minted here, stored in `sessions`, and handed back only as an httpOnly cookie — the client
// never sees a user id it could echo, and the browser will not hand the cookie to script.
const db = require('../db');
const { genSessionId } = require('./tokens');
const { readCookie } = require('./cookies');

const SESSION_COOKIE = 'dnd_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000; // one write per hour per session, not per request
const REVOKED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// The columns of `users` a request handler is allowed to see. password_hash is deliberately not
// among them: nothing downstream needs it, and req.user gets serialised into responses.
const USER_COLUMNS = 'u.id, u.username, u.discord_id, u.created_at';

/**
 * Secure cookies require HTTPS, which dev over http://localhost does not have. Default to the
 * environment and let COOKIE_SECURE force it either way for hosts that terminate TLS upstream.
 */
function useSecureCookie() {
  if (process.env.COOKIE_SECURE === '1') return true;
  if (process.env.COOKIE_SECURE === '0') return false;
  return process.env.NODE_ENV === 'production';
}

/**
 * SameSite=Lax is only sufficient because the SPA reaches the API same-origin through the Vercel
 * rewrites (MERGE_PLAN.md §5.2). A split-origin deployment would need None+Secure and a CSRF token.
 */
function cookieOptions(extra = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookie(),
    path: '/',
    ...extra,
  };
}

/** Public shape of a user: what /auth/login, /auth/signup and /api/me may return. */
function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username ?? null,
    discord_id: user.discord_id ?? null,
    created_at: user.created_at ?? null,
  };
}

/** Opportunistic housekeeping so `sessions` does not grow without bound. Cheap: one indexed DELETE. */
async function pruneExpiredSessions() {
  try {
    const now = new Date().toISOString();
    const revokedCutoff = new Date(Date.now() - REVOKED_RETENTION_MS).toISOString();
    await db.run(
      'DELETE FROM sessions WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)',
      now,
      revokedCutoff,
    );
  } catch (e) {
    console.warn('pruneExpiredSessions failed', e && e.message);
  }
}

/** Mint a session for `user`, store it, and set the cookie on `res`. Returns the session id. */
async function createSession(req, res, user) {
  const id = genSessionId();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const userAgent = (req.get('user-agent') || '').slice(0, 255) || null;
  await db.run(
    'INSERT INTO sessions(id, user_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    user.id,
    nowIso,
    expiresAt,
    nowIso,
    userAgent,
  );
  res.cookie(SESSION_COOKIE, id, cookieOptions({ maxAge: SESSION_TTL_MS }));
  await pruneExpiredSessions();
  return id;
}

/**
 * Resolve the caller from their session cookie, or null. The only way a request acquires an
 * identity — there is no header or query fallback.
 */
async function getSessionUser(req) {
  const sid = readCookie(req, SESSION_COOKIE);
  if (!sid) return null;
  const row = await db.get(
    `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, ${USER_COLUMNS}
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.revoked_at IS NULL`,
    sid,
  );
  if (!row) return null;

  const expiresAt = row.expires_at ? Date.parse(row.expires_at) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await revokeSession(sid);
    return null;
  }

  const lastSeen = row.last_seen_at ? Date.parse(row.last_seen_at) : NaN;
  if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
    try {
      await db.run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', new Date().toISOString(), sid);
    } catch (e) {
      console.warn('session touch failed', e && e.message);
    }
  }

  return { ...publicUser(row), session_id: row.session_id };
}

/** Revoke rather than delete, so a stolen cookie's history survives an audit. */
async function revokeSession(sessionId) {
  if (!sessionId) return;
  await db.run('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', new Date().toISOString(), sessionId);
}

/** Sign out everywhere: used by /auth/logout-all and after a credential change. */
async function revokeAllSessionsForUser(userId) {
  if (!userId) return;
  await db.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', new Date().toISOString(), userId);
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  clearSessionCookie,
  createSession,
  getSessionUser,
  publicUser,
  pruneExpiredSessions,
  revokeAllSessionsForUser,
  revokeSession,
};
