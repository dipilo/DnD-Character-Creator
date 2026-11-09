// What `evaluateFeatPrerequisites` enforces beyond a single minimum: the or-of-abilities and the
// named feature the 2024 book gates its General, Fighting Style and Epic Boon feats on.
// Run with `npm run test:feat-prerequisites`.
import assert from 'node:assert/strict';

const { evaluateFeatPrerequisites } = await import('@/lib/featPrerequisites');

const context = (overrides = {}) => ({
  abilityScores: { strength: 12, dexterity: 15, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  totalLevel: 4,
  classNames: ['Fighter'],
  featureNames: ['Fighting Style', 'Second Wind'],
  featNames: ['Strike of the Giants'],
  hasSpellcasting: false,
  hasPactMagic: false,
  ...overrides
});

const feat = (prerequisites) => ({ id: 'f', name: 'Fixture', description: '', features: [], source: 'Fixture', prerequisites });

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, detail: e.message.split('\n')[0] });
  }
}

check('one branch of an ability or-list is enough', () => {
  const grappler = feat({ level: 4, abilityAlternatives: [{ strength: 13 }, { dexterity: 13 }] });
  assert.equal(evaluateFeatPrerequisites(grappler, context()).met, true);
});

check('an unmet ability or-list reports every branch, not the nearest miss', () => {
  const grappler = feat({ abilityAlternatives: [{ strength: 13 }, { dexterity: 13 }] });
  const scores = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };
  assert.deepEqual(
    evaluateFeatPrerequisites(grappler, context({ abilityScores: scores })).unmet,
    ['Requires Strength 13 or Dexterity 13']
  );
});

check('a block naming two abilities is an and inside its own branch', () => {
  const both = feat({ abilityAlternatives: [{ strength: 13, dexterity: 13 }] });
  assert.equal(evaluateFeatPrerequisites(both, context()).met, false, 'Strength 12 fails the pair');
  assert.equal(
    evaluateFeatPrerequisites(both, context({ abilityScores: { ...context().abilityScores, strength: 13 } })).met,
    true
  );
});

check('a named feature is checked against the features the character has', () => {
  const archery = feat({ features: ['Fighting Style'] });
  assert.equal(evaluateFeatPrerequisites(archery, context()).met, true);
  assert.deepEqual(
    evaluateFeatPrerequisites(archery, context({ featureNames: ['Arcane Recovery'] })).unmet,
    ['Requires a Fighting Style feature']
  );
});

check('a feature the class renames still matches, the way a lineage does', () => {
  const archery = feat({ features: ['Fighting Style'] });
  assert.equal(evaluateFeatPrerequisites(archery, context({ featureNames: ['Additional Fighting Style'] })).met, true);
});

check('a feat that builds on another is matched by name, not by id', () => {
  const ember = feat({ level: 4, feats: ['strike of the giants'] });
  assert.equal(evaluateFeatPrerequisites(ember, context()).met, true);
  assert.deepEqual(
    evaluateFeatPrerequisites(ember, context({ featNames: [] })).unmet,
    ['Requires the Strike of the Giants feat']
  );
});

check('every unmet requirement is reported, not the first', () => {
  const boon = feat({ level: 19, spellcasting: true, text: 'Level 19; Spellcasting feature' });
  assert.deepEqual(evaluateFeatPrerequisites(boon, context()).unmet, [
    'Requires level 19 (you are level 4)',
    'Requires a Spellcasting feature'
  ]);
});

check('a feat stating nothing is open to anyone', () => {
  assert.deepEqual(evaluateFeatPrerequisites(feat(undefined), context()), { met: true, unmet: [] });
});

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? `\n       ${entry.detail}` : ''}`);
}
const failed = checks.filter((entry) => !entry.ok).length;
console.log(`\nfeat prerequisites: ${checks.length - failed}/${checks.length} passed`);
process.exit(failed > 0 ? 1 : 0);
