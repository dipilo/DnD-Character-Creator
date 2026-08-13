const inviteChallengeSessions = new Map();
const inviteChallengePassTokens = new Map();
const INVITE_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_FEATURES_ENABLED = false;
const INVITE_PASS_TTL_MS = 15 * 60 * 1000;

const RIDDLE_BANK = [
  {
    question: 'I speak without a mouth and hear without ears. What am I?',
    options: ['Shadow', 'Echo', 'Candle', 'Map'],
    correct: 'echo'
  },
  {
    question: 'What has keys but can\'t open locks?',
    options: ['Piano', 'River', 'Lantern', 'Armor'],
    correct: 'piano'
  },
  {
    question: 'What gets wetter the more it dries?',
    options: ['Towel', 'Sand', 'Moon', 'Book'],
    correct: 'towel'
  }
];

function pruneInviteChallengeState() {
  const now = Date.now();
  for (const [id, sess] of inviteChallengeSessions.entries()) {
    if (!sess || sess.expiresAt <= now) inviteChallengeSessions.delete(id);
  }
  for (const [id, pass] of inviteChallengePassTokens.entries()) {
    if (!pass || pass.expiresAt <= now) inviteChallengePassTokens.delete(id);
  }
}

function makeFakeCaptchaText() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

module.exports = { inviteChallengeSessions, inviteChallengePassTokens, INVITE_CHALLENGE_TTL_MS, CHALLENGE_FEATURES_ENABLED, INVITE_PASS_TTL_MS, RIDDLE_BANK, pruneInviteChallengeState, makeFakeCaptchaText };
