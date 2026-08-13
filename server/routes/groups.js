const express = require('express');
const db = require('../db');
const { loadGroupsWithMembers } = require('../lib/groups');
const { getCampaignMembership, isCampaignOwner, memberHasPermission, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Every write here repeated the same six lines of owner-or-can_manage_groups checking, and the
// read, reorder, suggest and save-suggestion routes had no check at all — a caller who knew a
// group id could rename or empty another campaign's table. One helper, applied everywhere.

/** null when allowed, else the {status, error} to respond with. */
async function checkGroupManageAccess(user, campaignId) {
  if (!campaignId) return { status: 400, error: 'campaign_id required' };
  if (await isCampaignOwner(user.id, campaignId)) return null;
  const cm = await getCampaignMembership(user.id, campaignId);
  if (!cm) return { status: 403, error: 'not_a_member' };
  if (!memberHasPermission(cm, 'can_manage_groups')) return { status: 403, error: 'forbidden' };
  return null;
}

/** Resolve a group and the caller's right to manage it in one step. */
async function loadManageableGroup(req, res, groupId) {
  const group = await db.get('SELECT * FROM groups WHERE id = ?', groupId);
  if (!group) {
    res.status(404).json({ error: 'group_not_found' });
    return null;
  }
  const denied = await checkGroupManageAccess(req.user, group.campaign_id);
  if (denied) {
    res.status(denied.status).json({ error: denied.error });
    return null;
  }
  return group;
}

// GET /api/groups
router.get('/api/groups', requireAuth, async (req, res) => {
  try {
    const campaignId = req.query.campaign_id || req.get('X-Campaign-Id') || null;
    if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });
    const mem = await getCampaignMembership(req.user.id, campaignId);
    if (!mem) return res.status(403).json({ error: 'not_a_member' });
    const out = await loadGroupsWithMembers(campaignId);
    res.json(out);
  } catch (e) {
    console.error('GET /api/groups', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/groups  -> create one group: { name, campaign_id, member_ids?: [] }
router.post('/api/groups', requireAuth, async (req, res) => {
  try {
    const { name, member_ids } = req.body || {};
    const campaignId = req.body?.campaign_id || null;
    if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });
    if (!await isCampaignOwner(req.user.id, campaignId)) return res.status(403).json({ error: 'owner_required' });

    // determine next sort_index (append)
    const mx = await db.get('SELECT MAX(sort_index) as mx FROM groups');
    const nextIndex = mx?.mx != null ? mx.mx + 1 : 0;

    const info = await db.run('INSERT INTO groups(name, sort_index, campaign_id) VALUES (?, ?, ?)', name || null, nextIndex, campaignId);
    const groupId = info.lastInsertRowid;
    if (Array.isArray(member_ids) && member_ids.length) {
      await db.transaction(async (trx) => {
        for (const id of member_ids) {
          await trx.run('INSERT INTO group_members(group_id, player_id) VALUES (?, ?)', groupId, id);
        }
      });
    }
    const createdGroups = await loadGroupsWithMembers(campaignId);
    const created = createdGroups.find(g => g.id === groupId);
    res.json({ ok: true, group: created });
  } catch (e) {
    console.error('POST /api/groups', e);
    res.status(500).json({ error: e.message });
  }
});


// POST /api/groups/reorder  -> body: { ids: [id1, id2, ...] }
router.post('/api/groups/reorder', requireAuth, async (req, res) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'invalid_ids' });
    const numericIds = ids.map((v) => Number.parseInt(v, 10)).filter((v) => !Number.isNaN(v));

    const campaignIds = new Set();
    for (const id of numericIds) {
      const g = await db.get('SELECT campaign_id FROM groups WHERE id = ?', id);
      if (g?.campaign_id != null) campaignIds.add(g.campaign_id);
    }
    for (const cid of campaignIds) {
      const denied = await checkGroupManageAccess(req.user, cid);
      if (denied) return res.status(denied.status).json({ error: denied.error });
    }

    await db.transaction(async (trx) => {
      for (let i = 0; i < numericIds.length; i++) {
        await trx.run('UPDATE groups SET sort_index = ? WHERE id = ?', i, numericIds[i]);
      }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/groups/reorder', e);
    res.status(500).json({ error: e.message });
  }
});


router.delete('/api/groups/:id', requireAuth, async (req, res) => {
  try {
    const gid = Number.parseInt(req.params.id, 10);
    if (!gid) return res.status(400).json({ error: 'invalid_group_id' });
    const group = await loadManageableGroup(req, res, gid);
    if (!group) return undefined;

    await db.transaction(async (trx) => {
      await trx.run('DELETE FROM group_members WHERE group_id = ?', gid);
      await trx.run('DELETE FROM groups WHERE id = ?', gid);
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/groups/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/groups/:id  -> update group name and optionally replace member list
// body: { name?: string, member_ids?: [1,2,3] }
router.put('/api/groups/:id', requireAuth, async (req, res) => {
  try {
    const gid = Number.parseInt(req.params.id, 10);
    if (!gid) return res.status(400).json({ error: 'invalid_group_id' });
    const body = req.body || {};
    const group = await loadManageableGroup(req, res, gid);
    if (!group) return undefined;

    if (body.name !== undefined) {
      await db.run('UPDATE groups SET name = ? WHERE id = ?', body.name, gid);
    }
    if (Array.isArray(body.member_ids)) {
      await db.transaction(async (trx) => {
        await trx.run('DELETE FROM group_members WHERE group_id = ?', gid);
        for (const pid of body.member_ids) {
          await trx.run('INSERT OR IGNORE INTO group_members(group_id, player_id) VALUES (?, ?)', gid, pid);
        }
      });
    }
    const loadedList = await loadGroupsWithMembers(group.campaign_id || null);
    const loaded = loadedList.find(g => g.id === gid);
    res.json({ ok: true, group: loaded });
  } catch (e) {
    console.error('PUT /api/groups/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/groups/:id/members  -> add a single member { player_id }
router.post('/api/groups/:id/members', requireAuth, async (req, res) => {
  try {
    const groupId = Number.parseInt(req.params.id, 10);
    const player_id = Number.parseInt(req.body.player_id, 10);
    if (!groupId || !player_id) return res.status(400).json({ error: 'invalid_ids' });
    const group = await loadManageableGroup(req, res, groupId);
    if (!group) return undefined;

    await db.run('INSERT INTO group_members(group_id, player_id) VALUES (?, ?)', groupId, player_id);
    const list = await loadGroupsWithMembers(group.campaign_id || null);
    const g = list.find(x => x.id === groupId);
    res.json({ ok: true, group: g });
  } catch (e) {
    console.error('POST /api/groups/:id/members', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/groups/:id/members/:player_id', requireAuth, async (req, res) => {
  try {
    const g = Number.parseInt(req.params.id, 10);
    const p = Number.parseInt(req.params.player_id, 10);
    const group = await loadManageableGroup(req, res, g);
    if (!group) return undefined;

    await db.run('DELETE FROM group_members WHERE group_id = ? AND player_id = ?', g, p);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/groups/:id/members/:player_id', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/groups/suggest - basic suggestion engine
// body: { campaign_id, numGroups, targetSize, window: { start, end }, weights }
router.post('/api/groups/suggest', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    // Without a campaign this loaded every player in the database and grouped them together.
    const campaignId = body.campaign_id || null;
    if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });
    const mem = await getCampaignMembership(req.user.id, campaignId);
    if (!mem) return res.status(403).json({ error: 'not_a_member' });

    const numGroups = Math.max(1, Number.parseInt(body.numGroups, 10) || 3);
    const window = body.window || {};
    const start = window.start;
    const end = window.end;

    const allPlayers = await db.all('SELECT * FROM players WHERE campaign_id = ?', campaignId);

    // for each player count total overlapping availability milliseconds within window
    const availCounts = {};
    for (const p of allPlayers) availCounts[p.id] = 0;
    if (start && end) {
      const availRows = await db.all(`
        SELECT player_id, start_iso, end_iso FROM availability
        WHERE NOT (end_iso <= ? OR start_iso >= ?)
      `, start, end);

      // accumulate overlap in milliseconds
      for (const r of availRows) {
        const s = Math.max(new Date(r.start_iso).getTime(), new Date(start).getTime());
        const e = Math.min(new Date(r.end_iso).getTime(), new Date(end).getTime());
        const delta = Math.max(0, e - s);
        availCounts[r.player_id] = (availCounts[r.player_id] || 0) + delta;
      }
    }

    // greedy grouping by sorting players by availability desc and round-robin assign
    const sorted = allPlayers.slice().sort((a,b) => (availCounts[b.id]||0) - (availCounts[a.id]||0));
    const groups = Array.from({length: numGroups}, () => ({ members: [], score: 0 }));
    let gi = 0;
    for (const p of sorted) {
      groups[gi].members.push({ id: p.id, name: p.name, discord: p.discord, zero_availability: (availCounts[p.id]||0) === 0 });
      gi = (gi + 1) % numGroups;
    }

    // compute a score per group: sum of member availability (ms) converted to hours (rounded)
    const resultGroups = groups.map((g) => {
      const sumMs = (g.members || []).reduce((acc, m) => acc + (availCounts[m.id] || 0), 0);
      const sumHours = Math.round((sumMs / 3600000) * 10) / 10; // e.g. 2.5 hours
      return { members: g.members, score: sumHours };
    });

    // leftover (none in this simple greedy algorithm) and meta
    const leftover = [];
    const metaRes = { algo: 'greedy-by-availability', counts: availCounts };

    res.json({ ok: true, groups: resultGroups, leftover, meta: metaRes });
  } catch (e) {
    console.error('POST /api/groups/suggest', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/groups/save-suggestion
// payload: { campaign_id, groups: [ { name, member_ids: [1,2,3] }, ... ] }
router.post('/api/groups/save-suggestion', requireAuth, async (req, res) => {
  try {
    const payload = req.body || {};
    const campaignId = payload.campaign_id || null;
    const denied = await checkGroupManageAccess(req.user, campaignId);
    if (denied) return res.status(denied.status).json({ error: denied.error });

    const groups = Array.isArray(payload.groups) ? payload.groups : [];
    const created = [];
    await db.transaction(async (trx) => {
      const mx = await trx.get('SELECT MAX(sort_index) as mx FROM groups');
      let nextIndex = mx?.mx != null ? mx.mx + 1 : 0;
      for (const g of groups) {
        const info = await trx.run('INSERT INTO groups(name, sort_index, campaign_id) VALUES (?, ?, ?)', g.name || null, nextIndex++, campaignId);
        const gid = info.lastInsertRowid;
        created.push({ id: gid, name: g.name || null, member_ids: g.member_ids || [] });
        if (Array.isArray(g.member_ids)) {
          for (const pid of g.member_ids) await trx.run('INSERT INTO group_members(group_id, player_id) VALUES (?, ?)', gid, pid);
        }
      }
    });
    const saved = await loadGroupsWithMembers(campaignId);
    res.json({ ok: true, created: created.map(c => c.id), groups: saved });
  } catch (e) {
    console.error('POST /api/groups/save-suggestion', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
