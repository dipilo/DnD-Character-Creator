// What a limited-use feature's own sentences are read to state.
//
// This fails silently: a sentence the parser stops matching does not error, the feature just has
// no tracker on the sheet. Every line below is one a source actually prints.
//
//   node scripts/test/classResources.mjs      (npm run test:class-resources)

import assert from 'node:assert/strict';
import { extractProseResources, parseResourceReset, readProseResource } from '../lib/classResources.mjs';

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, detail: e.message.split('\n')[0] });
  }
}

const feature = (name, level, description) => ({ name, level, description });
const at = (perLevel, level) => perLevel[level - 1];

check('2014 Second Wind: once, back on a short rest', () => {
  const out = readProseResource(feature('Second Wind', 1,
    'On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.'));
  assert.equal(out.resetsOn, 'short');
  assert.equal(at(out.perLevel, 1), 1);
  assert.equal(at(out.perLevel, 20), 1);
});

check('2014 Action Surge: a second use at 17th', () => {
  const out = readProseResource(feature('Action Surge', 2,
    'Once you use this feature, you must finish a short or long rest before you can use it again. Starting at 17th level, you can use it twice before a rest, but only once on the same turn.'));
  assert.equal(out.resetsOn, 'short');
  assert.deepEqual([at(out.perLevel, 1), at(out.perLevel, 2), at(out.perLevel, 16), at(out.perLevel, 17)], [0, 1, 1, 2]);
});

check('2024 Action Surge: "can’t do so again", "level 17"', () => {
  const out = readProseResource(feature('Action Surge', 2,
    'Once you use this feature, you can’t do so again until you finish a Short or Long Rest. Starting at level 17, you can use it twice before a rest but only once on a turn.'));
  assert.equal(out.resetsOn, 'short');
  assert.deepEqual([at(out.perLevel, 2), at(out.perLevel, 17)], [1, 2]);
});

check('2014 Indomitable: twice at 13th, three times at 17th, long rest', () => {
  const out = readProseResource(feature('Indomitable', 9,
    'If you do so, you must use the new roll, and you can’t use this feature again until you finish a long rest. You can use this feature twice between long rests starting at 13th level and three times between long rests starting at 17th level.'));
  assert.equal(out.resetsOn, 'long');
  assert.deepEqual([at(out.perLevel, 8), at(out.perLevel, 9), at(out.perLevel, 13), at(out.perLevel, 17)], [0, 1, 2, 3]);
});

check('2014 Channel Divinity names the pool and escalates twice', () => {
  const out = readProseResource(feature('Channel Divinity', 2,
    'When you use your Channel Divinity, you choose which effect to create. You must then finish a short or long rest to use your Channel Divinity again. Beginning at 6th level, you can use your Channel Divinity twice between rests, and beginning at 18th level, you can use it three times between rests.'));
  assert.equal(out.name, 'Channel Divinity');
  assert.equal(out.resetsOn, 'short');
  assert.deepEqual([at(out.perLevel, 1), at(out.perLevel, 2), at(out.perLevel, 6), at(out.perLevel, 18)], [0, 1, 2, 3]);
});

check('2014 Sacred Oath carries the Paladin’s Channel Divinity under the feature’s name', () => {
  const out = readProseResource(feature('Sacred Oath', 3,
    'Your oath allows you to channel divine energy to fuel magical effects. You must then finish a short or long rest to use your Channel Divinity again.'));
  assert.equal(out.name, 'Channel Divinity');
  assert.equal(out.featureName, 'Sacred Oath');
  assert.equal(at(out.perLevel, 3), 1);
});

check('2014 Wild Shape: "You can use this feature twice."', () => {
  const out = readProseResource(feature('Wild Shape', 2,
    'You can use this feature twice. You regain expended uses when you finish a short or long rest.'));
  assert.equal(out.resetsOn, 'short');
  assert.equal(at(out.perLevel, 2), 2);
});

check('2014 Bardic Inspiration: Charisma modifier, minimum once, long rest', () => {
  const out = readProseResource(feature('Bardic Inspiration', 1,
    'You can use this feature a number of times equal to your Charisma modifier (a minimum of once). You regain any expended uses when you finish a long rest.'));
  assert.deepEqual(out.usesFromAbility, { ability: 'charisma', bonus: 0, minimum: 1 });
  assert.equal(out.resetsOn, 'long');
  assert.equal(at(out.perLevel, 1), 1);
});

check('Font of Inspiration moves Bardic Inspiration to a short rest from 5th', () => {
  const out = extractProseResources([
    feature('Bardic Inspiration', 1, 'You can use this feature a number of times equal to your Charisma modifier (a minimum of once). You regain any expended uses when you finish a long rest.'),
    feature('Font of Inspiration', 5, 'Beginning when you reach 5th level, you regain all of your expended uses of Bardic Inspiration when you finish a short or long rest.'),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].resetsOn, 'long');
  assert.equal(out[0].shortRestFromLevel, 5);
});

check('2014 Divine Sense: 1 + Charisma modifier, "When you finish a long rest, you regain"', () => {
  const out = readProseResource(feature('Divine Sense', 1,
    'You can use this feature a number of times equal to 1 + your Charisma modifier. When you finish a long rest, you regain all expended uses.'));
  assert.deepEqual(out.usesFromAbility, { ability: 'charisma', bonus: 1, minimum: 0 });
  assert.equal(out.resetsOn, 'long');
});

check('Tasha’s: a number of times equal to your proficiency bonus', () => {
  const out = readProseResource(feature('Giant’s Might', 3,
    'You can use this feature a number of times equal to your proficiency bonus, and you regain all expended uses of it when you finish a long rest.'));
  assert.equal(out.usesFromProficiencyBonus, true);
  assert.equal(out.resetsOn, 'long');
});

check('Tasha’s Harness Divine Power states a level table', () => {
  const out = readProseResource(feature('Harness Divine Power', 2,
    'The number of times you can use this feature is based on the level you’ve reached in this class: 2nd level, once; 6th level, twice; and 18th level, thrice. You regain all expended uses when you finish a long rest.'));
  assert.deepEqual([at(out.perLevel, 1), at(out.perLevel, 2), at(out.perLevel, 6), at(out.perLevel, 18)], [0, 1, 2, 3]);
});

check('Xanathar’s Arcane Shot: "You have two uses of this ability"', () => {
  const out = readProseResource(feature('Arcane Shot', 3,
    'You have two uses of this ability, and you regain all expended uses of it when you finish a short or long rest.'));
  assert.equal(at(out.perLevel, 3), 2);
  assert.equal(out.resetsOn, 'short');
});

check('a feature that recovers on days or initiative is not a pool', () => {
  assert.equal(readProseResource(feature('Divine Intervention', 10,
    'If your deity intervenes, you can’t use this feature again for 7 days. Otherwise, you can use it again after you finish a long rest.')), null);
  assert.equal(readProseResource(feature('Limited Wish', 14,
    'Once you use this feature, you can’t use it again until you finish 1d4 long rests.')), null);
  assert.equal(readProseResource(feature('Blessed Strikes', 8,
    'Once you deal this damage, you can’t use this feature again until the start of your next turn.')), null);
});

check('a feature a table column already claims is skipped', () => {
  const column = { id: 'second-wind', name: 'Second Wind', perLevel: [2], resetsOn: 'long', featureName: 'Second Wind' };
  const out = extractProseResources([
    feature('Second Wind', 1, 'You can use this feature twice. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest.'),
  ], [column]);
  assert.deepEqual(out, [column]);
});

check('the table reader’s reset wording still reads the same way', () => {
  assert.deepEqual(parseResourceReset('You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest.'), { resetsOn: 'long', shortRestRegain: 1 });
  assert.deepEqual(parseResourceReset('When you spend a ki point, it is unavailable until you finish a short or long rest.'), { resetsOn: 'short', shortRestRegain: null });
  assert.deepEqual(parseResourceReset('you can practice weapon drills and change one of those weapon choices when you finish a Long Rest'), { resetsOn: null, shortRestRegain: null });
});

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? `\n       ${entry.detail}` : ''}`);
}
const failed = checks.filter((entry) => !entry.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed > 0 ? 1 : 0);
