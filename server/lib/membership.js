/**
 * Joining and claiming a seat are two doors into one membership, and `campaign_members` has no
 * unique key to stop them being two rows. A member who joined by invite and then claimed a seat
 * ended up with the seat and the permissions on *different* rows, and every permission check reads
 * one row: the flags the claim granted were invisible, and the Members grid listed the person
 * twice.
 */

/** The membership row that counts: a seated one wins, then the oldest. */
async function readMembership(runner, campaignId, userId) {
  const rows = await runner.all(
    'SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? ORDER BY (player_id IS NULL), id',
    campaignId, userId,
  );
  return rows[0] ?? null;
}

/**
 * Record a membership without ever making a second one. An existing row keeps its role and gains
 * the seat and any permissions the arrival grants; duplicates left by earlier joins are folded in.
 */
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

module.exports = { readMembership, upsertMembership };
