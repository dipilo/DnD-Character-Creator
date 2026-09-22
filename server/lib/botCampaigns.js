// The Discord bot's view of a campaign's table: who sits at it, when they are free, and one way
// for a member to say so in the words they would use in chat. The availability text goes through
// the same parser the site's own form uses (`lib/availability.js`), so "Mon Wed 7-11pm" means the
// same thing from Discord as from the browser.
const db = require('../db');
const { buildRangesFromText, mergeInsertAvailability, tzFromAbbrev } = require('./availability');
const { readMembership } = require('./membership');

/** Every campaign the user is in, with their own role and seat, newest first. */
async function listCampaignsForUser(userId) {
  return db.all(
    `SELECT c.id, c.name, c.system_id, c.created_at, cm.role, cm.player_id,
            (SELECT COUNT(*) FROM campaign_members m WHERE m.campaign_id = c.id) AS member_count
       FROM campaigns c
       JOIN campaign_members cm ON cm.campaign_id = c.id
      WHERE cm.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC`,
    userId,
  );
}

/** The campaign and the caller's membership, or null when either is missing — a 404 either way. */
async function campaignForMember(userId, campaignId) {
  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', campaignId);
  if (!campaign) return null;
  const membership = await readMembership(db, campaignId, userId);
  if (!membership) return null;
  return { campaign, membership };
}

/** The table, with each member's Discord id so the bot can address them. */
async function campaignMembers(campaignId) {
  const rows = await db.all(
    `SELECT cm.id, cm.role, cm.player_id, u.discord_id, u.username, p.name AS player_name, p.timezone
       FROM campaign_members cm
       LEFT JOIN users u ON u.id = cm.user_id
       LEFT JOIN players p ON p.id = cm.player_id
      WHERE cm.campaign_id = ?
      ORDER BY (cm.role = 'owner') DESC, cm.id`,
    campaignId,
  );
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    player_id: row.player_id ?? null,
    name: row.player_name || row.username || `member ${row.id}`,
    discord_id: row.discord_id ?? null,
    timezone: row.timezone || null,
  }));
}

/**
 * The seat this member's availability is written against. An owner who never took a seat has
 * none, and a DM's free evenings matter as much as anyone's, so one is made the way `add-self`
 * makes it rather than answering "you have no seat".
 */
async function ensureSeat(campaignId, user, membership) {
  if (membership.player_id) return Number(membership.player_id);
  const info = await db.run(
    'INSERT INTO players (name, discord, timezone, notes, campaign_id) VALUES (?, ?, ?, ?, ?)',
    user.username || `user${user.id}`, '', '', '', campaignId,
  );
  await db.run('UPDATE campaign_members SET player_id = ? WHERE id = ?', info.lastInsertRowid, membership.id);
  return Number(info.lastInsertRowid);
}

/**
 * Overlap of the table's availability inside [start, end): one interval per stretch where the
 * same set of players is free. Shared by the browser's aggregate route and the bot's.
 */
async function aggregateAvailability(campaignId, startIso, endIso, playerIds = null) {
  let rows;
  if (Array.isArray(playerIds) && playerIds.length > 0) {
    const placeholders = playerIds.map(() => '?').join(',');
    rows = await db.all(
      `SELECT a.player_id, a.start_iso, a.end_iso FROM availability a JOIN players p ON p.id = a.player_id
        WHERE p.campaign_id = ? AND a.player_id IN (${placeholders}) AND NOT (a.end_iso <= ? OR a.start_iso >= ?)`,
      campaignId, ...playerIds, startIso, endIso,
    );
  } else {
    rows = await db.all(
      `SELECT a.player_id, a.start_iso, a.end_iso FROM availability a JOIN players p ON p.id = a.player_id
        WHERE p.campaign_id = ? AND NOT (a.end_iso <= ? OR a.start_iso >= ?)`,
      campaignId, startIso, endIso,
    );
  }
  const points = new Set([startIso, endIso]);
  for (const r of rows) {
    points.add(r.start_iso);
    points.add(r.end_iso);
  }
  const pts = Array.from(points).map((x) => new Date(x).getTime()).sort((a, b) => a - b);
  const intervals = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const s = new Date(pts[i]);
    const e = new Date(pts[i + 1]);
    const playerSet = new Set();
    for (const r of rows) {
      if (!(new Date(r.end_iso) <= s || new Date(r.start_iso) >= e)) playerSet.add(r.player_id);
    }
    intervals.push({ start: s.toISOString(), end: e.toISOString(), count: playerSet.size, player_ids: Array.from(playerSet) });
  }
  return intervals;
}

/**
 * Parse the text the way the form does and merge each block onto the seat. A zone given with the
 * text is remembered on the seat, so the next message need not repeat it; none given reads the
 * seat's. An unknown zone name is refused rather than silently read as UTC.
 */
async function writeAvailabilityFromText(playerId, campaignId, text, timezone, daysAhead) {
  const seat = await db.get('SELECT timezone FROM players WHERE id = ?', playerId);
  let zone = seat?.timezone || '';
  if (timezone) {
    const resolved = tzFromAbbrev(timezone);
    if (!resolved) return { error: 'unknown_timezone' };
    zone = resolved;
    if (zone !== seat?.timezone) await db.run('UPDATE players SET timezone = ? WHERE id = ?', zone, playerId);
  }
  const ranges = buildRangesFromText(String(text || ''), zone, daysAhead);
  const written = [];
  for (const range of ranges) {
    const merged = await mergeInsertAvailability(playerId, range.start_iso, range.end_iso, 'discord');
    await db.run('UPDATE availability SET campaign_id = ? WHERE id = ?', campaignId, merged.id);
    written.push({ id: merged.id, start_iso: merged.start_iso, end_iso: merged.end_iso });
  }
  return { written, timezone: zone || 'Etc/UTC' };
}

/** Drop every block of this seat that has not ended yet; the past is a record and stays. */
async function clearFutureAvailability(playerId, nowIso) {
  const result = await db.run('DELETE FROM availability WHERE player_id = ? AND end_iso > ?', playerId, nowIso);
  return Number(result.changes || 0);
}

module.exports = {
  aggregateAvailability,
  campaignForMember,
  campaignMembers,
  clearFutureAvailability,
  ensureSeat,
  listCampaignsForUser,
  writeAvailabilityFromText,
};
