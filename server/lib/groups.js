const db = require('../db');

// helper: load groups with member objects
async function loadGroupsWithMembers(campaignId = null) {
  // Be tolerant if the sort_index column is missing for older DBs
  let orderClause = 'ORDER BY id ASC';
  try {
    const gCols = (await db.all("PRAGMA table_info('groups')")).map(c => c.name);
    if (gCols.includes('sort_index')) orderClause = 'ORDER BY sort_index ASC, id ASC';
  } catch (e) {
    // keep default orderClause
  }
  let gs;
  // If the groups table has campaign_id, use it for efficient filtering. Otherwise fall back
  // to inspecting group_members -> players to determine which groups belong to the campaign.
  try {
    const gCols2 = (await db.all("PRAGMA table_info('groups')")).map(c => c.name);
    if (campaignId && gCols2.includes('campaign_id')) {
      gs = await db.all(`SELECT * FROM groups WHERE campaign_id = ? ${orderClause}`, campaignId);
    } else if (!campaignId) {
      gs = await db.all(`SELECT * FROM groups ${orderClause}`);
    } else {
      // campaignId provided but no campaign_id column: build group list by joining members
      const groupIds = (await db.all(`
        SELECT DISTINCT gm.group_id FROM group_members gm
        JOIN players p ON p.id = gm.player_id
        WHERE p.campaign_id = ?
      `, campaignId)).map(r => r.group_id);
      if (groupIds.length === 0) {
        gs = [];
      } else {
        const placeholders = groupIds.map(()=>'?').join(',');
        gs = await db.all(`SELECT * FROM groups WHERE id IN (${placeholders}) ${orderClause}`, ...groupIds);
      }
    }
  } catch (e) {
    // fallback to selecting all groups if something unexpected occurs
    gs = await db.all(`SELECT * FROM groups ${orderClause}`);
  }
  const out = [];
  for (const g of gs) {
    const members = await db.all(`
      SELECT p.* FROM players p
      JOIN group_members gm ON gm.player_id = p.id
      WHERE gm.group_id = ?
    `, g.id);
    out.push({ ...g, members });
  }
  return out;
}

// ---------- helpers: map free-text names -> player ids ----------
function normalizeName(s) {
  if (!s) return '';
  return String(s).trim().toLowerCase().replace(/\s+/g,' ');
}

// Given a comma/semicolon/space-separated free text string, try to map tokens to existing player IDs
async function resolveNamesToPlayerIds(text) {
  if (!text || String(text).trim() === '') return [];
  const allPlayers = await db.all('SELECT id, name, discord FROM players');
  const pool = allPlayers.map(p => ({
    id: p.id,
    name: normalizeName(p.name || ''),
    discord: normalizeName(p.discord || '')
  }));

  // split heuristically on commas/semicolons/and the word "and"
  const tokens = String(text).split(/[,;]| and | & |\/|\n/).map(t => normalizeName(t)).filter(Boolean);
  const ids = new Set();
  for (const token of tokens) {
    // try exact match on name or discord
    let found = pool.find(p => p.name === token || p.discord === token);
    if (found) { ids.add(found.id); continue; }
    // try startsWith and includes (best-effort)
    found = pool.find(p => p.name && p.name.startsWith(token));
    if (found) { ids.add(found.id); continue; }
    found = pool.find(p => p.name && p.name.includes(token));
    if (found) { ids.add(found.id); continue; }
    // try discord includes
    found = pool.find(p => p.discord && p.discord.includes(token));
    if (found) { ids.add(found.id); continue; }
  }
  return Array.from(ids);
}

module.exports = { loadGroupsWithMembers, normalizeName, resolveNamesToPlayerIds };
