// server/init_schema.js
// Ensure the database schema exists and reconcile legacy tables by adding missing columns.

// A table, not a branch per column: the branches were this function's whole complexity.
const LEGACY_COLUMNS = {
  users: [
    ['discord_id', 'TEXT'],
    ['username', 'TEXT'],
    ['created_at', "TEXT DEFAULT (datetime('now'))"],
    ['password_hash', 'TEXT'],
  ],
  campaigns: [
    ['name', 'TEXT'],
    ['owner_user_id', 'INTEGER'],
    ['created_at', "TEXT DEFAULT (datetime('now'))"],
    ['campaign_code', 'TEXT'],
    ['sort_index', 'INTEGER DEFAULT 0'],
    ['allowed_source_ids', 'TEXT'],
    ['system_id', 'TEXT'],
    ['default_member_permissions', 'TEXT'],
    ['default_invite_permissions', 'TEXT'],
    ['requests_character_edit', 'INTEGER DEFAULT 0'],
    ['default_auto_claim_seats', 'TEXT'],
  ],
  players: [
    ['discord', 'TEXT'],
    ['timezone', 'TEXT'],
    ['notes', 'TEXT'],
    ['age', 'TEXT'],
    ['computer_access', 'TEXT'],
    ['pref_party_size', 'TEXT'],
    ['pref_session_length', 'TEXT'],
    ['pref_vtt', 'TEXT'],
    ['pref_play_with', 'TEXT'],
    ['pref_play_not_with', 'TEXT'],
    ['campaign_id', 'INTEGER'],
    ['discord_id', 'TEXT'],
    ['password_hash', 'TEXT'],
    ['unclaimed_at', 'TEXT'],
    ['sort_index', 'INTEGER DEFAULT 0'],
    ['pref_play_with_ids', "TEXT DEFAULT '[]'"],
    ['pref_play_not_with_ids', "TEXT DEFAULT '[]'"],
    ['ddb_url', 'TEXT'],
    ['ddb_json', 'TEXT'],
    ['ddb_avatar_url', 'TEXT'],
  ],
  availability: [
    ['player_id', 'INTEGER'],
    ['start_iso', 'TEXT'],
    ['end_iso', 'TEXT'],
    ['source', "TEXT DEFAULT 'manual'"],
    ['campaign_id', 'INTEGER'],
  ],
  campaign_members: [
    ['campaign_id', 'INTEGER'],
    ['user_id', 'INTEGER'],
    ['player_id', 'INTEGER'],
    ['role', "TEXT DEFAULT 'player'"],
    ['permissions', 'TEXT'],
    ['created_at', "TEXT DEFAULT (datetime('now'))"],
    ['character_edit_consent', 'INTEGER DEFAULT 0'],
    ['auto_claim_override', 'TEXT'],
    ['auto_claim_preference', 'TEXT'],
  ],
  invites: [
    ['token', 'TEXT'],
    ['campaign_id', 'INTEGER'],
    ['created_by_user_id', 'INTEGER'],
    ['expires_at', 'TEXT'],
    ['max_uses', 'INTEGER DEFAULT 1'],
    ['challenge_enabled', 'INTEGER DEFAULT 0'],
    ['challenge_min_score', 'INTEGER DEFAULT 200'],
    ['used_count', 'INTEGER DEFAULT 0'],
    ['created_at', "TEXT DEFAULT (datetime('now'))"],
    ['permissions', 'TEXT'],
  ],
  feedback: [
    ['user_id', 'INTEGER'],
    ['message', 'TEXT'],
    ['url', 'TEXT'],
    ['created_at', "TEXT DEFAULT (datetime('now'))"],
  ],
  groups: [
    ['name', 'TEXT'],
    ['notes', 'TEXT'],
    ['color', 'TEXT'],
    ['target_size', 'INTEGER'],
    ['created_at', "TEXT DEFAULT (datetime('now'))"],
    ['sort_index', 'INTEGER DEFAULT 0'],
    ['campaign_id', 'INTEGER'],
  ],
  group_members: [
    ['group_id', 'INTEGER'],
    ['player_id', 'INTEGER'],
    ['role', 'TEXT'],
    ['created_at', "TEXT DEFAULT (datetime('now'))"],
  ],
  group_suggestions: [
    ['created_at', "TEXT DEFAULT (datetime('now'))"],
    ['params_json', 'TEXT'],
    ['result_json', 'TEXT'],
  ],
  // Phase 5 added `summary` to a table Phase 2 had already shipped; sharing added the two after it.
  characters: [
    ['summary', 'TEXT'],
    ['visibility', 'TEXT'],
    ['share_token', 'TEXT'],
  ],
};

async function ensureSchema(db) {
  // Helper to get existing columns for a table
  const getColumns = async (name) => {
    try {
      const cols = await db.all(`PRAGMA table_info('${name}')`);
      return new Set(cols.map(c => c.name));
    } catch (e) {
      console.warn('Could not read columns for', name, e?.message);
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

  // Server-side sessions. The id is the cookie value: 256 bits of crypto-random, so it is a
  // credential in its own right and nothing else about it needs to be secret.
  await db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    last_seen_at TEXT,
    revoked_at TEXT,
    user_agent TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // The client owns the source manifest and system registry; the server bounds the shape only.
  await db.run(`CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY,
    name TEXT,
    owner_user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    campaign_code TEXT,
    sort_index INTEGER DEFAULT 0,
    allowed_source_ids TEXT,
    system_id TEXT,
    default_member_permissions TEXT,
    default_invite_permissions TEXT,
    requests_character_edit INTEGER DEFAULT 0,
    default_auto_claim_seats TEXT,
    FOREIGN KEY(owner_user_id) REFERENCES users(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY,
    name TEXT,
    discord TEXT,
    timezone TEXT,
    notes TEXT
  )`);

  // `data` stays one document so a saved character reads back into the builder intact.
  await db.run(`CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    campaign_id INTEGER,
    player_id INTEGER,
    name TEXT,
    summary TEXT,
    visibility TEXT,
    share_token TEXT,
    data TEXT NOT NULL,
    schema_version INTEGER DEFAULT 1,
    version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);

  // `subject_type` names a user or a campaign seat; an edit grant covers the document alone.
  await db.run(`CREATE TABLE IF NOT EXISTS character_grants (
    id INTEGER PRIMARY KEY,
    character_id TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    access TEXT NOT NULL DEFAULT 'view',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(character_id, subject_type, subject_id),
    FOREIGN KEY(character_id) REFERENCES characters(id)
  )`);

  // Belongs to a campaign, not a user, so it carries `version`: the whole table edits it.
  await db.run(`CREATE TABLE IF NOT EXISTS powered_characters (
    id INTEGER PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
  )`);

  // The server reads inside this one, because the compiled merge is a privacy boundary.
  await db.run(`CREATE TABLE IF NOT EXISTS pre_game_forms (
    id INTEGER PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(campaign_id, user_id),
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // `sessions` is the cookie's table, so these are `game_sessions`; NULL `ended_at` is open.
  await db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    group_id INTEGER,
    name TEXT,
    started_by INTEGER NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(started_by) REFERENCES users(id)
  )`);

  // One roll, as it settled on somebody's screen. The dice are the client's — the server records
  // what happened and interprets none of it, the same posture as `characters.summary`.
  await db.run(`CREATE TABLE IF NOT EXISTS session_rolls (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    character_name TEXT,
    label TEXT NOT NULL,
    detail TEXT,
    notation TEXT NOT NULL,
    total INTEGER NOT NULL,
    results TEXT,
    note TEXT,
    rolled_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(session_id) REFERENCES game_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
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
    character_edit_consent INTEGER DEFAULT 0,
    auto_claim_override TEXT,
    auto_claim_preference TEXT,
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);

  // Two columns: the owner may not write a preference, nor the member an override.
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
    permissions TEXT,
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

  // `color` is a palette key the client resolves (`GROUP_COLORS` in `lib/groupColors.ts`), stored
  // opaquely for the same reason `system_id` is: the palette is the client's to define.
  await db.run(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY,
    name TEXT,
    notes TEXT,
    color TEXT,
    target_size INTEGER,
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

  // An ALTER only fails when another booting process already applied it.
  for (const [table, columns] of Object.entries(LEGACY_COLUMNS)) {
    const cols = await getColumns(table);
    for (const [name, type] of columns) {
      if (cols.has(name)) continue;
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      } catch (e) {
        console.warn('Column add skipped:', table, name, e?.message);
      }
    }
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
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)', ['user_id'], 'sessions');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)', ['expires_at'], 'sessions');
  // Only user_id and campaign_id are indexed: every other field a client filters on lives inside
  // the `data` JSON, which is read whole and never queried into.
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id)', ['user_id'], 'characters');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id)', ['campaign_id'], 'characters');
  // The share token is a credential and the only way in through a share link, so it has to resolve
  // to at most one row.
  await safeCreateIndex('CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_share_token ON characters(share_token)', ['share_token'], 'characters');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_character_grants_character ON character_grants(character_id)', ['character_id'], 'character_grants');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_character_grants_subject ON character_grants(subject_type, subject_id)', ['subject_id'], 'character_grants');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_pre_game_forms_campaign ON pre_game_forms(campaign_id)', ['campaign_id'], 'pre_game_forms');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_powered_characters_campaign ON powered_characters(campaign_id)', ['campaign_id'], 'powered_characters');
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_game_sessions_campaign ON game_sessions(campaign_id)', ['campaign_id'], 'game_sessions');
  // The feed is read newest-first per session and polled, so this index is the whole of it.
  await safeCreateIndex('CREATE INDEX IF NOT EXISTS idx_session_rolls_session ON session_rolls(session_id, id)', ['session_id'], 'session_rolls');
}

module.exports = { ensureSchema };
