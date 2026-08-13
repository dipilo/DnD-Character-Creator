// server/db/legacy-better-sqlite3.js (was server/db.js)
//
// Unreferenced as of the merge: server.js talks to libsql through ./index.js, and db/migrate.js
// opens better-sqlite3 directly. Kept because MERGE_PLAN.md Phase 1b decides its fate.
// Paths below are relative to server/, not server/db/, so the data file does not move.
const Database = require('better-sqlite3');
const path = require('path');

// Production-ready database path configuration
const getDatabasePath = () => {
  // Use environment variable if provided (for production)
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  
  // Default to local data.db file
  return path.join(__dirname, '..', 'data.db');
};

const dbPath = getDatabasePath();
console.log(`📊 Opening database: ${dbPath}`);

// Create database with production-ready options
const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : null
});

// create base table if not exists (keeps backward compatibility)
db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,
  name TEXT,
  discord TEXT,
  timezone TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS availability (
  id INTEGER PRIMARY KEY,
  player_id INTEGER,
  start_iso TEXT,
  end_iso TEXT,
  source TEXT DEFAULT 'manual',
  campaign_id INTEGER,
  FOREIGN KEY(player_id) REFERENCES players(id)
);

-- Users table: represents accounts (for OAuth like Discord)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  discord_id TEXT UNIQUE,
  username TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Campaigns: each campaign belongs to a user (owner_user_id)
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY,
  name TEXT,
  owner_user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

-- Campaign members: links users and/or players to campaigns with a role
CREATE TABLE IF NOT EXISTS campaign_members (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER,
  user_id INTEGER,
  player_id INTEGER,
  role TEXT DEFAULT 'player', -- 'owner' or 'player'
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(player_id) REFERENCES players(id)
);

-- Invite tokens for sharing a campaign
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY,
  token TEXT UNIQUE,
  campaign_id INTEGER,
  created_by_user_id INTEGER,
  expires_at TEXT,
  max_uses INTEGER DEFAULT 1,
  challenge_enabled INTEGER DEFAULT 0,
  challenge_min_score INTEGER DEFAULT 200,
  used_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);

-- Feedback table for user bug reports
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  message TEXT,
  url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

// add structured player columns if missing
const needed = [
  { name: 'age', type: 'TEXT' },
  { name: 'computer_access', type: 'TEXT' },
  { name: 'pref_party_size', type: 'TEXT' },
  { name: 'pref_session_length', type: 'TEXT' },
  { name: 'pref_vtt', type: 'TEXT' },
  { name: 'pref_play_with', type: 'TEXT' },
  { name: 'pref_play_not_with', type: 'TEXT' }
];

// additional columns to support campaigns / auth
needed.push({ name: 'campaign_id', type: 'INTEGER' });
needed.push({ name: 'discord_id', type: 'TEXT' });
needed.push({ name: 'password_hash', type: 'TEXT' });
needed.push({ name: 'unclaimed_at', type: 'TEXT' }); // timestamp when player was explicitly unclaimed
// campaign_code: short unique code for a campaign (optional)
// stored on campaigns table and unique across campaigns
try {
  const campCols = db.prepare("PRAGMA table_info('campaigns')").all().map(c => c.name);
  if (!campCols.includes('campaign_code')) {
    db.prepare('ALTER TABLE campaigns ADD COLUMN campaign_code TEXT').run();
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_code ON campaigns(campaign_code)').run();
  }
} catch (e) { /* ignore migration errors */ }

// Ensure users table has password_hash to support local username/password logins
try {
  const uCols = db.prepare("PRAGMA table_info('users')").all().map(c => c.name);
  if (!uCols.includes('password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;');
    console.log('Added users.password_hash');
  }
} catch (e) {
  console.warn('Failed to add users.password_hash', e && e.message);
}

const cols = db.prepare("PRAGMA table_info('players')").all().map(c => c.name);
for (const col of needed) {
  if (!cols.includes(col.name)) {
    try {
      db.exec(`ALTER TABLE players ADD COLUMN ${col.name} ${col.type};`);
      console.log('Added column players.' + col.name);
    } catch (e) {
      console.error('Failed to add column', col.name, e.message);
    }
  }
}

// Ensure availability has campaign_id column (older DBs may not)
const availCols = db.prepare("PRAGMA table_info('availability')").all().map(c => c.name);
if (!availCols.includes('campaign_id')) {
  try {
    db.exec(`ALTER TABLE availability ADD COLUMN campaign_id INTEGER;`);
    console.log('Added column availability.campaign_id');
  } catch (e) {
    console.error('Failed to add column availability.campaign_id', e.message);
  }
}

// Backfill existing availability rows: set campaign_id from the player's campaign_id when possible
try {
  const info = db.prepare(`
    UPDATE availability
    SET campaign_id = (SELECT campaign_id FROM players WHERE players.id = availability.player_id)
    WHERE campaign_id IS NULL AND player_id IS NOT NULL
  `).run();
  if (info && typeof info.changes === 'number') {
    console.log('Backfilled availability.campaign_id for rows:', info.changes);
  }
} catch (e) {
  console.warn('Failed to backfill availability.campaign_id', e && e.message);
}

// Create indexes for quicker lookups
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_players_discord ON players(discord_id);
  CREATE INDEX IF NOT EXISTS idx_avail_campaign ON availability(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign ON campaign_members(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_campaign_members_user ON campaign_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
  CREATE INDEX IF NOT EXISTS idx_players_campaign ON players(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_availability_player ON availability(player_id);
  `);
  
  // Set SQLite performance pragmas
  db.pragma('journal_mode = WAL'); // Write-ahead logging for better concurrency
  db.pragma('synchronous = NORMAL'); // Faster writes, still safe
  db.pragma('cache_size = 10000'); // Larger cache
  db.pragma('temp_store = MEMORY'); // Store temp data in memory
  
} catch (e) {
  console.error('Failed creating indexes or setting pragmas', e.message);
}

// Ensure groups table has campaign_id column for scoping groups to campaigns
try {
  const gCols = db.prepare("PRAGMA table_info('groups')").all().map(c => c.name);
  if (!gCols.includes('campaign_id')) {
    console.log('Adding campaign_id column to groups table...');
    db.exec('ALTER TABLE groups ADD COLUMN campaign_id INTEGER;');
    console.log('Added groups.campaign_id');
  }
} catch (e) {
  console.warn('Failed to add groups.campaign_id', e && e.message);
}

// Ensure campaign_members has a permissions column to store owner-configured permissions
try {
  const cmCols = db.prepare("PRAGMA table_info('campaign_members')").all().map(c => c.name);
  if (!cmCols.includes('permissions')) {
    console.log('Adding permissions column to campaign_members...');
    db.exec('ALTER TABLE campaign_members ADD COLUMN permissions TEXT;');
    console.log('Added campaign_members.permissions');
    // Example permission keys supported: can_create_invites, can_unclaim, can_edit_self
    // New supported keys: can_manage_groups, can_create_players, can_delete_players, can_manage_members
  }
} catch (e) {
  console.warn('Failed to add campaign_members.permissions', e && e.message);
}

// Backfill groups.campaign_id where possible: derive from group_members -> players.campaign_id
try {
  const groups = db.prepare('SELECT id FROM groups').all();
  const upd = db.prepare('UPDATE groups SET campaign_id = ? WHERE id = ?');
  let setCount = 0;
  for (const g of groups) {
    const rows = db.prepare(`
      SELECT p.campaign_id FROM players p
      JOIN group_members gm ON gm.player_id = p.id
      WHERE gm.group_id = ?
    `).all(g.id).map(r => r.campaign_id).filter(c => c != null);
    if (rows.length === 0) continue;
    const unique = Array.from(new Set(rows));
    if (unique.length === 1) {
      upd.run(unique[0], g.id);
      setCount++;
    } else {
      // Mixed campaign membership; leave NULL to avoid incorrect scoping
      console.log('Group', g.id, 'has mixed campaign members; leaving campaign_id NULL');
    }
  }
  if (setCount > 0) console.log('Backfilled groups.campaign_id for groups:', setCount);
} catch (e) {
  console.warn('Failed to backfill groups.campaign_id', e && e.message);
}

module.exports = db;

// Optional: Auto-import backup SQL into an empty database on first boot
// Enable by setting DB_AUTO_IMPORT_BACKUP=latest (or a specific filename in ./server/backups)
try {
  const wantImport = process.env.DB_AUTO_IMPORT_BACKUP;
  if (wantImport) {
    // consider DB empty if core tables have no rows
    const rowCount = (tbl) => {
      try { return (db.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get() || {}).c || 0; } catch (_) { return 0; }
    };
    const isEmpty = rowCount('users') === 0 && rowCount('players') === 0 && rowCount('campaigns') === 0;
    if (isEmpty) {
      const fs = require('fs');
      const path = require('path');
      const backupsDir = path.join(__dirname, '..', 'backups');
      let sqlFile = null;
      if (wantImport.toLowerCase() === 'latest') {
        const files = (fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir) : []).filter(f => f.toLowerCase().endsWith('.sql'));
        if (files.length > 0) {
          files.sort((a,b) => {
            try {
              const sa = fs.statSync(path.join(backupsDir,a)).mtimeMs;
              const sb = fs.statSync(path.join(backupsDir,b)).mtimeMs;
              return sb - sa;
            } catch(_) { return 0; }
          });
          sqlFile = path.join(backupsDir, files[0]);
        }
      } else {
        // exact filename or absolute path
        const candidate = path.isAbsolute(wantImport) ? wantImport : path.join(backupsDir, wantImport);
        if (fs.existsSync(candidate)) sqlFile = candidate;
      }
      if (sqlFile) {
        try {
          const raw = fs.readFileSync(sqlFile, 'utf8');
          // Skip CREATE TABLE statements (tables already created/migrated above)
          const statements = raw
            .split(/;\s*\n/)
            .map(s => s.trim())
            .filter(s => s && !/^CREATE\s+TABLE/i.test(s));
          const tx = db.transaction((stmts) => { stmts.forEach(st => db.exec(st + ';')); });
          tx(statements);
          console.log(`✅ Imported backup SQL into empty DB: ${path.basename(sqlFile)}`);
        } catch (e) {
          console.warn('⚠️  Failed to auto-import backup SQL:', e && e.message);
        }
      } else {
        console.warn('⚠️  DB_AUTO_IMPORT_BACKUP was set but no SQL backup file found to import');
      }
    }
  }
} catch (e) {
  console.warn('DB auto-import check failed:', e && e.message);
}
