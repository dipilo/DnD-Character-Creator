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
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || process.env.AUTH_TOKEN;
if (!url) {
  console.error('Set TURSO_DATABASE_URL (a file: URL is fine for a local copy).');
  process.exit(1);
}

const apply = process.argv.includes('--write');
const client = createClient({ url, authToken });

const { rows } = await client.execute(
  'SELECT id, name, length(data) AS bytes, data FROM characters WHERE deleted_at IS NULL ORDER BY length(data) DESC',
);

let repaired = 0;
let saved = 0;
for (const row of rows) {
  let document;
  try {
    document = JSON.parse(row.data);
  } catch (e) {
    console.warn(`skip ${row.id}: data is not valid JSON (${e?.message})`);
    continue;
  }
  if (!document?.avatar || document.avatar !== document.portrait?.imageDataUrl) continue;

  delete document.avatar;
  const text = JSON.stringify(document);
  const freed = Number(row.bytes) - Buffer.byteLength(text, 'utf8');
  repaired += 1;
  saved += freed;
  console.log(`${apply ? 'shrink' : 'would shrink'} ${row.name ?? row.id}: ${row.bytes} -> ${row.bytes - freed} bytes`);
  if (apply) await client.execute({ sql: 'UPDATE characters SET data = ? WHERE id = ?', args: [text, row.id] });
}

console.log(`\n${repaired} of ${rows.length} characters carry the portrait twice; ${saved} bytes ${apply ? 'freed' : 'would be freed'}.`);
if (!apply && repaired > 0) console.log('Re-run with --write to apply.');
await client.close();
