const express = require('express');
const db = require('../db');
const { buildRangesFromText, mergeInsertAvailability, normalizePreviewBlocks } = require('../lib/availability');
const { resolveNamesToPlayerIds } = require('../lib/groups');
const { publicPlayer } = require('../lib/players');
const { releaseSeat } = require('../lib/membership');
const { canUserModifyPlayer, cleanupOrphanedUser, getCampaignMembership, isCampaignOwner, memberHasPermission, requireAuth } = require('../middleware/auth');

const router = express.Router();

// list players for a campaign (requires membership)
router.get('/api/players', requireAuth, async (req, res) => {
  try {
    const campaignId = req.query.campaign_id || req.get('X-Campaign-Id');
    if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });
    const user = req.user;
    const mem = await getCampaignMembership(user.id, campaignId);
    if (!mem) return res.status(403).json({ error: 'not_a_member' });
    const rows = await db.all(`
      SELECT p.*, (
        SELECT user_id FROM campaign_members WHERE player_id = p.id AND campaign_id = ? AND user_id IS NOT NULL LIMIT 1
      ) as claimed_user_id
      FROM players p
      WHERE p.campaign_id = ?
      ORDER BY p.sort_index ASC, p.id ASC
    `, campaignId, campaignId);
    // annotate is_claimed for convenience
    const annotated = rows.map(r => ({
      ...r,
      is_claimed: r.unclaimed_at ? false : (Boolean(r.claimed_user_id) || Boolean(r.password_hash) || Boolean(r.discord_id))
    }));
    res.json(annotated.map(publicPlayer));
  } catch (e) {
    console.error('GET /api/players error', e);
    res.status(500).json({ error: e.message });
  }
});

// CREATE player
// CREATE player in a campaign (requires membership)
router.post('/api/players', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const campaignId = b.campaign_id || req.get('X-Campaign-Id');
    if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });
    const user = req.user;
    const mem = await getCampaignMembership(user.id, campaignId);
    if (!mem) return res.status(403).json({ error: 'not_a_member' });
    // enforce can_create_players for non-owners
    if (!await isCampaignOwner(user.id, campaignId) && !memberHasPermission(mem, 'can_create_players')) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const withIds = await resolveNamesToPlayerIds(b.pref_play_with || '');
    const notIds = await resolveNamesToPlayerIds(b.pref_play_not_with || '');
    const mx = await db.get('SELECT MAX(sort_index) as mx FROM players WHERE campaign_id = ?', campaignId);
    const nextIndex = mx?.mx != null ? mx.mx + 1 : 0;
    const info = await db.run(
      `INSERT INTO players(
        name, discord, timezone, notes, age, computer_access,
        pref_party_size, pref_session_length, pref_vtt,
        pref_play_with, pref_play_not_with,
        pref_play_with_ids, pref_play_not_with_ids,
        sort_index, campaign_id,
        ddb_url, ddb_json, ddb_avatar_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      b.name || '',
      b.discord || '',
      b.timezone || '',
      b.notes || '',
      b.age || '',
      b.computer_access || '',
      b.pref_party_size || '',
      b.pref_session_length || '',
      b.pref_vtt || '',
      b.pref_play_with || '',
      b.pref_play_not_with || '',
      JSON.stringify(withIds),
      JSON.stringify(notIds),
      nextIndex,
      campaignId,
      b.ddb_url || null,
      b.ddb_json || null,
      b.ddb_avatar_url || null
    );
  const created = await db.get('SELECT * FROM players WHERE id = ?', info.lastInsertRowid);
    if (b.rebuildOnSave || Array.isArray(b.availability_preview_blocks)) {
      const previewBlocks = normalizePreviewBlocks(b.availability_preview_blocks);
      const parsed = previewBlocks.length > 0
        ? previewBlocks
        : buildRangesFromText(b.notes || '', b.timezone || '', 14);
      for (const block of parsed) {
        await mergeInsertAvailability(created.id, block.start_iso, block.end_iso, 'sheet');
      }
    }
  // Don't auto-claim players when creating them - leave them unclaimed for others to claim
  // Only add campaign_members link if explicitly claiming (not just creating)
  
  // include claimed metadata (should be unclaimed since we didn't create a campaign_members link)
  const claimedRow = await db.get('SELECT user_id FROM campaign_members WHERE player_id = ? AND campaign_id = ? AND user_id IS NOT NULL LIMIT 1', created.id, campaignId);
  const playerOut = { ...created, claimed_user_id: claimedRow ? claimedRow.user_id : null, is_claimed: created.unclaimed_at ? false : (Boolean(claimedRow?.user_id) || Boolean(created.password_hash) || Boolean(created.discord_id)) };
  res.json({ ok: true, player: publicPlayer(playerOut) });
  } catch (e) {
    console.error('POST /api/players error', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/api/players/:id', requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error:'invalid_id' });
    const body = req.body || {};
    const existing = await db.get('SELECT * FROM players WHERE id = ?', id);
    if (!existing) return res.status(404).json({ error:'player_not_found' });

    // permission: only owner or the linked user can modify
    const user = req.user;
    const campaignId = existing.campaign_id;
    if (!(await canUserModifyPlayer(user, campaignId, id))) return res.status(403).json({ error: 'forbidden' });

    // update fields (fallback to existing)
    const name = body.name ?? existing.name;
    // If player was explicitly unclaimed, preserve their unclaimed status by keeping discord fields null
    const discord = existing.unclaimed_at ? null : (body.discord ?? existing.discord);
    const timezone = body.timezone ?? existing.timezone;
    const notes = body.notes ?? existing.notes;
    const age = body.age ?? existing.age;
    const computer_access = body.computer_access ?? existing.computer_access;
    const pref_party_size = body.pref_party_size ?? existing.pref_party_size;
    const pref_session_length = body.pref_session_length ?? existing.pref_session_length;
    const pref_vtt = body.pref_vtt ?? existing.pref_vtt;
  const pref_play_with = body.pref_play_with ?? existing.pref_play_with;
  const pref_play_not_with = body.pref_play_not_with ?? existing.pref_play_not_with;
  const ddb_url = (body.ddb_url !== undefined) ? body.ddb_url : (existing.ddb_url || null);
  const ddb_json = (body.ddb_json !== undefined) ? body.ddb_json : (existing.ddb_json || null);
  const ddb_avatar_url = (body.ddb_avatar_url !== undefined) ? body.ddb_avatar_url : (existing.ddb_avatar_url || null);

    // compute canonical id arrays from the text fields (best-effort)
    let pref_play_with_ids = existing.pref_play_with_ids || '[]';
    let pref_play_not_with_ids = existing.pref_play_not_with_ids || '[]';
    try {
      const withIds = await resolveNamesToPlayerIds(pref_play_with || '');
      const notIds = await resolveNamesToPlayerIds(pref_play_not_with || '');
      pref_play_with_ids = JSON.stringify(withIds);
      pref_play_not_with_ids = JSON.stringify(notIds);
    } catch (e) {
      // don't fail save on resolution problems
      console.warn('Could not parse pref_play fields for player', id, e?.message);
    }

    await db.run(`UPDATE players SET
      name = ?, discord = ?, timezone = ?, notes = ?, age = ?, computer_access = ?, pref_party_size = ?, pref_session_length = ?, pref_vtt = ?,
      pref_play_with = ?, pref_play_not_with = ?, pref_play_with_ids = ?, pref_play_not_with_ids = ?,
      ddb_url = ?, ddb_json = ?, ddb_avatar_url = ?
      WHERE id = ?`,
      name, discord, timezone, notes, age, computer_access, pref_party_size, pref_session_length, pref_vtt,
      pref_play_with, pref_play_not_with, pref_play_with_ids, pref_play_not_with_ids,
      ddb_url, ddb_json, ddb_avatar_url,
      id);

    // rebuild sheet-sourced availability if requested
    if (body.rebuildOnSave || Array.isArray(body.availability_preview_blocks)) {
      await db.run("DELETE FROM availability WHERE player_id = ? AND source = 'sheet'", id);
      const previewBlocks = normalizePreviewBlocks(body.availability_preview_blocks);
      const parsed = previewBlocks.length > 0
        ? previewBlocks
        : buildRangesFromText(notes, timezone, 14);
      for (const b of parsed) await mergeInsertAvailability(id, b.start_iso, b.end_iso, 'sheet');
    }

    const updated = await db.get('SELECT * FROM players WHERE id = ?', id);
    res.json({ ok: true, player: publicPlayer(updated) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE player (and its availability)
router.delete('/api/players/:id', requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const existing = await db.get('SELECT * FROM players WHERE id = ?', id);
    if (!existing) return res.status(404).json({ error: 'player_not_found' });
    const user = req.user;
    // Owner, a member with can_delete_players, or the seat's own holder with the self-service
    // right. Holding the seat used to be enough by itself, which made the flag unrevokable.
    const isOwner = await isCampaignOwner(user.id, existing.campaign_id);
    if (!isOwner) {
      const cm = await getCampaignMembership(user.id, existing.campaign_id);
      const ownSeat = cm?.player_id != null && Number(cm.player_id) === id;
      const allowed = memberHasPermission(cm, 'can_delete_players')
        || (ownSeat && memberHasPermission(cm, 'players_self_delete', 'can_unclaim'));
      if (!allowed) return res.status(403).json({ error: 'forbidden' });
    }
        // delete dependent rows first to avoid FK constraint failures
        let linkedUsers = [];
        await db.transaction(async (trx) => {
          await trx.run('DELETE FROM group_members WHERE player_id = ?', id);
          linkedUsers = await releaseSeat(trx, existing.campaign_id, id);
          await trx.run('DELETE FROM availability WHERE player_id = ?', id);
          // Deleting a seat unseats any character sitting in it; the character itself belongs to
          // its user and survives (MERGE_PLAN.md §9).
          await trx.run('UPDATE characters SET player_id = NULL WHERE player_id = ?', id);
          await trx.run('DELETE FROM players WHERE id = ?', id);
        });
        // cleanup any now-orphaned users (no password_hash and no remaining campaign_members)
        for (const uid of linkedUsers) await cleanupOrphanedUser(uid);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/players/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// reorder players (body: { ids: [id1, id2, ...] }) -> sets sort_index according to array order
// This route took no auth at all before Phase 1b: anyone who could guess a player id could
// shuffle another campaign's roster. Membership in every affected campaign is now required.
router.post('/api/players/reorder', requireAuth, async (req, res) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'invalid_ids' });
    const numericIds = ids.map((v) => Number.parseInt(v, 10)).filter((v) => !Number.isNaN(v));

    const campaignIds = new Set();
    for (const id of numericIds) {
      const p = await db.get('SELECT campaign_id FROM players WHERE id = ?', id);
      if (p?.campaign_id != null) campaignIds.add(p.campaign_id);
    }
    for (const cid of campaignIds) {
      const mem = await getCampaignMembership(req.user.id, cid);
      if (!mem) return res.status(403).json({ error: 'not_a_member_of_all' });
    }

    await db.transaction(async (trx) => {
      for (let i = 0; i < numericIds.length; i++) {
        await trx.run('UPDATE players SET sort_index = ? WHERE id = ?', i, numericIds[i]);
      }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/players/reorder', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
