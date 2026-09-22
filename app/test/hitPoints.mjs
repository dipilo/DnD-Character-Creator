// What a character's classes and Constitution say their hit points are.
//
// The arithmetic failed silently once: a later class's first level was counted twice, so a
// Fighter 3 / Rogue 1 read 42 rather than 35 and nothing errored. `builderRules.ts` sits behind
// Vite's `@/` alias, so this loads it through Node's own type stripping with `aliasLoader.mjs`
// resolving the alias; a value import that reaches into React or the content packs fails the
// import, which is loud.
//
// Run with `npm run test:hit-points` from the workspace root.
import assert from 'node:assert/strict';

const { deriveCharacterHitPoints } = await import('@/lib/builderRules');

const classes = {
  fighter: { id: 'fighter', name: 'Fighter', hitDie: 10 },
  rogue: { id: 'rogue', name: 'Rogue', hitDie: 8 },
  wizard: { id: 'wizard', name: 'Wizard', hitDie: 6 },
  'basic-rules-2014-rogue': { id: 'rogue', name: 'Rogue', hitDie: 8 }
};
const getClassById = (id) => classes[id];
const derive = (entries, constitution, previousHp) =>
  deriveCharacterHitPoints({
    classes: entries.map(([classId, level]) => ({ classId, level, hitDiceUsed: 0 })),
    abilityScores: { constitution },
    previousHp,
    getClassById
  });

const cases = [
  ['a single class takes the full die once and the average after', [['fighter', 3]], 14, { current: 28, maximum: 28 }],
  ['a later class takes the average from its first level', [['fighter', 3], ['rogue', 1]], 14, { current: 35, maximum: 35 }],
  ['three classes still take one full die', [['fighter', 1], ['rogue', 1], ['wizard', 1]], 14, { current: 12 + 7 + 6, maximum: 25 }],
  ['the first entry is the one with the full die', [['wizard', 1], ['fighter', 1]], 10, { current: 6 + 6, maximum: 12 }],
  ['a level costs at least one hit point', [['wizard', 3]], 1, { current: 3, maximum: 3 }],
  ['a stale class id still resolves', [['basic-rules-2014-rogue', 2]], 12, { current: 9 + 6, maximum: 15 }],
  ['an entry at level 0 contributes nothing', [['fighter', 0]], 14, { current: 0, maximum: 0 }],
  ['an unresolvable class contributes nothing', [['bard', 5], ['fighter', 1]], 14, { current: 12, maximum: 12 }]
];

let passed = 0;
for (const [label, entries, constitution, expected] of cases) {
  const hp = derive(entries, constitution);
  assert.deepEqual({ current: hp.current, maximum: hp.maximum }, expected, label);
  passed += 1;
}

// A wounded character stays wounded by the same amount across a level change, in both directions.
const wounded = derive([['fighter', 3], ['rogue', 1]], 14, { current: 20, maximum: 28, temporary: 5 });
assert.deepEqual(wounded, { current: 27, maximum: 35, temporary: 5 }, 'adding a class keeps the wound');
passed += 1;
const lowered = derive([['fighter', 3]], 14, { current: 27, maximum: 35, temporary: 0 });
assert.deepEqual(lowered, { current: 20, maximum: 28, temporary: 0 }, 'lowering a level keeps the wound');
passed += 1;
const floored = derive([['fighter', 1]], 14, { current: 3, maximum: 35, temporary: 0 });
assert.equal(floored.current, 0, 'a wound deeper than the new maximum floors at 0');
passed += 1;
const first = derive([['fighter', 1]], 14, { current: 0, maximum: 0, temporary: 2 });
assert.deepEqual(first, { current: 12, maximum: 12, temporary: 2 }, 'a first level starts at full');
passed += 1;
const unwounded = derive([['fighter', 4]], 14, { current: 28, maximum: 28, temporary: 0 });
assert.equal(unwounded.current, 36, 'an unwounded character levels up at full');
passed += 1;

console.log(`hit points: ${passed}/${passed} passed`);
