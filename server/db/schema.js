// server/init_schema.js
// Ensure the database schema exists and reconcile legacy tables by adding missing columns.

// Columns added to these tables after their first release. A deployment that predates one gets it
// back by ALTER; a fresh database already has it from the CREATE above and skips.
//
// This is a table rather than one `if (!cols.has(...))` block per column for the reason CLAUDE.md
// gives for the same shape in the route handlers: the branches were the whole of this function's
// cognitive complexity, and a list of columns is what the code actually is.
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

  // `allowed_source_ids` is a JSON array of content-source ids (MERGE_PLAN.md Phase 5). It is the
  // table's content agreement — what the builder offers when a character is started for this
  // campaign — and the server keeps it opaque: the source manifest is the client's, not the API's.
  // Empty or null means "no restriction", which is also what the builder's own filter means.
  //
  // `system_id` names the game this table plays, on the same terms: the registry that defines a
  // system lives in the client (`app/src/data/gameSystems.ts`), so the server bounds the shape of
  // the string and interprets nothing. NULL means a campaign that predates the column, which the
  // client reads as its default system.
  //
  // `default_member_permissions` and `default_invite_permissions` are JSON permission blobs applied
  // when someone joins — the first for any join, the second only to people arriving on an invite
  // that carries no permissions of its own. NULL means "grant nothing", which is what joining did
  // before the columns existed.
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
    FOREIGN KEY(owner_user_id) REFERENCES users(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY,
    name TEXT,
    discord TEXT,
    timezone TEXT,
    notes TEXT
  )`);

  // Builder characters (MERGE_PLAN.md Phase 2). Created after `players` because it references it:
  // a CREATE TABLE naming a table that does not exist yet is only an error once foreign keys are
  // enforced, which is exactly the kind of difference between two deployments worth not having.
  //
  // `visibility` is who may read the sheet: 'private', 'campaign' (the members of the campaign it
  // is attached to) or 'public' (anyone holding the link, signed in or not). NULL is a row written
  // before the column, which read as campaign-visible the moment it was attached — so NULL is
  // 'campaign', not 'private', or attaching would silently stop sharing. `share_token` is minted on
  // demand and rotating it is what revokes every link already handed out.
  //
  // The id is the uuid the builder already mints client-side, so a character keeps one identity
  // across localStorage and the server. `name` and `summary` ("Level 5 Elf Wizard 5") are
  // denormalised out of the document so a list needs no parsing — `summary` is written by the
  // client because resolving species and class ids to names needs the content library, which is
  // the client's. `data` is the whole `Character` object as JSON,
  // deliberately not mapped to columns: CLAUDE.md requires a saved character to read back into the
  // builder, and that needs every choice-mode and selection field intact. `version` is bumped on
  // each write so a stale client gets a 409 rather than clobbering a sheet edited elsewhere.
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

  // Who else may open or edit one character, granted by its owner and revocable by them alone.
  //
  // `subject_type` says what `subject_id` names: 'user' is one account, 'campaign_owner' is
  // whoever runs that campaign (a seat, not a person — the grant survives the campaign changing
  // hands). A campaign-wide consent is deliberately *not* stored here: it applies to every
  // character its holder seats at that table, including ones built later, so it lives on
  // `campaign_members.character_edit_consent` instead.
  //
  // `access` is 'view' or 'edit'. An edit grant is over the *document* only — the seat, the
  // visibility, the grants themselves and deletion stay the owner's.
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
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);

  // `permissions` is the blob granted to whoever joins on this link, overriding the campaign's own
  // default for arrivals. NULL means "use the campaign's default", not "grant nothing" — the two
  // have to stay distinguishable or an invite could never opt out of a default.
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

  // 2) Reconcile columns for legacy tables by adding missing columns.
  // An ALTER that fails has already been applied by another process racing this boot, which is the
  // only way it fails here — the column list is static and every entry is nullable.
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
}

module.exports = { ensureSchema };
