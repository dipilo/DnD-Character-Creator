const crypto = require('node:crypto');

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// utility: generate a random token
// Backed by crypto rather than Math.random: invite tokens and campaign codes minted here are
// credentials — a guessable invite token joins a stranger to a campaign.
function genToken(len = 24) {
  let out = '';
  for (let i = 0; i < len; i++) out += TOKEN_ALPHABET[crypto.randomInt(TOKEN_ALPHABET.length)];
  return out;
}

/** 256 bits of entropy, url-safe. The session cookie value, so nothing weaker will do. */
function genSessionId() {
  return crypto.randomBytes(32).toString('base64url');
}

module.exports = { genToken, genSessionId };
