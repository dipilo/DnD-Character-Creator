/** `password_hash` never leaves the process; it is still how `is_claimed` is derived. */
function publicPlayer(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  delete out.password_hash;
  return out;
}

module.exports = { publicPlayer };
