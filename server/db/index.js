// server/db/index.js
// Async DB access using Turso (libsql) with a small helper API.
//
// Two things here are not incidental, and both exist because a statement that never comes back
// looks exactly like a sleeping host from the client's side (`REQUEST_TIMEOUT_MS`, 45 s):
//
//   - the transport is HTTP, not the WebSocket a `libsql:` URL selects, and
//   - every statement has a deadline.
const { createClient } = require('@libsql/client');

const configuredUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || process.env.AUTH_TOKEN;

if (!configuredUrl) {
  throw new Error('Turso/LibSQL URL not configured. Set TURSO_DATABASE_URL');
}

// Best-effort: disable migrations wait behavior if present in the client version
if (!process.env.LIBSQL_CLIENT_DISABLE_MIGRATIONS && !process.env.LIBSQL_NO_MIGRATIONS) {
  process.env.LIBSQL_CLIENT_DISABLE_MIGRATIONS = '1';
}

function envInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * How long a single statement may take before it is abandoned.
 *
 * Turso answers in tens of milliseconds; anything past a few seconds is a connection that is not
 * going to answer at all. Generous enough for a cold libsql instance, far under the client's 45 s.
 */
const STATEMENT_TIMEOUT_MS = envInt('DB_TIMEOUT_MS', 15_000);

/**
 * `libsql:` selects the hrana WebSocket transport, which holds one long-lived socket and has no
 * per-request timeout. When that socket dies without a close frame — an idle NAT timeout is the
 * usual way — the client never learns, so it writes the next statement into a dead connection and
 * the promise simply never settles. Turso serves the same host over HTTP, where every statement is
 * its own request. Set `LIBSQL_TRANSPORT=ws` to go back.
 */
function resolveUrl(url) {
  if (process.env.LIBSQL_TRANSPORT === 'ws') return url;
  if (!url.startsWith('libsql://')) return url;
  if (/[?&]tls=0(&|$)/.test(url)) return url; // only ws can carry an unencrypted libsql: URL
  return `https://${url.slice('libsql://'.length)}`;
}

const url = resolveUrl(configuredUrl);

let client = createClient({ url, authToken });

/**
 * Replace the connection after a statement was abandoned. The old one is closed best-effort: it is
 * already suspect, and a client that fails to close must not stop the next request from getting a
 * working one.
 */
function recycleClient() {
  const stale = client;
  client = createClient({ url, authToken });
  try {
    stale.close();
  } catch (e) {
    console.warn('closing the stale libsql client failed', e?.message);
  }
}

// Normalize params: accept (...params) or ([params]) or object
function normParams(args) {
  if (!args || args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return Array.from(args);
}

/** A statement with no side effect, so abandoning one and sending it again cannot double-apply. */
function isReadOnly(sql) {
  return /^\s*(?:select|pragma|with)\b/i.test(String(sql));
}

function deadline(promise, sql) {
  let timer;
  const expiry = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`db_timeout after ${STATEMENT_TIMEOUT_MS}ms: ${String(sql).slice(0, 120)}`);
      error.code = 'db_timeout';
      reject(error);
    }, STATEMENT_TIMEOUT_MS);
  });
  return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}

/**
 * Run one statement under the deadline. A read is sent once more on a fresh connection, because
 * the overwhelmingly likely cause is a connection that died between requests; a write is not,
 * because the server cannot tell a lost request from a lost answer.
 */
async function execute(sql, params = []) {
  try {
    return await deadline(client.execute({ sql, args: params }), sql);
  } catch (e) {
    if (e?.code !== 'db_timeout') throw e;
    console.warn('libsql statement timed out, recycling the connection:', e.message);
    recycleClient();
    if (!isReadOnly(sql)) throw e;
    return await deadline(client.execute({ sql, args: params }), sql);
  }
}

async function get(sql, ...args) {
  const res = await execute(sql, normParams(args));
  return (res.rows && res.rows[0]) || null;
}

async function all(sql, ...args) {
  const res = await execute(sql, normParams(args));
  return res.rows || [];
}

async function run(sql, ...args) {
  const res = await execute(sql, normParams(args));
  return {
    changes: res.rowsAffected || 0,
    lastInsertRowid: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : undefined,
  };
}

function splitStatements(sql) {
  return String(sql).split(/;\s*\n?|;$/).map((s) => s.trim()).filter(Boolean);
}

async function exec(sql) {
  // Execute possibly multiple statements separated by ;
  for (const p of splitStatements(sql)) {
    await execute(p, []);
  }
}

async function pragma(_) {
  // No-op for tuning pragmas. Use PRAGMA statements via all/get if needed.
  return null;
}

async function transaction(callback) {
  // Use libsql client's native transaction to keep a single session. Statements inside it carry
  // the same deadline, but never the retry: a transaction that lost its connection is over.
  const tx = await deadline(client.transaction(), 'BEGIN');
  const txExecute = async (sql, params = []) => deadline(tx.execute({ sql, args: params }), sql);
  const txGet = async (sql, ...args) => {
    const res = await txExecute(sql, normParams(args));
    return (res.rows && res.rows[0]) || null;
  };
  const txAll = async (sql, ...args) => {
    const res = await txExecute(sql, normParams(args));
    return res.rows || [];
  };
  const txRun = async (sql, ...args) => {
    const res = await txExecute(sql, normParams(args));
    return {
      changes: res.rowsAffected || 0,
      lastInsertRowid: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : undefined,
    };
  };
  const txExec = async (sql) => {
    for (const p of splitStatements(sql)) {
      await txExecute(p, []);
    }
  };

  try {
    const trx = { execute: txExecute, get: txGet, all: txAll, run: txRun, exec: txExec };
    const out = await callback(trx);
    await deadline(tx.commit(), 'COMMIT');
    return out;
  } catch (e) {
    try { await tx.rollback(); } catch (rollbackError) { console.warn('rollback failed', rollbackError?.message); }
    throw e;
  }
}

module.exports = { execute, get, all, run, exec, pragma, transaction, STATEMENT_TIMEOUT_MS };
