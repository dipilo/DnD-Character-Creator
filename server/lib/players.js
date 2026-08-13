/**
 * A player row as a client may see it.
 *
 * `players.password_hash` is the bcrypt hash that reserves a claimed seat, and `SELECT p.*`
 * handed it to every caller of the roster, group and claim endpoints — an offline cracking
 * target for anyone in the campaign. It is still read server-side (it is how `is_claimed` is
 * derived), it just never leaves the process.
 */
function publicPlayer(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  delete out.password_hash;
  return out;
}

module.exports = { publicPlayer };
