const express = require('express');
const { config } = require('../config');
const db = require('../db');
const { buildRangesFromText, mergeInsertAvailability } = require('../lib/availability');
const { resolveNamesToPlayerIds } = require('../lib/groups');
const fetch = require('../lib/httpFetch');
const { fetchSheetCSV, fetchSheetHeaders, parseSheetId } = require('../lib/sheets');

const router = express.Router();

// endpoint: POST /api/sheet-columns { spreadsheetId, gid?, sheetName? }
// replace or add this in server/server.js (near your other endpoints)
router.post('/api/sheet-columns', async (req, res) => {
  try {
    const raw = req.body.spreadsheetId || req.body.sheetId || req.body.sheetLink;
    if (!raw) return res.status(400).json({ error: 'spreadsheetId required' });
    // parse ID from full URL or accept raw ID
    const id = parseSheetId(raw);
    if (!id) return res.status(400).json({ error: 'invalid spreadsheet id or url' });
    const gid = req.body.gid;
    const sheetName = req.body.sheetName;
    const headers = await fetchSheetHeaders(id, { gid, sheetName });
    res.json({ ok: true, headers });
  } catch (e) {
    console.error('sheet-columns error', e);
    res.status(500).json({ error: e.message });
  }
});

/* ---------- endpoints ---------- */

// sync (imports sheet rows and parses availability into DB as source='sheet')
router.post('/api/sync', async (req, res) => {
  try {
    // Accept spreadsheetId as a raw id or full URL
    const input = req.body.spreadsheetId || req.body.sheetLink || req.body.sheet || config.spreadsheetId;
    const gid = req.body.gid !== undefined ? req.body.gid : config.gid;
    const sheetName = req.body.sheetName || null;
  const mapping = req.body.mapping || null; // optional mapping: { name: "Player Name", notes: "Availability", ... }
  // Accept campaign_id to scope imported rows
  const campaignId = req.body.campaign_id || (mapping && mapping.campaign_id) || null;
  if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });

    const id = parseSheetId(input);
    if (!id) return res.status(400).json({ error: 'Invalid spreadsheet id or URL provided.' });

    let rows;
    try {
      rows = await fetchSheetCSV(id, { gid, sheetName });
    } catch (e) {
      console.error('Sheet fetch failed:', e);
      return res.status(400).json({ error: 'sheet fetch failed', message: e.message, attempts: e.attempts || null });
    }

    function readMappedOrVariants(r, internalName, variants = []) {
      if (mapping && mapping[internalName]) {
        const header = mapping[internalName];
        if (r[header] !== undefined && r[header] !== null && String(r[header]).trim() !== '') return String(r[header]).trim();
      }
      for (const v of variants) {
        if (r[v] !== undefined && r[v] !== null && String(r[v]).trim() !== '') return String(r[v]).trim();
      }
      return '';
    }
    const tx = async (importRows) => await db.transaction(async (trx) => {
      for (let idx = 0; idx < importRows.length; idx += 1) {
        const row = importRows[idx];
        const name = readMappedOrVariants(row, 'name', ['What is your name?', 'name', 'Name', 'Player Name', 'Player']);
        const discord = readMappedOrVariants(row, 'discord', ['What is your Discord Username?', 'discord', 'Discord', 'Discord Username', 'Discord Handle']);
        const timezone = readMappedOrVariants(row, 'timezone', ['What time zone are you in?', 'timezone', 'Timezone', 'Time zone', 'TZ', 'tz', 'TimeZone']);
        const notes = readMappedOrVariants(row, 'notes', [
          'Availability', 'Notes', 'when are you free', 'free times', 'availability notes', 'Availability Notes'
        ]);
        const age = readMappedOrVariants(row, 'age', ['Age', 'age']);
        const computer_access = readMappedOrVariants(row, 'computer_access', ['Computer Access', 'computer_access', 'Computer']);
        const pref_party_size = readMappedOrVariants(row, 'pref_party_size', ['Preferred party size', 'party size', 'pref_party_size']);
        const pref_session_length = readMappedOrVariants(row, 'pref_session_length', ['Preferred session length', 'session length', 'pref_session_length']);
        const pref_vtt = readMappedOrVariants(row, 'pref_vtt', ['Preferred VTT', 'VTT', 'pref_vtt']);
        const pref_play_with = readMappedOrVariants(row, 'pref_play_with', ['prefer_play_with', 'preferred players', 'players you prefer', 'Prefer to play with']);
        const pref_play_not_with = readMappedOrVariants(row, 'pref_play_not_with', ['prefer_not_play_with', 'players you prefer not to play with', 'dont play with', 'do not play with', 'Prefer NOT to play with']);

        const idNum = row.id ? Number.parseInt(row.id, 10) : (idx + 1);
        const withIds = await resolveNamesToPlayerIds(pref_play_with || '');
        const notIds = await resolveNamesToPlayerIds(pref_play_not_with || '');
        const existingSort = await trx.get('SELECT sort_index FROM players WHERE id = ?', idNum);
        const sortIndex = existingSort?.sort_index ?? idx;

        await trx.run(
          `INSERT OR REPLACE INTO players (
            id, name, discord, timezone, notes, age, computer_access,
            pref_party_size, pref_session_length, pref_vtt,
            pref_play_with, pref_play_not_with,
            pref_play_with_ids, pref_play_not_with_ids,
            sort_index, campaign_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          idNum,
          name || '',
          discord || '',
          timezone || '',
          notes || '',
          age || '',
          computer_access || '',
          pref_party_size || '',
          pref_session_length || '',
          pref_vtt || '',
          pref_play_with || '',
          pref_play_not_with || '',
          JSON.stringify(withIds),
          JSON.stringify(notIds),
          sortIndex,
          campaignId
        );

        try {
          await trx.run('INSERT OR IGNORE INTO campaign_members (campaign_id, player_id, role) VALUES (?, ?, ?)', campaignId, idNum, 'player');
        } catch (cmErr) {
          console.warn('Could not insert campaign_members for imported player', idNum, cmErr && cmErr.message);
        }

        await trx.run("DELETE FROM availability WHERE player_id = ? AND source = 'sheet'", idNum);
        const parsed = buildRangesFromText(notes || '', timezone || '', 14);
        for (const block of parsed) {
          await mergeInsertAvailability(idNum, block.start_iso, block.end_iso, 'sheet');
        }
      }
    });

    await tx(rows);

    res.json({ ok: true, imported: rows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_server_error', message: e.message });
  }
});


// rebuild availability for single player (re-parse notes, delete sheet-sourced blocks, insert new)
router.post('/api/rebuild/:player_id', async (req, res) => {
  try {
    const player_id = parseInt(req.params.player_id, 10);
    const player = await db.get('SELECT * FROM players WHERE id = ?', player_id);
    if (!player) return res.status(404).json({ error: 'player_not_found' });
    // delete previous sheet-origin availability
    await db.run("DELETE FROM availability WHERE player_id = ? AND source = 'sheet'", player_id);
    // parse fresh and insert as 'sheet'
    const parsed = buildRangesFromText(player.notes || '', player.timezone || '', 14);
    for (const b of parsed) {
      await mergeInsertAvailability(player_id, b.start_iso, b.end_iso, 'sheet');
    }
    res.json({ ok: true, created: parsed.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// forward to Apps Script unchanged
router.post('/api/push-to-sheet', async (req, res) => {
  try {
    const targetUrl = config.appsScriptUrl;
    const r = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const text = await r.text();
    res.status(r.status).send(text);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
