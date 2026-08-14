const express = require('express');
const { config } = require('../config');
const db = require('../db');
const { buildRangesFromText, mergeInsertAvailability } = require('../lib/availability');
const { resolveNamesToPlayerIds } = require('../lib/groups');
const fetch = require('../lib/httpFetch');
const { fetchSheetCSV, fetchSheetHeaders, parseSheetId } = require('../lib/sheets');
const { intakeFields, matchHeaders, planSheetImport } = require('../lib/sheetIntake');
const { publicPlayer } = require('../lib/players');
const { canUserModifyPlayer, getCampaignMembership, isCampaignOwner, memberHasPermission, requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * The plan, in the shape the client renders: what would be created, what would be changed on which
 * seat, and what was skipped and why. Returned by both the dry run and the real write so the
 * preview and the result read identically.
 */
function summarisePlan(plan, seats) {
  const seatNames = new Map(seats.map((seat) => [seat.id, seat.name || seat.discord || `#${seat.id}`]));
  return {
    created: plan.creates.length,
    updated: plan.updates.length,
    skipped: plan.skipped.length,
    detail: {
      creates: plan.creates.map((c) => ({ row: c.rowIndex + 1, name: c.values.name, discord: c.values.discord })),
      updates: plan.updates.map((u) => ({
        row: u.rowIndex + 1,
        seat_id: u.seatId,
        seat_name: seatNames.get(u.seatId) ?? null,
        claimed: u.claimed,
        columns: Object.keys(u.columns),
      })),
      skipped: plan.skipped.map((s) => ({ row: s.rowIndex + 1, seat_id: s.seatId ?? null, reason: s.reason })),
    },
  };
}

// The intake schema and the templates built from it. Served rather than duplicated in the client:
// the mapping UI, the "copy this template" card and the importer all read one definition.
router.get('/api/sheet-template', requireAuth, (req, res) => {
  res.json({
    ok: true,
    fields: intakeFields(),
    templates: {
      sheet: config.sheetTemplateUrl || null,
      form: config.formTemplateUrl || null,
    },
  });
});

// The three routes below all took no authentication at all. They make the server fetch a
// caller-supplied URL, rewrite a campaign's whole roster, or forward a body to the configured
// Apps Script endpoint, so all three now require a session (and campaign rights where relevant).

// endpoint: POST /api/sheet-columns { spreadsheetId, gid?, sheetName? }
// Answers with the sheet's headers *and* the mapping they auto-resolve to, so the client shows a
// filled-in mapping the DM corrects rather than an empty one they have to build.
router.post('/api/sheet-columns', requireAuth, async (req, res) => {
  try {
    const raw = req.body.spreadsheetId || req.body.sheetId || req.body.sheetLink;
    if (!raw) return res.status(400).json({ error: 'spreadsheetId required' });
    // parse ID from full URL or accept raw ID
    const id = parseSheetId(raw);
    if (!id) return res.status(400).json({ error: 'invalid spreadsheet id or url' });
    const gid = req.body.gid;
    const sheetName = req.body.sheetName;
    const headers = await fetchSheetHeaders(id, { gid, sheetName });
    const { mapping, unmatchedHeaders, missingRequired } = matchHeaders(headers);
    res.json({ ok: true, headers, mapping, unmatchedHeaders, missingRequired });
  } catch (e) {
    console.error('sheet-columns error', e);
    res.status(500).json({ error: e.message });
  }
});

/* ---------- endpoints ---------- */

/**
 * Imports a sheet's rows into one campaign's roster.
 *
 * The version this replaced derived each player's id from the sheet's **row index**
 * (`row.id ? Number(row.id) : idx + 1`) and wrote `INSERT OR REPLACE INTO players (id, ...)`.
 * Importing a five-row sheet therefore overwrote players 1–5 across the *entire database*,
 * whichever campaigns they belonged to, blanked every column the sheet had no answer for, and
 * un-claimed any seat it landed on. Rows are matched against this campaign's own seats now
 * (`planSheetImport`), unmatched rows become new seats with server-assigned ids, and a blank
 * answer means "no opinion" rather than "clear the column".
 *
 * `dryRun` returns the same plan without writing, which is what the client previews.
 */
router.post('/api/sync', requireAuth, async (req, res) => {
  try {
    const input = req.body.spreadsheetId || req.body.sheetLink || req.body.sheet || config.spreadsheetId;
    const gid = req.body.gid !== undefined ? req.body.gid : config.gid;
    const sheetName = req.body.sheetName || null;
    const mapping = req.body.mapping || null;
    const dryRun = req.body.dry_run === true;
    const campaignId = req.body.campaign_id || null;
    if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });

    const mem = await getCampaignMembership(req.user.id, campaignId);
    if (!mem) return res.status(403).json({ error: 'not_a_member' });
    // An import creates and edits seats, so it is gated like creating one. The old route let any
    // member of a campaign rewrite everyone's seats. Same shape as POST /api/players.
    if (!await isCampaignOwner(req.user.id, campaignId) && !memberHasPermission(mem, 'can_create_players')) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const id = parseSheetId(input);
    if (!id) return res.status(400).json({ error: 'Invalid spreadsheet id or URL provided.' });

    let rows;
    try {
      rows = await fetchSheetCSV(id, { gid, sheetName });
    } catch (e) {
      console.error('Sheet fetch failed:', e);
      return res.status(400).json({ error: 'sheet fetch failed', message: e.message, attempts: e.attempts || null });
    }

    const seats = await db.all('SELECT * FROM players WHERE campaign_id = ?', campaignId);
    const claimedRows = await db.all(
      'SELECT player_id FROM campaign_members WHERE campaign_id = ? AND player_id IS NOT NULL AND user_id IS NOT NULL',
      campaignId
    );
    const claimedSeatIds = new Set(claimedRows.map((row) => row.player_id));

    const plan = planSheetImport({ rows, seats, mapping, claimedSeatIds });

    if (dryRun) {
      return res.json({ ok: true, dry_run: true, ...summarisePlan(plan, seats) });
    }

    const touched = [];
    await db.transaction(async (trx) => {
      for (const create of plan.creates) {
        const columns = ['campaign_id', 'sort_index'];
        const values = [campaignId, seats.length + touched.length];
        for (const field of intakeFields()) {
          if (create.values[field.key] === '') continue;
          columns.push(field.column);
          values.push(create.values[field.key]);
        }
        const placeholders = columns.map(() => '?').join(', ');
        const info = await trx.run(
          `INSERT INTO players (${columns.join(', ')}) VALUES (${placeholders})`,
          ...values
        );
        touched.push({ id: Number(info.lastInsertRowid), values: create.values, created: true });
      }

      for (const update of plan.updates) {
        const columns = Object.keys(update.columns);
        const assignments = columns.map((column) => `${column} = ?`).join(', ');
        await trx.run(
          `UPDATE players SET ${assignments} WHERE id = ? AND campaign_id = ?`,
          ...columns.map((column) => update.columns[column]),
          update.seatId,
          campaignId
        );
        touched.push({ id: update.seatId, values: update.values, created: false });
      }
    });

    // Preference names resolve to ids and availability re-parses outside the transaction: both
    // read rows the transaction has only just written, and both are idempotent if a later one
    // fails. `campaign_members` gets a seat row per created player so unclaimed seats still list.
    for (const seat of touched) {
      if (seat.created) {
        try {
          await db.run('INSERT OR IGNORE INTO campaign_members (campaign_id, player_id, role) VALUES (?, ?, ?)', campaignId, seat.id, 'player');
        } catch (e) {
          console.warn('could not add campaign_members row for imported seat', seat.id, e?.message);
        }
      }

      const withIds = await resolveNamesToPlayerIds(seat.values.pref_play_with || '');
      const notIds = await resolveNamesToPlayerIds(seat.values.pref_play_not_with || '');
      await db.run(
        'UPDATE players SET pref_play_with_ids = ?, pref_play_not_with_ids = ? WHERE id = ?',
        JSON.stringify(withIds),
        JSON.stringify(notIds),
        seat.id
      );

      // Only sheet-sourced blocks are replaced; anything the player dragged out by hand survives.
      if (seat.values.notes) {
        await db.run("DELETE FROM availability WHERE player_id = ? AND source = 'sheet'", seat.id);
        const parsed = buildRangesFromText(seat.values.notes, seat.values.timezone || '', 14);
        for (const block of parsed) {
          await mergeInsertAvailability(seat.id, block.start_iso, block.end_iso, 'sheet');
        }
      }
    }

    const players = await db.all('SELECT * FROM players WHERE campaign_id = ? ORDER BY sort_index, id', campaignId);
    res.json({
      ok: true,
      ...summarisePlan(plan, seats),
      players: players.map((p) => publicPlayer(p)),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_server_error', message: e.message });
  }
});


// rebuild availability for single player (re-parse notes, delete sheet-sourced blocks, insert new)
router.post('/api/rebuild/:player_id', requireAuth, async (req, res) => {
  try {
    const player_id = Number.parseInt(req.params.player_id, 10);
    const player = await db.get('SELECT * FROM players WHERE id = ?', player_id);
    if (!player) return res.status(404).json({ error: 'player_not_found' });
    if (!(await canUserModifyPlayer(req.user, player.campaign_id, player_id))) return res.status(403).json({ error: 'forbidden' });
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
router.post('/api/push-to-sheet', requireAuth, async (req, res) => {
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
