#!/usr/bin/env node
// Database backup and migration utility.
//
// Runs through the same libsql client the server uses (MERGE_PLAN.md §5.5: there is one DB code
// path, not two). That matters for the SQL dump — it now dumps whatever database the server
// actually talks to, including a remote Turso one, where the old better-sqlite3 version could
// only ever read a local file that production does not have.
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

// Paths are relative to server/, not server/db/, so the data file and backups do not move.
const CURRENT_DB = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/** The database the server would open, as a libsql URL. */
function resolveDbUrl() {
  const configured = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL;
  if (configured) return configured;
  return `file:${CURRENT_DB.replaceAll('\\', '/')}`;
}

/** Copying and restoring files only makes sense when the database is a local file. */
function localFilePath() {
  const url = resolveDbUrl();
  if (!url.startsWith('file:')) return null;
  return url.slice('file:'.length);
}

/** libsql column values are loosely typed; narrow to a string rather than stringifying blindly. */
function asText(value) {
  return typeof value === 'string' ? value : '';
}

function quoteSqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'string') return `'${v.replaceAll("'", "''")}'`;
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString('hex')}'`;
  return String(v);
}

async function writeSqlDump(timestamp) {
  const client = createClient({
    url: resolveDbUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || process.env.AUTH_TOKEN,
  });
  const sqlDumpPath = path.join(BACKUP_DIR, `dnd_backup_${timestamp}.sql`);
  try {
    const tables = await client.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    let sqlDump = `-- Database backup created at ${new Date().toISOString()}\n\n`;

    for (const table of tables.rows) {
      const tableName = asText(table.name);
      if (!tableName) continue;
      const createSql = asText(table.sql);
      if (createSql) sqlDump += `${createSql};\n\n`;

      const rows = (await client.execute(`SELECT * FROM "${tableName}"`)).rows;
      if (rows.length === 0) continue;
      sqlDump += `-- Data for table ${tableName}\n`;
      for (const row of rows) {
        const columns = Object.keys(row).join(', ');
        const values = Object.values(row).map(quoteSqlValue).join(', ');
        sqlDump += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
      }
      sqlDump += '\n';
    }

    fs.writeFileSync(sqlDumpPath, sqlDump);
    console.log(`📄 SQL dump created: ${sqlDumpPath}`);
    return sqlDumpPath;
  } catch (error) {
    console.warn('⚠️  Failed to create SQL dump:', error.message);
    return null;
  } finally {
    try { client.close(); } catch (e) { console.warn('client close failed:', e.message); }
  }
}

async function createBackup() {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const filePath = localFilePath();

  // Byte-for-byte copy, only possible for a local file database.
  if (filePath && fs.existsSync(filePath)) {
    const backupPath = path.join(BACKUP_DIR, `dnd_backup_${timestamp}.db`);
    console.log(`📦 Creating backup: ${backupPath}`);
    fs.copyFileSync(filePath, backupPath);
    console.log('✅ Backup created successfully');
  } else if (filePath) {
    console.log('⚠️  No database file found to copy — writing the SQL dump only');
  } else {
    console.log('ℹ️  Remote database configured — writing the SQL dump only');
  }

  await writeSqlDump(timestamp);
}

function listBackups() {
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.db'))
    .map(file => ({
      name: file,
      path: path.join(BACKUP_DIR, file),
      created: fs.statSync(path.join(BACKUP_DIR, file)).mtime
    }))
    .sort((a, b) => b.created - a.created);

  console.log('\n📋 Available backups:');
  backups.forEach((backup, index) => {
    console.log(`  ${index + 1}. ${backup.name} (${backup.created.toLocaleString()})`);
  });

  return backups;
}

function restoreBackup(backupPath) {
  const filePath = localFilePath();
  if (!filePath) {
    throw new Error('Restore only supports a local file database; a remote libsql URL is configured');
  }
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  console.log(`🔄 Restoring backup: ${backupPath}`);

  // Create backup of current DB first
  if (fs.existsSync(filePath)) {
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const preRestoreBackup = path.join(BACKUP_DIR, `pre_restore_${timestamp}.db`);
    fs.copyFileSync(filePath, preRestoreBackup);
    console.log(`📦 Current database backed up to: ${preRestoreBackup}`);
  }

  // Restore from backup
  fs.copyFileSync(backupPath, filePath);
  console.log('✅ Database restored from backup');
}

function usage() {
  console.log(`
🗄️  Database Migration Utility

Commands:
  backup    Create a backup of current database
  list      List all available backups
  restore   Restore from a backup file

Examples:
  node db/migrate.js backup
  node db/migrate.js list
  node db/migrate.js restore dnd_backup_2024-10-22T10-30-00-000Z.db

Environment Variables:
  DATABASE_PATH        Path to the local database file (default: ./data.db)
  TURSO_DATABASE_URL   libsql URL, when the server is pointed at a remote database
  `);
}

// Command line interface
async function main() {
  const command = process.argv[2];
  switch (command) {
    case 'backup':
      await createBackup();
      break;

    case 'list':
      listBackups();
      break;

    case 'restore': {
      const backupFile = process.argv[3];
      if (!backupFile) {
        console.error('❌ Please specify backup file to restore');
        console.log('Usage: node db/migrate.js restore <backup-filename>');
        process.exit(1);
      }
      const backupPath = path.isAbsolute(backupFile) ? backupFile : path.join(BACKUP_DIR, backupFile);
      restoreBackup(backupPath);
      break;
    }

    default:
      usage();
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exitCode = 1;
});
