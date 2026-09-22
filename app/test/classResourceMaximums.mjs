// What `resolveClassResources` says a pool's maximum is, and what sized it.
//
// A pool sized by an ability or the proficiency bonus resolves to a bare number, so the tracker
// used to read "3" with nothing on the sheet saying why — and a wrong `maximumSource` is silent in
// exactly the same way. `sheetPlayState.ts` sits behind Vite's `@/` alias and holds only type
// imports, so this loads it through Node's own type stripping with `aliasLoader.mjs`.
//
// Run with `npm run test:class-resources:maximums` from the workspace root.
import assert from 'node:assert/strict';

const { resolveClassResources } = await import('@/lib/sheetPlayState');

const level20 = (value) => Array.from({ length: 20 }, () => value);

const pool = (id, extra) => ({
  id,
  name: id,
  perLevel: level20(1),
  resetsOn: 'long',
  featureName: id,
  ...extra
});

const scaling = {
  abilityModifier: (ability) => ({ charisma: 3, wisdom: -1 }[ability] ?? 0),
  proficiencyBonus: 4
};

const resolve = (resources, { level = 5, subclassResources } = {}) =>
  resolveClassResources(
    {
      classes: [{ classId: 'bard', level, subclassId: subclassResources ? 'lore' : undefined }],
      classResourcesUsed: {},
      activeEffects: []
    },
    () => ({
      id: 'bard',
      name: 'Bard',
      features: [],
      resources,
      subclasses: [{ id: 'lore', name: 'Lore', features: [], resources: subclassResources }]
    }),
    scaling
  );

const one = (resources, options) => resolve(resources, options)[0];

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, detail: e.message.split('\n')[0] });
  }
}

check('a table column states its own maximum and names no source', () => {
  const out = one([pool('rages', { perLevel: level20(3) })]);
  assert.equal(out.maximum, 3);
  assert.equal(out.maximumSource, undefined);
});

check('"equal to your Charisma modifier" is the modifier, and says so', () => {
  const out = one([pool('bardic-inspiration', { usesFromAbility: { ability: 'charisma', bonus: 0, minimum: 0 } })]);
  assert.equal(out.maximum, 3);
  assert.equal(out.maximumSource, 'Charisma modifier');
});

check('"1 + your Charisma modifier" carries the bonus into both', () => {
  const out = one([pool('curse', { usesFromAbility: { ability: 'charisma', bonus: 1, minimum: 0 } })]);
  assert.equal(out.maximum, 4);
  assert.equal(out.maximumSource, '1 + Charisma modifier');
});

check('"a minimum of once" floors the number and is stated', () => {
  const out = one([pool('channel', { usesFromAbility: { ability: 'wisdom', bonus: 0, minimum: 1 } })]);
  assert.equal(out.maximum, 1);
  assert.equal(out.maximumSource, 'Wisdom modifier, minimum 1');
});

check('"equal to your proficiency bonus" reads the bonus', () => {
  const out = one([pool('wild-shape', { usesFromProficiencyBonus: true })]);
  assert.equal(out.maximum, 4);
  assert.equal(out.maximumSource, 'Proficiency bonus');
});

check('the book’s "Unlimited" is null and is sized by nothing', () => {
  const out = one([pool('rages', { perLevel: level20(null) })]);
  assert.equal(out.maximum, null);
  assert.equal(out.maximumSource, undefined);
});

check('a pool the level has not reached is no tracker at all', () => {
  const late = pool('channel', { perLevel: level20(2) });
  late.perLevel[4] = 0;
  assert.deepEqual(resolve([late]), []);
});

check('a subclass pool is resolved beside the class’s own', () => {
  const out = resolve([pool('rages')], { subclassResources: [pool('curse', { usesFromProficiencyBonus: true })] });
  assert.deepEqual(out.map((entry) => entry.key), ['bard::rages', 'bard::curse']);
  assert.equal(out[1].maximumSource, 'Proficiency bonus');
});

check('Font of Inspiration moves the rest without touching the maximum', () => {
  const out = one([pool('bardic-inspiration', {
    usesFromAbility: { ability: 'charisma', bonus: 0, minimum: 1 },
    shortRestFromLevel: 5
  })]);
  assert.equal(out.resetsOn, 'short');
  assert.equal(out.maximumSource, 'Charisma modifier, minimum 1');
});

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? `\n       ${entry.detail}` : ''}`);
}
const failed = checks.filter((entry) => !entry.ok).length;
console.log(`\nclass resource maximums: ${checks.length - failed}/${checks.length} passed`);
process.exit(failed > 0 ? 1 : 0);
