const express = require('express');
const db = require('../db');
const { buildRangesFromText, extractTzFromText, mergeInsertAvailability, tzFromAbbrev } = require('../lib/availability');
const { canUserModifyPlayer, getCampaignMembership, requireAuth } = require('../middleware/auth');

const router = express.Router();

// insert availability (server will merge with existing)
router.post('/api/availability', requireAuth, async (req, res) => {
  try {
    const { player_id, start_iso, end_iso, source } = req.body;
    if (!player_id || !start_iso || !end_iso) return res.status(400).json({ error: 'missing_fields' });
    const player = await db.get('SELECT * FROM players WHERE id = ?', player_id);
    if (!player) return res.status(404).json({ error: 'player_not_found' });
    if (!(await canUserModifyPlayer(req.user, player.campaign_id, player_id))) return res.status(403).json({ error: 'forbidden' });
    const merged = await mergeInsertAvailability(player_id, start_iso, end_iso, source || 'manual');
    // ensure campaign_id saved on availability
    await db.run('UPDATE availability SET campaign_id = ? WHERE id = ?', player.campaign_id, merged.id);
    res.json({ ok: true, id: merged.id, start_iso: merged.start_iso, end_iso: merged.end_iso });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET availability for a player (supports client calling GET /api/availability?player_id=1)
router.get('/api/availability', requireAuth, async (req, res) => {
  try {
    const player_id = Number.parseInt(req.query.player_id, 10);
    const campaignId = req.query.campaign_id || req.get('X-Campaign-Id');
    if (!player_id) return res.status(400).json({ error: 'missing_player_id' });
    if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });
    const mem = await getCampaignMembership(req.user.id, campaignId);
    if (!mem) return res.status(403).json({ error: 'not_a_member' });

    // ensure the player belongs to the campaign
    const player = await db.get('SELECT * FROM players WHERE id = ?', player_id);
    if (!player || String(player.campaign_id) !== String(campaignId)) return res.status(404).json({ error: 'player_not_in_campaign' });

    const rows = await db.all('SELECT * FROM availability WHERE player_id = ? AND campaign_id = ? ORDER BY start_iso', player_id, campaignId);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/availability/preview', requireAuth, async (req, res) => {
  try {
    const text = String(req.body?.text || '');
    const timezone = String(req.body?.timezone || '');
    const daysAheadRaw = parseInt(req.body?.daysAhead, 10);
    const daysAhead = Number.isFinite(daysAheadRaw) ? Math.max(1, Math.min(daysAheadRaw, 56)) : 14;
    const availability = buildRangesFromText(text, timezone, daysAhead);

    res.json({
      ok: true,
      availability,
      preview: {
        daysAhead,
        count: availability.length,
        timezone: extractTzFromText(text) || tzFromAbbrev(timezone) || 'Etc/UTC'
      }
    });
  } catch (e) {
    console.error('POST /api/availability/preview error', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/availability/aggregate?start=2025-09-13T00:00:00Z&end=2025-09-20T00:00:00Z
// Campaign scoping used to be optional here, and so did authentication: omitting campaign_id
// aggregated every availability row in the database for any caller. Both are required now.
router.get('/api/availability/aggregate', requireAuth, async (req, res) => {
  try {
    const start = req.query.start;
    const end = req.query.end;
    if (!start || !end) return res.status(400).json({ error: 'start and end query params required (ISO strings)' });

    const campaignId = req.query.campaign_id || req.get('X-Campaign-Id') || null;
    if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });
    const mem = await getCampaignMembership(req.user.id, campaignId);
    if (!mem) return res.status(403).json({ error: 'not_a_member' });

    const pids = req.query.player_ids ? String(req.query.player_ids).split(',').map(x=>Number.parseInt(x,10)).filter(Boolean) : null;

    // Join to players either way so only this campaign's rows can be aggregated.
    let rows;
    if (pids && pids.length > 0) {
      const placeholders = pids.map(()=> '?').join(',');
      const sql = `SELECT a.player_id, a.start_iso, a.end_iso FROM availability a JOIN players p ON p.id = a.player_id
                   WHERE p.campaign_id = ? AND a.player_id IN (${placeholders}) AND NOT (a.end_iso <= ? OR a.start_iso >= ?)`;
      rows = await db.all(sql, campaignId, ...pids, start, end);
    } else {
      const sql = `SELECT a.player_id, a.start_iso, a.end_iso FROM availability a JOIN players p ON p.id = a.player_id
                   WHERE p.campaign_id = ? AND NOT (a.end_iso <= ? OR a.start_iso >= ?)`;
      rows = await db.all(sql, campaignId, start, end);
    }

    // build sorted unique timepoints
    const points = new Set();
    points.add(start);
    points.add(end);
    for (const r of rows) {
      points.add(r.start_iso);
      points.add(r.end_iso);
    }
    // convert to sorted array of DateTimes
    const pts = Array.from(points).map(x => new Date(x).getTime()).sort((a,b)=>a-b);

    // scan intervals between adjacent points and count overlapping players
    const intervals = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const s = new Date(pts[i]);
      const e = new Date(pts[i+1]);
      const sIso = new Date(s).toISOString();
      const eIso = new Date(e).toISOString();
      const playerSet = new Set();
      for (const r of rows) {
        // overlap if not (r.end_iso <= sIso or r.start_iso >= eIso)
        if (!(new Date(r.end_iso) <= s || new Date(r.start_iso) >= e)) {
          playerSet.add(r.player_id);
        }
      }
      intervals.push({ start: sIso, end: eIso, count: playerSet.size, player_ids: Array.from(playerSet) });
    }
    res.json({ intervals });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/availability/:id -> update an availability block
router.put('/api/availability/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const row = await db.get('SELECT * FROM availability WHERE id = ?', id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    const player = await db.get('SELECT * FROM players WHERE id = ?', row.player_id);
    if (!player) return res.status(404).json({ error: 'player_not_found' });
    if (!(await canUserModifyPlayer(req.user, player.campaign_id, player.id))) return res.status(403).json({ error: 'forbidden' });
    const { start_iso, end_iso, campaign_id } = req.body || {};
    await db.run('UPDATE availability SET start_iso = ?, end_iso = ?, campaign_id = ? WHERE id = ?', start_iso || row.start_iso, end_iso || row.end_iso, (campaign_id !== undefined ? campaign_id : row.campaign_id), id);
    const upd = await db.get('SELECT * FROM availability WHERE id = ?', id);
    res.json(upd);
  } catch (e) {
    console.error('PUT /api/availability/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/availability/:id -> delete availability block
router.delete('/api/availability/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const row = await db.get('SELECT * FROM availability WHERE id = ?', id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    const player = await db.get('SELECT * FROM players WHERE id = ?', row.player_id);
    if (!player) return res.status(404).json({ error: 'player_not_found' });
    if (!(await canUserModifyPlayer(req.user, player.campaign_id, player.id))) return res.status(403).json({ error: 'forbidden' });
    await db.run('DELETE FROM availability WHERE id = ?', id);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/availability/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/availability/batch -> coalesce multiple creates/updates/deletes in one transaction
router.post('/api/availability/batch', requireAuth, async (req, res) => {
  try {
    const campaignId = req.body.campaign_id || req.query.campaign_id || req.get('X-Campaign-Id');
    if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });
    const operations = Array.isArray(req.body.operations) ? req.body.operations : [];
    if (operations.length === 0) return res.json({ ok: true, processed: 0, results: [] });

    const mem = await getCampaignMembership(req.user.id, campaignId);
    if (!mem) return res.status(403).json({ error: 'not_a_member' });

    const results = [];
    await db.transaction(async (trx) => {
      for (const op of operations) {
        const kind = op && op.op;
        if (kind === 'create') {
          const { player_id, start_iso, end_iso } = op || {};
          if (!player_id || !start_iso || !end_iso) { results.push({ ok: false, error: 'invalid_create' }); continue; }
          const prow = await trx.get('SELECT id, campaign_id FROM players WHERE id = ?', player_id);
          if (!prow || String(prow.campaign_id) !== String(campaignId)) { results.push({ ok: false, error: 'player_wrong_campaign' }); continue; }
          // Merge with any overlapping/touching rows for this player inside the transaction
          const overlaps = await trx.all(
            `SELECT id, start_iso, end_iso FROM availability
             WHERE player_id = ? AND NOT (end_iso < ? OR start_iso > ?)`,
            player_id, start_iso, end_iso
          );
          let minStart = new Date(start_iso);
          let maxEnd = new Date(end_iso);
          for (const r of overlaps) {
            const rs = new Date(r.start_iso); const re = new Date(r.end_iso);
            if (rs < minStart) minStart = rs;
            if (re > maxEnd) maxEnd = re;
          }
          for (const r of overlaps) { await trx.run('DELETE FROM availability WHERE id = ?', r.id); }
          const ins = await trx.run(
            'INSERT INTO availability(player_id,start_iso,end_iso,source,campaign_id) VALUES (?, ?, ?, ?, ?)',
            player_id, minStart.toISOString(), maxEnd.toISOString(), 'manual', campaignId
          );
          results.push({ ok: true, id: ins.lastInsertRowid, start_iso: minStart.toISOString(), end_iso: maxEnd.toISOString() });
        } else if (kind === 'update') {
          const { id, start_iso, end_iso } = op || {};
          if (!id || !start_iso || !end_iso) { results.push({ ok: false, error: 'invalid_update' }); continue; }
          const arow = await trx.get('SELECT a.id, a.player_id, p.campaign_id FROM availability a JOIN players p ON p.id = a.player_id WHERE a.id = ?', id);
          if (!arow || String(arow.campaign_id) !== String(campaignId)) { results.push({ ok: false, error: 'availability_wrong_campaign' }); continue; }
          // Replace the row with a merged interval that combines any touching/overlapping rows for this player
          await trx.run('DELETE FROM availability WHERE id = ?', id);
          const overlaps = await trx.all(
            `SELECT id, start_iso, end_iso FROM availability
             WHERE player_id = ? AND NOT (end_iso < ? OR start_iso > ?)`,
            arow.player_id, start_iso, end_iso
          );
          let minStart = new Date(start_iso);
          let maxEnd = new Date(end_iso);
          for (const r of overlaps) {
            const rs = new Date(r.start_iso); const re = new Date(r.end_iso);
            if (rs < minStart) minStart = rs;
            if (re > maxEnd) maxEnd = re;
          }
          for (const r of overlaps) { await trx.run('DELETE FROM availability WHERE id = ?', r.id); }
          const ins = await trx.run(
            'INSERT INTO availability(player_id,start_iso,end_iso,source,campaign_id) VALUES (?, ?, ?, ?, ?)',
            arow.player_id, minStart.toISOString(), maxEnd.toISOString(), 'manual', campaignId
          );
          results.push({ ok: true, id: ins.lastInsertRowid, start_iso: minStart.toISOString(), end_iso: maxEnd.toISOString() });
        } else if (kind === 'delete') {
          const { id } = op || {};
          if (!id) { results.push({ ok: false, error: 'invalid_delete' }); continue; }
          const arow = await trx.get('SELECT a.id, p.campaign_id FROM availability a JOIN players p ON p.id = a.player_id WHERE a.id = ?', id);
          if (!arow || String(arow.campaign_id) !== String(campaignId)) { results.push({ ok: false, error: 'availability_wrong_campaign' }); continue; }
          await trx.run('DELETE FROM availability WHERE id = ?', id);
          results.push({ ok: true, id });
        } else {
          results.push({ ok: false, error: 'unknown_op' });
        }
      }
    });
    res.json({ ok: true, processed: results.length, results });
  } catch (e) {
    console.error('POST /api/availability/batch error', e);
    res.status(500).json({ error: 'internal_server_error', message: e.message });
  }
});

module.exports = router;
