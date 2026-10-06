// What `deriveExpertiseGrants` reads out of a feature's own sentences.
//
// Every input below is a feature's text as one of the packs carries it. Three of them double the
// proficiency bonus without granting Expertise, and reading those as a pick would put two choices
// on the sheet that no printing offers — which is silent, because nothing errors.
//
// Run with `npm run test:expertise` from the workspace root.
import assert from 'node:assert/strict';

const { deriveExpertiseGrants, isConditionalDoubling } = await import('@/lib/expertise');

const read = (description, overrides = {}) =>
  deriveExpertiseGrants({ id: 'f', name: 'Expertise', description, level: 1, ...overrides });

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, detail: e.message.split('\n')[0] });
  }
}

/* -------------------------------------------------------------------------- *
 * Doubling that is not Expertise
 * -------------------------------------------------------------------------- */

check('the 2014 Ranger\'s favoured terrain is not Expertise', () => {
  assert.deepEqual(
    read(
      'You are particularly familiar with one type of natural environment. Choose one type of ' +
        'favored terrain: arctic, coast, desert, forest, grassland, mountain, swamp, or the ' +
        'Underdark. When you make an Intelligence or Wisdom check related to your favored ' +
        'terrain, your proficiency bonus is doubled if you are using a skill that you’re ' +
        'proficient in.',
      { name: 'Natural Explorer' }
    ),
    []
  );
});

check('Draconic Ancestry doubles the bonus only with dragons', () => {
  assert.deepEqual(
    read(
      'You can speak, read, and write Draconic. Additionally, whenever you make a Charisma check ' +
        'when interacting with dragons, your proficiency bonus is doubled if it applies to the check.',
      { name: 'Draconic Ancestry' }
    ),
    []
  );
});

check('Stonecunning doubles the bonus only on stonework', () => {
  assert.deepEqual(
    read(
      'Whenever you make an Intelligence (History) check related to the origin of stonework, you ' +
        'are considered proficient in the History skill and add double your proficiency bonus to ' +
        'the check, instead of your normal proficiency bonus.',
      { name: 'Stonecunning' }
    ),
    []
  );
});

check('a feature that says nothing about Expertise grants none', () => {
  assert.deepEqual(read('You regain all expended uses on a short rest.', { name: 'Font of Inspiration' }), []);
});

/* -------------------------------------------------------------------------- *
 * The open choice, in both printings
 * -------------------------------------------------------------------------- */

check('the 2014 Bard states two grants, at 3rd and 10th level', () => {
  const grants = read(
    'At 3rd level, choose two of your skill proficiencies. Your proficiency bonus is doubled for ' +
      'any ability check you make that uses either of the chosen proficiencies. At 10th level, ' +
      'you can choose another two skill proficiencies to gain this benefit.',
    { level: 3 }
  );
  assert.equal(grants.length, 2);
  assert.deepEqual(grants.map((g) => [g.level, g.count]), [[3, 2], [10, 2]]);
  assert.equal(grants.every((g) => !g.allowsTools), true);
});

check('the 2024 Bard states the same two grants in the glossary wording', () => {
  const grants = read(
    'You gain Expertise (see the rules glossary) in two of your skill proficiencies of your ' +
      'choice. Performance and Persuasion are recommended if you have proficiency in them. At ' +
      'Bard level 9, you gain Expertise in two more of your skill proficiencies of your choice.',
    { level: 2 }
  );
  assert.deepEqual(grants.map((g) => [g.level, g.count]), [[2, 2], [9, 2]]);
});

check('the 2014 Rogue may spend a pick on thieves’ tools', () => {
  const grants = read(
    'At 1st level, choose two of your skill proficiencies, or one of your skill proficiencies and ' +
      'your proficiency with thieves’ tools. Your proficiency bonus is doubled for any ability ' +
      'check you make that uses either of the chosen proficiencies. At 6th level, you can choose ' +
      'two more of your proficiencies (in skills or with thieves’ tools) to gain this benefit.'
  );
  assert.deepEqual(grants.map((g) => [g.level, g.count]), [[1, 2], [6, 2]]);
  assert.equal(grants[0].allowsTools, true);
});

check('the 2024 Rogue states its second grant at Rogue level 6', () => {
  const grants = read(
    'You gain Expertise in two of your skill proficiencies of your choice. Sleight of Hand and ' +
      'Stealth are recommended if you have proficiency in them. At Rogue level 6, you gain ' +
      'Expertise in two more of your skill proficiencies of your choice.'
  );
  assert.deepEqual(grants.map((g) => [g.level, g.count]), [[1, 2], [6, 2]]);
});

check('the 2024 Ranger\'s Deft Explorer grants one', () => {
  const grants = read(
    'Thanks to your travels, you gain the following benefits. Expertise. Choose one of your ' +
      'skill proficiencies with which you lack Expertise. You gain Expertise in that skill. ' +
      'Languages. You know two languages of your choice from the language tables.',
    { name: 'Deft Explorer', level: 2 }
  );
  assert.deepEqual(grants.map((g) => [g.level, g.count]), [[2, 1]]);
});

check('the 2024 Ranger\'s own Expertise grants two at the level it is gained', () => {
  const grants = read(
    'Choose two of your skill proficiencies with which you lack Expertise. You gain Expertise in ' +
      'those skills.',
    { level: 9 }
  );
  assert.deepEqual(grants.map((g) => [g.level, g.count]), [[9, 2]]);
});

/* -------------------------------------------------------------------------- *
 * A choice from a list, and skills named outright
 * -------------------------------------------------------------------------- */

check('the 2024 Wizard\'s Scholar chooses from the list it prints', () => {
  const grants = read(
    'While studying magic, you also specialized in another field of study. Choose one of the ' +
      'following skills in which you have proficiency: Arcana, History, Investigation, Medicine, ' +
      'Nature, or Religion. You have Expertise in the chosen skill.',
    { name: 'Scholar', level: 2 }
  );
  assert.equal(grants.length, 1);
  assert.equal(grants[0].count, 1);
  assert.deepEqual(grants[0].optionSkills, [
    'Arcana',
    'History',
    'Investigation',
    'Medicine',
    'Nature',
    'Religion'
  ]);
});

check('the Scout\'s Survivalist names its two skills outright', () => {
  const grants = read(
    'When you choose this archetype at 3rd level, you gain proficiency in the Nature and Survival ' +
      'skills if you don’t already have it. Your proficiency bonus is doubled for any ability ' +
      'check you make that uses either of those proficiencies.',
    { name: 'Survivalist', level: 3 }
  );
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0].fixed, ['Nature', 'Survival']);
  assert.equal(grants[0].count, 2);
});

check('the Artificer\'s Tool Expertise names no skill, so it offers no skill pick', () => {
  assert.deepEqual(
    read(
      'Your proficiency bonus is now doubled for any ability check you make that uses your ' +
        'proficiency with a tool.',
      { name: 'Tool Expertise', level: 6 }
    ),
    []
  );
});

/* -------------------------------------------------------------------------- *
 * The condition test on its own
 * -------------------------------------------------------------------------- */

check('isConditionalDoubling reads the limiting clause, not the doubling', () => {
  assert.equal(isConditionalDoubling('Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.'), false);
  assert.equal(isConditionalDoubling('Whenever you make a Charisma check when interacting with dragons, your proficiency bonus is doubled if it applies to the check.'), true);
});

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? `\n       ${entry.detail}` : ''}`);
}
const failed = checks.filter((entry) => !entry.ok).length;
console.log(`\nexpertise: ${checks.length - failed}/${checks.length} passed`);
process.exit(failed > 0 ? 1 : 0);
