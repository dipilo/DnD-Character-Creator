// server/dbx.js
// Async DB access using Turso (libsql) with a small helper API
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || process.env.AUTH_TOKEN;

if (!url) {
  throw new Error('Turso/LibSQL URL not configured. Set TURSO_DATABASE_URL');
}

// Best-effort: disable migrations wait behavior if present in the client version
if (!process.env.LIBSQL_CLIENT_DISABLE_MIGRATIONS && !process.env.LIBSQL_NO_MIGRATIONS) {
  process.env.LIBSQL_CLIENT_DISABLE_MIGRATIONS = '1';
}

const client = createClient({ url, authToken });

// Normalize params: accept (...params) or ([params]) or object
function normParams(args) {
  if (!args || args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return Array.from(args);
}

async function execute(sql, params = []) {
  const res = await client.execute({ sql, args: params });
  // libsql returns { rows, columns, rowsAffected, lastInsertRowid }
  return res;
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

async function exec(sql) {
  // Execute possibly multiple statements separated by ;
  const parts = String(sql).split(/;\s*\n?|;$/).map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    await execute(p, []);
  }
}

async function pragma(_) {
  // No-op for tuning pragmas. Use PRAGMA statements via all/get if needed.
  return null;
}

async function transaction(callback) {
  // Use libsql client's native transaction to keep a single session
  const tx = await client.transaction();
  const txExecute = async (sql, params = []) => tx.execute({ sql, args: params });
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
    const parts = String(sql).split(/;\s*\n?|;$/).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      await txExecute(p, []);
    }
  };

  try {
    const trx = { execute: txExecute, get: txGet, all: txAll, run: txRun, exec: txExec };
    const out = await callback(trx);
    await tx.commit();
    return out;
  } catch (e) {
    try { await tx.rollback(); } catch (_) {}
    throw e;
  }
}

module.exports = { execute, get, all, run, exec, pragma, transaction };
