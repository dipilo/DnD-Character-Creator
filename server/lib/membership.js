/** No unique key, so the seat and the permissions could land on different rows. */

/** The membership row that counts: a seated one wins, then the oldest. */
async function readMembership(runner, campaignId, userId) {
  const rows = await runner.all(
    'SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? ORDER BY (player_id IS NULL), id',
    campaignId, userId,
  );
  return rows[0] ?? null;
}

/** An existing row keeps its role and gains the seat; earlier duplicates fold in. */
async function upsertMembership(runner, { campaignId, userId, playerId = null, role = 'player', permissions = null }) {
  const rows = await runner.all(
    'SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? ORDER BY (player_id IS NULL), id',
    campaignId, userId,
  );
  if (rows.length === 0) {
    await runner.run(
      'INSERT INTO campaign_members(campaign_id, user_id, player_id, role, permissions) VALUES (?, ?, ?, ?, ?)',
      campaignId, userId, playerId, role, permissions,
    );
    return;
  }

  const keep = rows[0];
  for (const row of rows.slice(1)) {
    await runner.run('DELETE FROM campaign_members WHERE id = ?', row.id);
  }
  await runner.run(
    'UPDATE campaign_members SET player_id = ?, role = ?, permissions = ? WHERE id = ?',
    playerId ?? keep.player_id ?? null,
    keep.role === 'owner' ? 'owner' : role,
    permissions ?? keep.permissions ?? null,
    keep.id,
  );
}

/** Dropping the row evicted the holder; a campaign-scoped account is the exception. */
async function releaseSeat(runner, campaignId, playerId) {
  const rows = await runner.all(
    `SELECT cm.id, cm.user_id, u.password_hash
       FROM campaign_members cm LEFT JOIN users u ON u.id = cm.user_id
      WHERE cm.campaign_id = ? AND cm.player_id = ?`,
    campaignId, playerId,
  );
  for (const row of rows) {
    if (row.user_id && !row.password_hash) {
      await runner.run('DELETE FROM campaign_members WHERE id = ?', row.id);
    } else {
      await runner.run('UPDATE campaign_members SET player_id = NULL WHERE id = ?', row.id);
    }
  }
  return rows.map((row) => row.user_id).filter(Boolean);
}

module.exports = { readMembership, releaseSeat, upsertMembership };
