// server/init_schema.js
// Ensure the database schema exists and reconcile legacy tables by adding missing columns.

async function ensureSchema(db) {
  // Helper to check if a table exists
  const tableExists = async (name) => {
    const row = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", name);
    return !!row;
  };
  // Helper to get existing columns for a table
  const getColumns = async (name) => {
    try {
      const cols = await db.all(`PRAGMA table_info('${name}')`);
      return new Set(cols.map(c => c.name));
    } catch (_) {
      return new Set();
    }
  };
  // Helper to create an index safely (skip if columns missing)
  const safeCreateIndex = async (sql, requiredCols = [], table = null) => {
    try {
      if (table && requiredCols.length) {
        const cols = await getColumns(table);
        if (!requiredCols.every(c => cols.has(c))) return; // skip if any missing
      }
      await db.run(sql);
    } catch (e) {
      // ignore if index creation fails due to legacy schema
      console.warn('Index create skipped:', e.message);
    }
  };

  // 1) Create tables that are fully missing
  await db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    discord_id TEXT,
    username TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    password_hash TEXT
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY,
    name TEXT,
    owner_user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    campaign_code TEXT,
    sort_index INTEGER DEFAULT 0,
    FOREIGN KEY(owner_user_id) REFERENCES users(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY,
    name TEXT,
    discord TEXT,
    timezone TEXT,
    notes TEXT
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY,
    player_id INTEGER,
    start_iso TEXT,
    end_iso TEXT,
    source TEXT DEFAULT 'manual',
    campaign_id INTEGER,
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS campaign_members (
    id INTEGER PRIMARY KEY,
    campaign_id INTEGER,
    user_id INTEGER,
    player_id INTEGER,
    role TEXT DEFAULT 'player',
    permissions TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY,
    token TEXT,
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
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    message TEXT,
    url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY,
    name TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    sort_index INTEGER DEFAULT 0,
    campaign_id INTEGER
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY,
    group_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    role TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(group_id, player_id),
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (player_id) REFERENCES players(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS group_suggestions (
    id INTEGER PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    params_json TEXT,
    result_json TEXT
  )`);

  // 2) Reconcile columns for legacy tables by adding missing columns
  // users: add discord_id unique via index later
  {
    const cols = await getColumns('users');
    const add = async (sql) => { try { await db.run(sql); } catch(_){} };
    if (!cols.has('discord_id')) await add("ALTER TABLE users ADD COLUMN discord_id TEXT");
    if (!cols.has('username')) await add("ALTER TABLE users ADD COLUMN username TEXT");
    if (!cols.has('created_at')) await add("ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT (datetime('now'))");
    if (!cols.has('password_hash')) await add("ALTER TABLE users ADD COLUMN password_hash TEXT");
  }

  // campaigns
  {
    const cols = await getColumns('campaigns');
    const add = async (sql) => { try { await db.run(sql); } catch(_){} };
    if (!cols.has('name')) await add("ALTER TABLE campaigns ADD COLUMN name TEXT");
    if (!cols.has('owner_user_id')) await add("ALTER TABLE campaigns ADD COLUMN owner_user_id INTEGER");
    if (!cols.has('created_at')) await add("ALTER TABLE campaigns ADD COLUMN created_at TEXT DEFAULT (datetime('now'))");
    if (!cols.has('campaign_code')) await add("ALTER TABLE campaigns ADD COLUMN campaign_code TEXT");
    if (!cols.has('sort_index')) await add("ALTER TABLE campaigns ADD COLUMN sort_index INTEGER DEFAULT 0");
  }

  // players
  {
    const cols = await getColumns('players');
    const add = async (sql) => { try { await db.run(sql); } catch(_){} };
    const defs = [
      ['discord', "TEXT"],
      ['timezone', "TEXT"],
      ['notes', "TEXT"],
      ['age', "TEXT"],
      ['computer_access', "TEXT"],
      ['pref_party_size', "TEXT"],
      ['pref_session_length', "TEXT"],
      ['pref_vtt', "TEXT"],
      ['pref_play_with', "TEXT"],
      ['pref_play_not_with', "TEXT"],
      ['campaign_id', "INTEGER"],
      ['discord_id', "TEXT"],
      ['password_hash', "TEXT"],
      ['unclaimed_at', "TEXT"],
      ['sort_index', "INTEGER DEFAULT 0"],
      ['pref_play_with_ids', "TEXT DEFAULT '[]'"],
      ['pref_play_not_with_ids', "TEXT DEFAULT '[]'"],
      ['ddb_url', "TEXT"],
      ['ddb_json', "TEXT"],
      ['ddb_avatar_url', "TEXT"],
    ];
    for (const [name, type] of defs) {
      if (!cols.has(name)) await add(`ALTER TABLE players ADD COLUMN ${name} ${type}`);
    }
  }

  // availability
  {
    const cols = await getColumns('availability');
    const add = async (sql) => { try { await db.run(sql); } catch(_){} };
    if (!cols.has('player_id')) await add("ALTER TABLE availability ADD COLUMN player_id INTEGER");
    if (!cols.has('start_iso')) await add("ALTER TABLE availability ADD COLUMN start_iso TEXT");
    if (!cols.has('end_iso')) await add("ALTER TABLE availability ADD COLUMN end_iso TEXT");
    if (!cols.has('source')) await add("ALTER TABLE availability ADD COLUMN source TEXT DEFAULT 'manual'");
    if (!cols.has('campaign_id')) await add("ALTER TABLE availability ADD COLUMN campaign_id INTEGER");
  }

  // campaign_members
  {
    const exists = await tableExists('campaign_members');
    if (exists) {
      const cols = await getColumns('campaign_members');
      const add = async (sql) => { try { await db.run(sql); } catch(_){} };
      if (!cols.has('campaign_id')) await add("ALTER TABLE campaign_members ADD COLUMN campaign_id INTEGER");
      if (!cols.has('user_id')) await add("ALTER TABLE campaign_members ADD COLUMN user_id INTEGER");
      if (!cols.has('player_id')) await add("ALTER TABLE campaign_members ADD COLUMN player_id INTEGER");
      if (!cols.has('role')) await add("ALTER TABLE campaign_members ADD COLUMN role TEXT DEFAULT 'player'");
      if (!cols.has('permissions')) await add("ALTER TABLE campaign_members ADD COLUMN permissions TEXT");
      if (!cols.has('created_at')) await add("ALTER TABLE campaign_members ADD COLUMN created_at TEXT DEFAULT (datetime('now'))");
    }
  }

  // invites
  {
    const cols = await getColumns('invites');
    const add = async (sql) => { try { await db.run(sql); } catch(_){} };
    if (!cols.has('token')) await add("ALTER TABLE invites ADD COLUMN token TEXT");
    if (!cols.has('campaign_id')) await add("ALTER TABLE invites ADD COLUMN campaign_id INTEGER");
    if (!cols.has('created_by_user_id')) await add("ALTER TABLE invites ADD COLUMN created_by_user_id INTEGER");
    if (!cols.has('expires_at')) await add("ALTER TABLE invites ADD COLUMN expires_at TEXT");
    if (!cols.has('max_uses')) await add("ALTER TABLE invites ADD COLUMN max_uses INTEGER DEFAULT 1");
    if (!cols.has('challenge_enabled')) await add("ALTER TABLE invites ADD COLUMN challenge_enabled INTEGER DEFAULT 0");
    if (!cols.has('challenge_min_score')) await add("ALTER TABLE invites ADD COLUMN challenge_min_score INTEGER DEFAULT 200");
    if (!cols.has('used_count')) await add("ALTER TABLE invites ADD COLUMN used_count INTEGER DEFAULT 0");
    if (!cols.has('created_at')) await add("ALTER TABLE invites ADD COLUMN created_at TEXT DEFAULT (datetime('now'))");
  }

  // feedback
  {
    const cols = await getColumns('feedback');
    const add = async (sql) => { try { await db.run(sql); } catch(_){} };
    if (!cols.has('user_id')) await add("ALTER TABLE feedback ADD COLUMN user_id INTEGER");
    if (!cols.has('message')) await add("ALTER TABLE feedback ADD COLUMN message TEXT");
    if (!cols.has('url')) await add("ALTER TABLE feedback ADD COLUMN url TEXT");
    if (!cols.has('created_at')) await add("ALTER TABLE feedback ADD COLUMN created_at TEXT DEFAULT (datetime('now'))");
  }

  // groups
  {
    const cols = await getColumns('groups');
    const add = async (sql) => { try { await db.run(sql); } catch(_){} };
    if (!cols.has('name')) await add("ALTER TABLE groups ADD COLUMN name TEXT");
    if (!cols.has('notes')) await add("ALTER TABLE groups ADD COLUMN notes TEXT");
    if (!cols.has('created_at')) await add("ALTER TABLE groups ADD COLUMN created_at TEXT DEFAULT (datetime('now'))");
    if (!cols.has('sort_index')) await add("ALTER TABLE groups ADD COLUMN sort_index INTEGER DEFAULT 0");
    if (!cols.has('campaign_id')) await add("ALTER TABLE groups ADD COLUMN campaign_id INTEGER");
  }

  // group_members
  {
    const cols = await getColumns('group_members');
    const add = async (sql) => { try { await db.run(sql); } catch(_){} };
    if (!cols.has('group_id')) await add("ALTER TABLE group_members ADD COLUMN group_id INTEGER");
    if (!cols.has('player_id')) await add("ALTER TABLE group_members ADD COLUMN player_id INTEGER");
    if (!cols.has('role')) await add("ALTER TABLE group_members ADD COLUMN role TEXT");
    if (!cols.has('created_at')) await add("ALTER TABLE group_members ADD COLUMN created_at TEXT DEFAULT (datetime('now'))");
  }

  // group_suggestions
  {
    const cols = await getColumns('group_suggestions');
    const add = async (sql) => { try { await db.run(sql); } catch(_){} };
    if (!cols.has('created_at')) await add("ALTER TABLE group_suggestions ADD COLUMN created_at TEXT DEFAULT (datetime('now'))");
    if (!cols.has('params_json')) await add("ALTER TABLE group_suggestions ADD COLUMN params_json TEXT");
    if (!cols.has('result_json')) await add("ALTER TABLE group_suggestions ADD COLUMN result_json TEXT");
  }

  // 3) Indexes (only if relevant columns exist)
  await safeCreateIndex('CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_code ON campaigns(campaign_code)', ['campaign_code'], 'campaigns');
  await safeCreateIndex('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id)', ['discord_id'], 'users');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_players_discord ON players(discord_id)', ['discord_id'], 'players');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_players_campaign ON players(campaign_id)', ['campaign_id'], 'players');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_availability_player ON availability(player_id)', ['player_id'], 'availability');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_avail_campaign ON availability(campaign_id)', ['campaign_id'], 'availability');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign ON campaign_members(campaign_id)', ['campaign_id'], 'campaign_members');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_campaign_members_user ON campaign_members(user_id)', ['user_id'], 'campaign_members');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token)', ['token'], 'invites');
}

module.exports = { ensureSchema };
