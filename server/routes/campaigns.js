const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { getCachedQueryAsync, setCache } = require('../lib/cache');
const { campaignCharacterSummary } = require('../lib/characters');
const { publicPlayer } = require('../lib/players');
const { createSession, publicUser } = require('../lib/sessions');
const { genToken } = require('../lib/tokens');
const { normalisePermissions, parsePermissions } = require('../lib/permissions');
const { cleanupOrphanedUser, isCampaignOwner, memberHasPermission, optionalAuth, requireAuth, requireCampaignAccess } = require('../middleware/auth');

const router = express.Router();

// ---------- Campaign endpoints ----------

// Create a campaign (authenticated user becomes owner)
router.post('/api/campaigns', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const name = req.body?.name ? String(req.body.name).trim() : 'New Campaign';
    // A campaign is created for one game, and the creator's builder is already in one — the client
    // sends it rather than every table silently becoming a D&D table.
    const systemId = normaliseSystemId(req.body?.system_id);
    if (systemId.error) return res.status(400).json({ error: systemId.error });
    const info = await db.run(
      'INSERT INTO campaigns(name, owner_user_id, system_id) VALUES (?, ?, ?)',
      name, user.id, systemId.value,
    );
    const created = await db.get('SELECT * FROM campaigns WHERE id = ?', info.lastInsertRowid);
    // add campaign_members entry for owner
    await db.run('INSERT INTO campaign_members(campaign_id, user_id, role) VALUES (?, ?, ?)', created.id, user.id, 'owner');
    // generate and persist a short campaign code (unique)
    let shortToken = null;
    for (let attempts = 0; attempts < 5; attempts++) {
      const candidate = genToken(8);
      try {
        await db.run('UPDATE campaigns SET campaign_code = ? WHERE id = ?', candidate, created.id);
        // confirm uniqueness by selecting
        const row = await db.get('SELECT id FROM campaigns WHERE campaign_code = ?', candidate);
        if (row?.id === created.id) { shortToken = candidate; break; }
      } catch (e) {
        console.warn('campaign code collision, retrying', e?.message);
      }
    }
    // fallback: if still null, leave campaign_code null
    res.json({ ok: true, campaign: created, campaign_code: shortToken });
  } catch (e) {
    console.error('POST /api/campaigns error', e);
    res.status(500).json({ error: e.message });
  }
});

// Lookup campaign by code (used for login by code)
router.get('/api/campaigns/code/:code', async (req, res) => {
  try {
    const code = req.params.code;
    if (!code) return res.status(400).json({ error: 'code required' });
    const camp = await db.get('SELECT * FROM campaigns WHERE campaign_code = ?', code);
    if (!camp) return res.status(404).json({ error: 'campaign_not_found' });
    res.json({ ok: true, campaign: camp });
  } catch (e) {
    console.error('GET /api/campaigns/code/:code error', e);
    res.status(500).json({ error: e.message });
  }
});

// Allow authenticated user to add themselves as a player to a campaign
router.post('/api/campaigns/:campaignId/add-self', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const campaignId = Number.parseInt(req.params.campaignId, 10);
    if (!campaignId) return res.status(400).json({ error: 'invalid_campaign_id' });
    const camp = await db.get('SELECT * FROM campaigns WHERE id = ?', campaignId);
    if (!camp) return res.status(404).json({ error: 'campaign_not_found' });

    // create a player with user's username as default name and link it
    const info = await db.run('INSERT INTO players (name, discord, timezone, notes, campaign_id) VALUES (?, ?, ?, ?, ?)', user.username || ('user'+user.id), '', '', '', campaignId);
    const created = await db.get('SELECT * FROM players WHERE id = ?', info.lastInsertRowid);
    // link membership (user -> player), with the campaign's default grant for arrivals
    await db.run(
      'INSERT OR IGNORE INTO campaign_members (campaign_id, user_id, player_id, role, permissions) VALUES (?, ?, ?, ?, ?)',
      campaignId, user.id, created.id, 'player', camp.default_member_permissions ?? null,
    );
    res.json({ ok: true, player: publicPlayer(created) });
  } catch (e) {
    console.error('/api/campaigns/:campaignId/add-self', e);
    res.status(500).json({ error: e.message });
  }
});

// List campaigns for the authenticated user
router.get('/api/campaigns', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const rows = await db.all(`
      SELECT c.* FROM campaigns c
      JOIN campaign_members cm ON cm.campaign_id = c.id
      WHERE cm.user_id = ?
      ORDER BY c.created_at DESC
    `, user.id);
    res.json({ ok: true, campaigns: rows });
  } catch (e) {
    console.error('GET /api/campaigns error', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * A campaign's allowed content sources (MERGE_PLAN.md Phase 5). The ids belong to the client's
 * source manifest, so the server stores them without interpreting them — it only bounds the shape,
 * because this string is read back by every member's builder. An empty list means no restriction,
 * which is the same thing the builder's own source filter means when nothing is selected.
 */
function normaliseAllowedSourceIds(value) {
  if (value === null || value === undefined || value === '') return { value: null };
  if (!Array.isArray(value)) return { error: 'allowed_source_ids_must_be_an_array' };
  if (value.length > 64) return { error: 'too_many_sources' };
  const ids = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(entry)) {
      return { error: 'invalid_source_id' };
    }
    if (!ids.includes(entry)) ids.push(entry);
  }
  return { value: ids.length > 0 ? JSON.stringify(ids) : null };
}

/**
 * The game a table plays. Same posture as `allowed_source_ids`: the registry of systems is the
 * client's (`app/src/data/gameSystems.ts`), so this bounds the shape and interprets nothing —
 * adding a system must not need a server deploy. NULL means "whatever the client defaults to".
 */
function normaliseSystemId(value) {
  if (value === null || value === undefined || value === '') return { value: null };
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) {
    return { error: 'invalid_system_id' };
  }
  return { value };
}

const CAMPAIGN_UPDATABLE_COLUMNS = [
  ['name', (value) => {
    const name = typeof value === 'string' ? value.trim() : '';
    return name ? { value: name } : { error: 'name required' };
  }],
  ['allowed_source_ids', normaliseAllowedSourceIds],
  ['system_id', normaliseSystemId],
  ['default_member_permissions', normalisePermissions],
  ['default_invite_permissions', normalisePermissions],
];

// Update a campaign (owner only): rename it, or set the sources its table plays with. One table of
// columns rather than an `if (Object.hasOwn(...))` block each, per CLAUDE.md.
router.put('/api/campaigns/:campaignId', requireCampaignAccess('owner'), async (req, res) => {
  try {
    const body = req.body || {};
    const updates = [];
    for (const [column, normalise] of CAMPAIGN_UPDATABLE_COLUMNS) {
      if (!Object.hasOwn(body, column)) continue;
      const result = normalise(body[column]);
      if (result.error) return res.status(400).json({ error: result.error });
      updates.push([column, result.value]);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'nothing_to_update' });

    const assignments = updates.map(([column]) => `${column} = ?`).join(', ');
    await db.run(
      `UPDATE campaigns SET ${assignments} WHERE id = ?`,
      ...updates.map(([, value]) => value),
      req.campaign.id,
    );
    const updated = await db.get('SELECT * FROM campaigns WHERE id = ?', req.campaign.id);
    res.json({ ok: true, campaign: updated });
  } catch (e) {
    console.error('PUT /api/campaigns/:campaignId', e);
    res.status(500).json({ error: e.message });
  }
});

// Delete a campaign (owner only)
router.delete('/api/campaigns/:campaignId', requireCampaignAccess('owner'), async (req, res) => {
  try {
    // cascade delete: remove invites, campaign_members, and optionally players/availability
    const cid = req.campaign.id;
    // collect user_ids that will be unlinked so we can cleanup orphaned users
    const linkedUsers = (await db.all('SELECT DISTINCT user_id FROM campaign_members WHERE campaign_id = ?', cid)).map(r => r.user_id).filter(Boolean);
    await db.transaction(async (trx) => {
      await trx.run('DELETE FROM invites WHERE campaign_id = ?', cid);
      await trx.run('DELETE FROM campaign_members WHERE campaign_id = ?', cid);
      await trx.run('UPDATE availability SET campaign_id = NULL WHERE campaign_id = ?', cid);
      await trx.run('UPDATE players SET campaign_id = NULL WHERE campaign_id = ?', cid);
      // A character belongs to a user, not to a campaign (MERGE_PLAN.md §9): deleting the campaign
      // gives up the seat, it does not destroy someone's sheet.
      await trx.run('UPDATE characters SET campaign_id = NULL, player_id = NULL WHERE campaign_id = ?', cid);
      await trx.run('DELETE FROM campaigns WHERE id = ?', cid);
    });
    // cleanup any users that were only scoped to this campaign (no password and no remaining campaign_members)
    for (const uid of linkedUsers) await cleanupOrphanedUser(uid);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/campaigns/:campaignId', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * A character is attached to a campaign only while its owner is a member of it — attaching is how
 * a sheet becomes readable by the table (see `findReadableCharacter`), so losing the membership has
 * to take that back. The sheet itself belongs to its user and survives (MERGE_PLAN.md §9).
 */
async function detachUserCharacters(campaignId, userId) {
  if (!campaignId || !userId) return;
  await db.run(
    'UPDATE characters SET campaign_id = NULL, player_id = NULL WHERE campaign_id = ? AND user_id = ?',
    campaignId, userId,
  );
}

// Leave a campaign (remove user from campaign_members)
router.post('/api/campaigns/:campaignId/leave', requireCampaignAccess(), async (req, res) => {
  try {
    const user = req.user;
    const campaignId = req.campaign.id;

    // Don't allow campaign owner to leave (they should delete the campaign instead)
    if (await isCampaignOwner(user.id, campaignId)) {
      return res.status(400).json({ error: 'owners_cannot_leave' });
    }

    // Remove user from campaign_members
    await db.run('DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?', campaignId, user.id);
    await detachUserCharacters(campaignId, user.id);

    // Clean up any orphaned campaign-scoped users
    await cleanupOrphanedUser(user.id);
    
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/campaigns/:campaignId/leave', e);
    res.status(500).json({ error: e.message });
  }
});

// Reorder campaigns (body: { ids: [...] }) — owner must be a member of affected campaigns
router.post('/api/campaigns/reorder', requireAuth, async (req, res) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'invalid_ids' });
    const user = req.user;

    // verify user is member of each campaign id provided
    for (const id of ids) {
      const cm = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', id, user.id);
      if (!cm) return res.status(403).json({ error: 'not_a_member_of_all' });
    }

    await db.transaction(async (trx) => {
      for (let i=0;i<ids.length;i++) {
        const iid = Number.parseInt(ids[i], 10);
        if (!Number.isNaN(iid)) await trx.run('UPDATE campaigns SET sort_index = ? WHERE id = ?', i, iid);
      }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/campaigns/reorder', e);
    res.status(500).json({ error: e.message });
  }
});

// Regenerate a campaign's short code (owner only)
router.post('/api/campaigns/:campaignId/regenerate-code', requireCampaignAccess('owner'), async (req, res) => {
  try {
    // generate a short unique code (8 chars)
    let code = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = genToken(8);
      const exists = await db.get('SELECT id FROM campaigns WHERE campaign_code = ?', candidate);
      if (!exists) { code = candidate; break; }
    }
    if (!code) return res.status(500).json({ error: 'could_not_generate_code' });
    await db.run('UPDATE campaigns SET campaign_code = ? WHERE id = ?', code, req.campaign.id);
    const updated = await db.get('SELECT * FROM campaigns WHERE id = ?', req.campaign.id);
    res.json({ ok: true, campaign: updated });
  } catch (e) {
    console.error('POST /api/campaigns/:campaignId/regenerate-code', e);
    res.status(500).json({ error: e.message });
  }
});

// list members of a campaign (owner or member)
router.get('/api/campaigns/:campaignId/members', requireCampaignAccess(), async (req, res) => {
  try {
    const members = await db.all(`
      SELECT cm.*, u.discord_id as user_discord, u.username as user_name, p.id as player_id, p.name as player_name
      FROM campaign_members cm
      LEFT JOIN users u ON u.id = cm.user_id
      LEFT JOIN players p ON p.id = cm.player_id
      WHERE cm.campaign_id = ?
    `, req.campaign.id);
    res.json({ ok: true, members });
  } catch (e) {
    console.error('GET /api/campaigns/:campaignId/members', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * The party view (MERGE_PLAN.md Phase 5): every character seated at this campaign, whoever owns it.
 *
 * This is the one place a member reads other people's characters, and the permission story is the
 * one attaching already implies — a character carries a `campaign_id` because its owner put it
 * there. Summaries only, as everywhere else: a document can carry two data-URL images, and a
 * member opens the ones they actually want by id (`GET /api/characters/:id` allows the same read).
 */
router.get('/api/campaigns/:campaignId/characters', requireCampaignAccess(), async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT ch.*, u.username AS owner_name, p.name AS player_name
      FROM characters ch
      LEFT JOIN users u ON u.id = ch.user_id
      LEFT JOIN players p ON p.id = ch.player_id
      WHERE ch.campaign_id = ? AND ch.deleted_at IS NULL
      ORDER BY ch.updated_at DESC, ch.id ASC
    `, req.campaign.id);
    res.json({ ok: true, characters: rows.map((row) => campaignCharacterSummary(row)) });
  } catch (e) {
    console.error('GET /api/campaigns/:campaignId/characters', e);
    res.status(500).json({ error: e.message });
  }
});

// Add current user as a member of a campaign (join campaign)
router.post('/api/campaigns/:campaignId/members', requireAuth, async (req, res) => {
  try {
    const campaignId = req.params.campaignId;
    const user = req.user;

    // Check if campaign exists
    const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', campaignId);
    if (!campaign) return res.status(404).json({ error: 'campaign_not_found' });
    
    // Check if user is already a member
    const existingMember = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', campaignId, user.id);
    if (existingMember) return res.status(400).json({ error: 'already_member' });
    
    // Add user as a campaign member, holding whatever the campaign grants arrivals by default.
    await db.run(
      'INSERT INTO campaign_members (campaign_id, user_id, role, permissions) VALUES (?, ?, ?, ?)',
      campaignId, user.id, 'player', campaign.default_member_permissions ?? null,
    );

    res.json({ ok: true, campaign });
  } catch (e) {
    console.error('POST /api/campaigns/:campaignId/members', e);
    res.status(500).json({ error: e.message });
  }
});

// List unclaimed players for a campaign (players with no user mapping)
// This endpoint is intentionally permissive so invite landing pages and anonymous
// claim flows can show which players are available to claim without requiring
// the user to already be authenticated. It only returns players that have no
// discord_id (so it won't expose already-claimed accounts). Also exclude players
// that have been reserved/claimed (password_hash not null) or that have an
// active campaign_members.user_id mapping.
router.get('/api/campaigns/:campaignId/unclaimed-players', setCache, async (req, res) => {
  try {
    const campaignId = req.params.campaignId;
    
    // Use cached query for better performance
    const cacheKey = `unclaimed_players_${campaignId}`;
    const result = await getCachedQueryAsync(cacheKey, async () => {
      const camp = await db.get('SELECT id FROM campaigns WHERE id = ?', campaignId);
      if (!camp) return null;
      const sql = `SELECT p.id, p.name, p.discord, p.notes, p.sort_index FROM players p
        WHERE p.campaign_id = ?
          AND (p.discord_id IS NULL OR p.discord_id = '')
          AND (p.password_hash IS NULL)
          AND NOT EXISTS (SELECT 1 FROM campaign_members cm WHERE cm.campaign_id = ? AND cm.player_id = p.id AND cm.user_id IS NOT NULL)
        ORDER BY p.sort_index ASC, p.id ASC
        LIMIT 50`;
      const rows = await db.all(sql, campaignId, campaignId);
      return { ok: true, players: rows };
    });
    
    if (!result) {
      return res.status(404).json({ error: 'campaign_not_found' });
    }
    
    res.json(result);
  } catch (e) {
    console.error('GET /api/campaigns/:campaignId/unclaimed-players', e);
    res.status(500).json({ error: e.message });
  }
});

// Claim a player in a campaign: link current user or create a password-protected player
router.post('/api/campaigns/:campaignId/claim-player', optionalAuth, async (req, res) => {
  try {
    const campaignId = req.params.campaignId;
    const playerId = req.body?.player_id;
    const password = req.body?.password; // optional
    const name = req.body?.name;

    // Validate input early
    if (!campaignId) return res.status(400).json({ error: 'campaign_id_required' });
    if (!name && !req.user) return res.status(400).json({ error: 'name_required_for_anonymous' });

    // Use cached query for campaign validation
    const cacheKey = `campaign_${campaignId}`;
    const campaign = await getCachedQueryAsync(cacheKey, async () => {
      return await db.get('SELECT id, name, default_member_permissions FROM campaigns WHERE id = ?', campaignId);
    });

    if (!campaign) return res.status(404).json({ error: 'campaign_not_found' });
    // Claiming a seat creates a campaign-scoped account whose only reason to exist is that seat, so
    // editing and releasing it are a floor the campaign's defaults are layered on top of — without
    // them the new account can see the roster and change nothing on its own row.
    const claimPermissions = JSON.stringify({
      ...parsePermissions(campaign.default_member_permissions),
      can_unclaim: true,
      can_edit_self: true,
    });

    const user = req.user;
    if (user) {
      // Use database transaction for consistency and better performance
      const transaction = async () => await db.transaction(async (trx) => {
        if (playerId) {
          // Claiming existing player
          const p = await trx.get('SELECT * FROM players WHERE id = ? AND campaign_id = ?', playerId, campaignId);
          if (!p) throw new Error('player_not_found');
          
          // Check if already claimed by someone else
          const existingClaim = await trx.get('SELECT user_id FROM campaign_members WHERE player_id = ? AND campaign_id = ? AND user_id IS NOT NULL LIMIT 1', playerId, campaignId);
          if (existingClaim && existingClaim.user_id !== user.id) {
            throw new Error('already_claimed');
          }
          
          // Link user to campaign_members with player_id
          await trx.run('INSERT OR IGNORE INTO campaign_members(campaign_id,user_id,player_id,role,permissions) VALUES (?, ?, ?, ?, ?)', campaignId, user.id, playerId, 'player', claimPermissions);
          
          // Update Discord ID if available
          if (user.discord_id) {
            await trx.run('UPDATE players SET discord_id = ? WHERE id = ?', user.discord_id, playerId);
          }
          
          // Return optimized player object
          const updatedPlayer = await trx.get('SELECT * FROM players WHERE id = ?', playerId);
          return { 
            ...updatedPlayer, 
            claimed_user_id: user.id, 
            is_claimed: true 
          };
        } else {
          // Creating new player
          const playerName = (name || 'Unnamed').trim().substring(0, 50); // Limit length for security
          const info = await trx.run('INSERT INTO players(name, campaign_id, discord_id) VALUES (?, ?, ?)',
            playerName, 
            campaignId,
            user.discord_id || null);
          
          // Link user to new player
          await trx.run('INSERT INTO campaign_members(campaign_id,user_id,player_id,role,permissions) VALUES (?, ?, ?, ?, ?)',
            campaignId, user.id, info.lastInsertRowid, 'player', claimPermissions);
          
          // Return new player object
          const newPlayer = await trx.get('SELECT * FROM players WHERE id = ?', info.lastInsertRowid);
          return { 
            ...newPlayer, 
            claimed_user_id: user.id, 
            is_claimed: true 
          };
        }
      });
      
      try {
        const playerOut = await transaction();
        return res.json({ ok: true, player: publicPlayer(playerOut), user: publicUser(user) });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

  // anonymous claim: allow claiming existing player or creating a new player and claiming it
  if (!playerId) {
    // create new player and claim it
    const pname = name || ('player');
    const plain = password || '';
    const saltRounds = 10;
    const hash = bcrypt.hashSync(plain, saltRounds);
    const info = await db.run('INSERT INTO players(name, campaign_id, password_hash) VALUES (?, ?, ?)', pname, campaignId, (plain ? hash : null));
  const newPid = info.lastInsertRowid;
    // create user for claimant
    // If no password provided, create a campaign-scoped account by creating a users row but record a back-reference in campaign_members only
    const uInfo = await db.run('INSERT INTO users(username, password_hash) VALUES (?, ?)', pname, (plain ? hash : null));
    const newUser = await db.get('SELECT * FROM users WHERE id = ?', uInfo.lastInsertRowid);
    // Link the user to this campaign and player. If no password was provided, we'll treat this account as campaign-scoped
    await db.run('INSERT INTO campaign_members(campaign_id,user_id,player_id,role,permissions) VALUES (?, ?, ?, ?, ?)', campaignId, newUser.id, newPid, 'player', claimPermissions);
  const created = await db.get('SELECT * FROM players WHERE id = ?', newPid);
  const claimedRow = await db.get('SELECT user_id FROM campaign_members WHERE player_id = ? AND campaign_id = ? AND user_id IS NOT NULL LIMIT 1', newPid, campaignId);
  const playerOut = { ...created, claimed_user_id: claimedRow ? claimedRow.user_id : null, is_claimed: Boolean(claimedRow?.user_id) || Boolean(created.password_hash) || Boolean(created.discord_id) };
  // The campaign-scoped account just created is a real account, so it gets a real session too.
  await createSession(req, res, newUser);
  return res.json({ ok: true, player: publicPlayer(playerOut), user: publicUser(newUser) });
  }
  // claiming existing player
  const p = await db.get('SELECT * FROM players WHERE id = ? AND campaign_id = ?', playerId, campaignId);
  if (!p) return res.status(404).json({ error: 'player_not_found' });
  if (p.password_hash) return res.status(400).json({ error: 'already_claimed' });
  // hash the provided password (use bcrypt)
  const plain = password || '';
  const saltRounds = 10;
  const hash = bcrypt.hashSync(plain, saltRounds);
  // set player password_hash to reserve the player
  await db.run('UPDATE players SET password_hash = ? WHERE id = ?', hash, playerId);
  // create a user record representing the claimant; if password provided, store it on users too
  const uInfo = await db.run('INSERT INTO users(username, password_hash) VALUES (?, ?)', name || ('player' + playerId), (plain ? hash : null));
  const newUser = await db.get('SELECT * FROM users WHERE id = ?', uInfo.lastInsertRowid);
  // If no password was provided, this is a campaign-scoped account; it still gets the campaign's
  // default grant on top of the self-service floor.
  await db.run('INSERT INTO campaign_members(campaign_id,user_id,player_id,role,permissions) VALUES (?, ?, ?, ?, ?)', campaignId, newUser.id, playerId, 'player', claimPermissions);
  const createdP = await db.get('SELECT * FROM players WHERE id = ?', playerId);
  const claimedR = await db.get('SELECT user_id FROM campaign_members WHERE player_id = ? AND campaign_id = ? AND user_id IS NOT NULL LIMIT 1', playerId, campaignId);
  const playerOutFinal = { ...createdP, claimed_user_id: claimedR ? claimedR.user_id : null, is_claimed: Boolean(claimedR?.user_id) || Boolean(createdP.password_hash) || Boolean(createdP.discord_id) };
  await createSession(req, res, newUser);
  res.json({ ok: true, player: publicPlayer(playerOutFinal), user: publicUser(newUser) });
  } catch (e) {
    console.error('POST /api/campaigns/:campaignId/claim-player', e);
    res.status(500).json({ error: e.message });
  }
});

// Unclaim a player: owner or linked user may unclaim (removes password_hash and clears campaign_members link)
router.post('/api/campaigns/:campaignId/unclaim-player', requireAuth, async (req, res) => {
  try {
    const campaignId = req.params.campaignId;
    const playerId = req.body?.player_id;
    if (!playerId) return res.status(400).json({ error: 'player_id required' });

    const user = req.user;
    const existing = await db.get('SELECT * FROM players WHERE id = ? AND campaign_id = ?', playerId, campaignId);
    if (!existing) return res.status(404).json({ error: 'player_not_found' });

    // owner can unclaim, or the linked user with can_unclaim permission can unclaim their own player
    const isOwner = await isCampaignOwner(user.id, campaignId);
    const linked = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND player_id = ?', campaignId, user.id, playerId);
    // legacy can_unclaim or modern players_self_delete both grant it
    const hasPermission = isOwner || memberHasPermission(linked, 'can_unclaim', 'players_self_delete');
    if (!hasPermission) return res.status(403).json({ error: 'forbidden' });

    // remove password_hash and unlink any user mapping, mark as explicitly unclaimed
    const linkedUsers = (await db.all('SELECT DISTINCT user_id FROM campaign_members WHERE campaign_id = ? AND player_id = ?', campaignId, playerId)).map(r => r.user_id).filter(Boolean);
    await db.run('UPDATE players SET password_hash = NULL, discord_id = NULL, unclaimed_at = CURRENT_TIMESTAMP WHERE id = ?', playerId);
    await db.run('DELETE FROM campaign_members WHERE campaign_id = ? AND player_id = ?', campaignId, playerId);
    // Releasing a seat also drops the membership it was linked through, so the characters that were
    // shared with this campaign on the strength of it come back out.
    for (const uid of linkedUsers) await detachUserCharacters(campaignId, uid);

    // cleanup any orphaned campaign-scoped users
    for (const uid of linkedUsers) await cleanupOrphanedUser(uid);
    
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/campaigns/:campaignId/unclaim-player', e);
    res.status(500).json({ error: e.message });
  }
});

// PATCH campaign member to update permissions (owner only)
router.patch('/api/campaigns/:campaignId/members/:memberId/permissions', requireCampaignAccess('owner'), async (req, res) => {
  try {
    const memberId = Number.parseInt(req.params.memberId, 10);
    if (!memberId) return res.status(400).json({ error: 'invalid_member_id' });
    const body = req.body || {};
    const perms = body.permissions || null; // expects an object
    const pStr = perms ? JSON.stringify(perms) : null;
    await db.run('UPDATE campaign_members SET permissions = ? WHERE id = ?', pStr, memberId);
    const updated = await db.get('SELECT * FROM campaign_members WHERE id = ?', memberId);
    res.json({ ok: true, member: updated });
  } catch (e) {
    console.error('PATCH /api/campaigns/:campaignId/members/:memberId/permissions', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
