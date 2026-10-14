// Turso over HTTP, not the WebSocket a `libsql:` URL picks, and every statement has a deadline.
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

/** Past a few seconds is a connection that will not answer; well under the client's 45 s. */
const STATEMENT_TIMEOUT_MS = envInt('DB_TIMEOUT_MS', 15_000);

/** A dead hrana socket never settles the next statement; `LIBSQL_TRANSPORT=ws` goes back. */
function resolveUrl(url) {
  if (process.env.LIBSQL_TRANSPORT === 'ws') return url;
  if (!url.startsWith('libsql://')) return url;
  if (/[?&]tls=0(&|$)/.test(url)) return url; // only ws can carry an unencrypted libsql: URL
  return `https://${url.slice('libsql://'.length)}`;
}

const url = resolveUrl(configuredUrl);

/** Longer than the statement deadline, so a caller still sees `db_timeout`. */
const HTTP_TIMEOUT_MS = STATEMENT_TIMEOUT_MS + 1_000;

/** `characters.data` is a sheet with a portrait inline, so it gets its own deadline. */
const DOCUMENT_TIMEOUT_MS = envInt('DB_DOCUMENT_TIMEOUT_MS', 60_000);

/** The platform `fetch`: the isomorphic one never settles `json()` over 64 KiB. */
function timedFetch(input, init) {
  return globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
}

/** Its own client, or raising the global timeout would hang the ordinary path too. */
function timedDocumentFetch(input, init) {
  return globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(DOCUMENT_TIMEOUT_MS + 1_000) });
}

let client = createClient({ url, authToken, fetch: timedFetch });
let documentClient = createClient({ url, authToken, fetch: timedDocumentFetch });

/** Closed best-effort: a client that cannot close must not block the next request. */
function recycleClient() {
  const stale = client;
  client = createClient({ url, authToken, fetch: timedFetch });
  closeStale(stale);
}

function recycleDocumentClient() {
  const stale = documentClient;
  documentClient = createClient({ url, authToken, fetch: timedDocumentFetch });
  closeStale(stale);
}

function closeStale(stale) {
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

function deadline(promise, sql, timeoutMs = STATEMENT_TIMEOUT_MS) {
  let timer;
  const expiry = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`db_timeout after ${timeoutMs}ms: ${String(sql).slice(0, 120)}`);
      error.code = 'db_timeout';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}

/** A read retries once on a fresh connection; a write cannot, lost request or lost answer. */
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

/** Not retried: at a minute the likely cause is the transfer, and a resend blows the budget. */
async function getDocument(sql, ...args) {
  try {
    const res = await deadline(documentClient.execute({ sql, args: normParams(args) }), sql, DOCUMENT_TIMEOUT_MS);
    return (res.rows && res.rows[0]) || null;
  } catch (e) {
    if (e?.code === 'db_timeout') {
      console.warn('libsql document read timed out, recycling the connection:', e.message);
      recycleDocumentClient();
    }
    throw e;
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

module.exports = {
  execute, get, getDocument, all, run, exec, pragma, transaction,
  STATEMENT_TIMEOUT_MS, DOCUMENT_TIMEOUT_MS,
};
