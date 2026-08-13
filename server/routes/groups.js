const express = require('express');
const db = require('../db');
const { loadGroupsWithMembers } = require('../lib/groups');
const { getRequestUser } = require('../middleware/auth');

const router = express.Router();

// GET /api/groups
router.get('/api/groups', async (req, res) => {
  try {
    const campaignId = req.query.campaign_id || req.get('X-Campaign-Id') || null;
    const out = await loadGroupsWithMembers(campaignId);
    res.json(out);
  } catch (e) {
    console.error('GET /api/groups', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/groups  -> create one group: { name, member_ids?: [] }
router.post('/api/groups', async (req, res) => {
  try {
    const { name, member_ids } = req.body || {};

    // determine next sort_index (append)
    // If campaign_id provided, require owner access for creation
    const campaignId = req.body.campaign_id || null;
    if (campaignId) {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ error: 'not_authenticated' });
      const ownerCheck = await db.get("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", campaignId, user.id);
      if (!ownerCheck) return res.status(403).json({ error: 'owner_required' });
    }
    const mx = await db.get('SELECT MAX(sort_index) as mx FROM groups');
    const nextIndex = (mx && mx.mx != null) ? mx.mx + 1 : 0;

    const info = await db.run('INSERT INTO groups(name, sort_index, campaign_id) VALUES (?, ?, ?)', name || null, nextIndex, req.body.campaign_id || null);
    const groupId = info.lastInsertRowid;
    if (Array.isArray(member_ids) && member_ids.length) {
      await db.transaction(async (trx) => {
        for (const id of member_ids) {
          await trx.run('INSERT INTO group_members(group_id, player_id) VALUES (?, ?)', groupId, id);
        }
      });
    }
    const createdGroups = await loadGroupsWithMembers(req.body.campaign_id || null);
    const created = createdGroups.find(g => g.id === groupId);
    res.json({ ok: true, group: created });
  } catch (e) {
    console.error('POST /api/groups', e);
    res.status(500).json({ error: e.message });
  }
});


// POST /api/groups/reorder  -> body: { ids: [id1, id2, ...] }
router.post('/api/groups/reorder', async (req, res) => {
  try {
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'invalid_ids' });
    await db.transaction(async (trx) => {
      for (let i=0;i<ids.length;i++) {
        const iid = parseInt(ids[i], 10);
        if (!Number.isNaN(iid)) await trx.run('UPDATE groups SET sort_index = ? WHERE id = ?', i, iid);
      }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/groups/reorder', e);
    res.status(500).json({ error: e.message });
  }
});


router.delete('/api/groups/:id', async (req, res) => {
  try {
    const gid = parseInt(req.params.id, 10);
    if (!gid) return res.status(400).json({ error: 'invalid_group_id' });
    const g = await db.get('SELECT * FROM groups WHERE id = ?', gid);
    if (!g) return res.status(404).json({ error: 'group_not_found' });
    const campaignId = g.campaign_id;
    if (campaignId) {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ error: 'not_authenticated' });
      const ownerCheck = await db.get("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", campaignId, user.id);
      if (!ownerCheck) {
        const cm = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', campaignId, user.id);
        if (!cm) return res.status(403).json({ error: 'not_a_member' });
        try { const perms = cm.permissions ? JSON.parse(cm.permissions) : {}; if (!perms || !perms.can_manage_groups) return res.status(403).json({ error: 'forbidden' }); } catch (e) { return res.status(403).json({ error: 'forbidden' }); }
      }
    }
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
router.put('/api/groups/:id', async (req, res) => {
  try {
    const gid = parseInt(req.params.id, 10);
    if (!gid) return res.status(400).json({ error: 'invalid_group_id' });
    const body = req.body || {};
    if (body.name !== undefined) {
      // permission check: owner or can_manage_groups in campaign
      const g = await db.get('SELECT * FROM groups WHERE id = ?', gid);
      if (g && g.campaign_id) {
        const user = await getRequestUser(req);
        if (!user) return res.status(401).json({ error: 'not_authenticated' });
        const ownerCheck = await db.get("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", g.campaign_id, user.id);
        if (!ownerCheck) {
          const cm = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', g.campaign_id, user.id);
          if (!cm) return res.status(403).json({ error: 'not_a_member' });
          try { const perms = cm.permissions ? JSON.parse(cm.permissions) : {}; if (!perms || !perms.can_manage_groups) return res.status(403).json({ error: 'forbidden' }); } catch(e) { return res.status(403).json({ error: 'forbidden' }); }
        }
      }
      await db.run('UPDATE groups SET name = ? WHERE id = ?', body.name, gid);
    }
    if (Array.isArray(body.member_ids)) {
      // permission check same as above
      const g = await db.get('SELECT * FROM groups WHERE id = ?', gid);
      if (g && g.campaign_id) {
        const user = await getRequestUser(req);
        if (!user) return res.status(401).json({ error: 'not_authenticated' });
        const ownerCheck = await db.get("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", g.campaign_id, user.id);
        if (!ownerCheck) {
          const cm = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', g.campaign_id, user.id);
          if (!cm) return res.status(403).json({ error: 'not_a_member' });
          try { const perms = cm.permissions ? JSON.parse(cm.permissions) : {}; if (!perms || !perms.can_manage_groups) return res.status(403).json({ error: 'forbidden' }); } catch(e) { return res.status(403).json({ error: 'forbidden' }); }
        }
      }
      await db.transaction(async (trx) => {
        await trx.run('DELETE FROM group_members WHERE group_id = ?', gid);
        for (const pid of body.member_ids) {
          await trx.run('INSERT OR IGNORE INTO group_members(group_id, player_id) VALUES (?, ?)', gid, pid);
        }
      });
    }
    const loadedList = await loadGroupsWithMembers();
    const loaded = loadedList.find(g => g.id === gid);
    res.json({ ok: true, group: loaded });
  } catch (e) {
    console.error('PUT /api/groups/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/groups/:id/members  -> add a single member { player_id }
router.post('/api/groups/:id/members', async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const player_id = parseInt(req.body.player_id, 10);
    if (!groupId || !player_id) return res.status(400).json({ error: 'invalid_ids' });
    const gm = await db.get('SELECT * FROM groups WHERE id = ?', groupId);
    if (!gm) return res.status(404).json({ error: 'group_not_found' });
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'not_authenticated' });
    const ownerCheck = await db.get("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", gm.campaign_id, user.id);
    if (!ownerCheck) {
      const cm = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', gm.campaign_id, user.id);
      if (!cm) return res.status(403).json({ error: 'not_a_member' });
      try { const perms = cm.permissions ? JSON.parse(cm.permissions) : {}; if (!perms || !perms.can_manage_groups) return res.status(403).json({ error: 'forbidden' }); } catch(e){ return res.status(403).json({ error: 'forbidden' }); }
    }
    await db.run('INSERT INTO group_members(group_id, player_id) VALUES (?, ?)', groupId, player_id);
    const list = await loadGroupsWithMembers();
    const g = list.find(x => x.id === groupId);
    res.json({ ok: true, group: g });
  } catch (e) {
    console.error('POST /api/groups/:id/members', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/groups/:id/members/:player_id', async (req, res) => {
  try {
    const g = parseInt(req.params.id, 10);
    const p = parseInt(req.params.player_id, 10);
    const gm = await db.get('SELECT * FROM groups WHERE id = ?', g);
    if (!gm) return res.status(404).json({ error: 'group_not_found' });
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'not_authenticated' });
    const ownerCheck = await db.get("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", gm.campaign_id, user.id);
    if (!ownerCheck) {
      const cm = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', gm.campaign_id, user.id);
      if (!cm) return res.status(403).json({ error: 'not_a_member' });
      try { const perms = cm.permissions ? JSON.parse(cm.permissions) : {}; if (!perms || !perms.can_manage_groups) return res.status(403).json({ error: 'forbidden' }); } catch(e){ return res.status(403).json({ error: 'forbidden' }); }
    }
    await db.run('DELETE FROM group_members WHERE group_id = ? AND player_id = ?', g, p);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/groups/:id/members/:player_id', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/groups/suggest - basic suggestion engine
// body: { numGroups, targetSize, window: { start, end }, weights }
router.post('/api/groups/suggest', async (req, res) => {
  try {
    const body = req.body || {};
    const numGroups = Math.max(1, parseInt(body.numGroups, 10) || 3);
    const targetSize = Math.max(1, parseInt(body.targetSize, 10) || 4);
    const window = body.window || {};
    const start = window.start;
    const end = window.end;

    // load players and simple availability count in window
    let allPlayers;
    if (body.campaign_id) {
      allPlayers = await db.all('SELECT * FROM players WHERE campaign_id = ?', body.campaign_id);
    } else {
      allPlayers = await db.all('SELECT * FROM players');
    }

    // for each player count total overlapping availability milliseconds within window
    const availCounts = {};
    if (start && end) {
      const availRows = await db.all(`
        SELECT player_id, start_iso, end_iso FROM availability
        WHERE NOT (end_iso <= ? OR start_iso >= ?)
      `, start, end);

      // initialize counts
      for (const p of allPlayers) availCounts[p.id] = 0;

      // accumulate overlap in milliseconds
      for (const r of availRows) {
        const s = Math.max(new Date(r.start_iso).getTime(), new Date(start).getTime());
        const e = Math.min(new Date(r.end_iso).getTime(), new Date(end).getTime());
        const delta = Math.max(0, e - s);
        availCounts[r.player_id] = (availCounts[r.player_id] || 0) + delta;
      }
    } else {
      // fallback: 0 for everyone
      for (const p of allPlayers) availCounts[p.id] = 0;
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
// payload: { groups: [ { name, member_ids: [1,2,3] }, ... ] }
router.post('/api/groups/save-suggestion', async (req, res) => {
  try {
    const payload = req.body || {};
    const groups = Array.isArray(payload.groups) ? payload.groups : [];
    const created = [];
    const tx = async (list) => await db.transaction(async (trx) => {
      const mx = await trx.get('SELECT MAX(sort_index) as mx FROM groups');
      let nextIndex = (mx && mx.mx != null) ? mx.mx + 1 : 0;
      for (const g of list) {
        const info = await trx.run('INSERT INTO groups(name, sort_index, campaign_id) VALUES (?, ?, ?)', g.name || null, nextIndex++, g.campaign_id || null);
        const gid = info.lastInsertRowid;
        created.push({ id: gid, name: g.name || null, member_ids: g.member_ids || [] });
        if (Array.isArray(g.member_ids)) {
          for (const pid of g.member_ids) await trx.run('INSERT INTO group_members(group_id, player_id) VALUES (?, ?)', gid, pid);
        }
      }
    });
    // If payload includes campaign_id, ensure each group in the transaction has campaign_id set
    const toRun = groups.map(g => ({ ...g, campaign_id: (payload && payload.campaign_id) ? payload.campaign_id : null }));
    await tx(toRun);
    const saved = await loadGroupsWithMembers(payload.campaign_id || null);
    res.json({ ok: true, created: created.map(c => c.id), groups: saved });
  } catch (e) {
    console.error('POST /api/groups/save-suggestion', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
