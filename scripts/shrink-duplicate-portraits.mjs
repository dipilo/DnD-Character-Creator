// One-time repair for characters stored with their portrait twice.
//
// `avatar` predates `portrait.imageDataUrl` and every reader falls back to it, so the builder used
// to write both — a 107 KB data URL became a 217 KB row, which is what put the document read past
// the database's statement deadline and 500'd those characters. The builder writes one copy now;
// this drops the second from rows that already have it.
//
// Safe by construction: a document is only touched when the two fields are byte-identical, so
// nothing a reader can see changes. `version` is deliberately left alone — the sheet did not
// change, and bumping it would hand every other device a spurious conflict.
//
//   node scripts/shrink-duplicate-portraits.mjs              # report only
//   node scripts/shrink-duplicate-portraits.mjs --write      # apply
//
// Reads the same TURSO_DATABASE_URL / LIBSQL_URL the server does; a `file:` URL works for a local
// copy, which is the sensible place to try it first.
//
// One row's document is read per request. Selecting every `data` column in one statement is the
// read that made characters with a portrait answer 500 in the first place, and against the HTTP
// pipeline it simply never came back.

const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || process.env.AUTH_TOKEN;
const apply = process.argv.includes('--write');

const REQUEST_TIMEOUT_MS = 60_000;

/** Turso's HTTP pipeline, spoken directly: no driver, so a failure is always a thrown error. */
function remoteConnection(databaseUrl) {
  const endpoint = `${databaseUrl.replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '')}/v2/pipeline`;
  const encode = (value) => {
    if (value === null || value === undefined) return { type: 'null' };
    if (typeof value === 'number') return Number.isInteger(value)
      ? { type: 'integer', value: String(value) }
      : { type: 'float', value };
    return { type: 'text', value: String(value) };
  };
  const decode = (cell) => {
    if (!cell || cell.type === 'null') return null;
    if (cell.type === 'integer') return Number(cell.value);
    return cell.value;
  };

  return {
    async execute(sql, args = []) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          requests: [
            { type: 'execute', stmt: { sql, args: args.map(encode) } },
            { type: 'close' },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} from ${endpoint}: ${(await response.text()).slice(0, 400)}`);
      }
      const payload = await response.json();
      const first = payload?.results?.[0];
      if (first?.type !== 'ok') throw new Error(`database refused the statement: ${first?.error?.message ?? JSON.stringify(first)}`);
      const result = first.response.result;
      const columns = result.cols.map((col) => col.name);
      return result.rows.map((cells) => Object.fromEntries(columns.map((name, i) => [name, decode(cells[i])])));
    },
    async close() {},
  };
}

/** A local copy needs the driver, and a `file:` URL never touches the network. */
async function localConnection(databaseUrl) {
  const { createClient } = await import('@libsql/client');
  const client = createClient({ url: databaseUrl });
  return {
    async execute(sql, args = []) {
      const { rows } = await client.execute({ sql, args });
      return rows.map((row) => ({ ...row }));
    },
    close: () => client.close(),
  };
}

function connect(databaseUrl) {
  if (databaseUrl.startsWith('file:') || databaseUrl.startsWith(':memory:')) return localConnection(databaseUrl);
  return remoteConnection(databaseUrl);
}

async function main() {
  if (!url) {
    console.error('Set TURSO_DATABASE_URL (a file: URL is fine for a local copy).');
    process.exitCode = 1;
    return;
  }

  const db = await connect(url);
  try {
    const summaries = await db.execute(
      'SELECT id, name, length(data) AS bytes FROM characters WHERE deleted_at IS NULL ORDER BY length(data) DESC',
    );
    console.log(`${summaries.length} characters to check.`);

    let repaired = 0;
    let saved = 0;
    for (const summary of summaries) {
      // Nothing under a few kilobytes can be carrying a duplicated portrait.
      if (Number(summary.bytes) < 4_000) continue;

      const [row] = await db.execute('SELECT data FROM characters WHERE id = ?', [summary.id]);
      if (!row?.data) continue;

      let document;
      try {
        document = JSON.parse(row.data);
      } catch (e) {
        console.warn(`skip ${summary.id}: data is not valid JSON (${e?.message})`);
        continue;
      }
      if (!document?.avatar || document.avatar !== document.portrait?.imageDataUrl) continue;

      delete document.avatar;
      const text = JSON.stringify(document);
      const before = Number(summary.bytes);
      const after = Buffer.byteLength(text, 'utf8');
      repaired += 1;
      saved += before - after;
      console.log(`${apply ? 'shrink' : 'would shrink'} ${summary.name ?? summary.id}: ${before} -> ${after} bytes`);
      if (apply) await db.execute('UPDATE characters SET data = ? WHERE id = ?', [text, summary.id]);
    }

    console.log(`\n${repaired} of ${summaries.length} characters carry the portrait twice; ${saved} bytes ${apply ? 'freed' : 'would be freed'}.`);
    if (!apply && repaired > 0) console.log('Re-run with --write to apply.');
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error(`failed: ${e?.name ?? ''} ${e?.message ?? e}`);
  process.exitCode = 1;
});
