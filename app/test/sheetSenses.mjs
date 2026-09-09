// What a feature's own text says this character can see with.
//
// This fails the way `spellScaling` fails: silently. A sense the parser misses is simply absent
// from the rail, and nothing errors — a `\b` that reached the source as a backspace character
// rather than a word boundary matched nothing at all, and the only symptom was an Elf with no
// Darkvision. Every string below is one a pack actually carries, in both printings' wording.
//
// The function is pure and imports only a type, so the source is stripped of types and imported
// directly rather than dragged in through Vite's alias graph.
//
// Run with `npm run test:senses` from the workspace root.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/lib/sheetCombat.ts', import.meta.url), 'utf8');
const sentences = source.slice(source.indexOf('const toSentences'));
const js = (sentences.slice(0, sentences.indexOf(';') + 1) + '\n' + source.slice(source.indexOf('const SENSE_NAMES')))
  .replaceAll(/^export /gm, '')
  .replaceAll(/^type SenseName[^;]*;$/gm, '')
  .replaceAll(/^interface [\s\S]*?^}$/gm, '')
  .replace(/const toSentences = \(text: string\) =>/, 'const toSentences = (text) =>')
  .replace(/\] as const;/, '];')
  .replace(/const feetIn = \(text: string\): number \| null => \{/, 'const feetIn = (text) => {')
  .replace(/function deriveSenses\(features: readonly Feature\[\]\): DerivedSense\[\] \{/, 'function deriveSenses(features) {')
  .replace(/new Map<SenseName, DerivedSense>\(\)/, 'new Map()')
  .replace(/\.filter\(\(entry\): entry is DerivedSense => Boolean\(entry\)\)/, '.filter((entry) => Boolean(entry))')
  .replace(/const titleCaseSense = \(sense: SenseName\) =>/, 'const titleCaseSense = (sense) =>')
  .replace(/const senseLabel = \(entry: DerivedSense\) =>/, 'const senseLabel = (entry) =>');

const { deriveSenses, senseLabel } = await import(
  'data:text/javascript,' + encodeURIComponent(`${js}\nexport { deriveSenses, senseLabel };`)
);

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log('ok   ' + name);
    passed += 1;
  } catch (error) {
    console.log('FAIL ' + name + ': ' + error.message);
    process.exitCode = 1;
  }
};

const feature = (name, description) => ({ id: name, name, description, level: 1, source: 'test' });

// 2014 titles the trait and states the range in its body; the word never appears in a sentence.
check('2014 Elf Darkvision', () => {
  const [sense] = deriveSenses([
    feature(
      'Darkvision',
      'Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. '
        + 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it '
        + 'were dim light. You can’t discern color in darkness, only shades of gray.'
    ),
  ]);
  assert.deepEqual(sense, { sense: 'darkvision', range: 60, source: 'Darkvision' });
});

// 2024 states it in one sentence instead.
check('2024 Dwarf Darkvision', () => {
  const [sense] = deriveSenses([feature('Darkvision', 'You have Darkvision with a range of 120 feet.')]);
  assert.equal(sense.range, 120);
});

check('the longer range wins', () => {
  const [sense] = deriveSenses([
    feature('Darkvision', 'You have Darkvision with a range of 60 feet.'),
    feature('Superior Darkvision', 'Your Darkvision has a range of 120 feet.'),
  ]);
  assert.equal(sense.range, 120);
  assert.equal(sense.source, 'Superior Darkvision');
});

check('a hyphenated range reads', () => {
  const [sense] = deriveSenses([feature('Blindsight', 'You have Blindsight with a 10-foot radius.')]);
  assert.deepEqual([sense.sense, sense.range], ['blindsight', 10]);
});

// A feature that names the spell rather than granting the sense states no range, so it grants none.
check('casting the Darkvision spell is not a sense', () => {
  assert.deepEqual(
    deriveSenses([
      feature(
        'Shadow Arts',
        'As an action, you can spend 2 ki points to cast Darkness, Darkvision, Pass without Trace, or Silence, '
          + 'without providing material components.'
      ),
    ]),
    []
  );
});

check('a sense stated without a range is not guessed at', () => {
  assert.deepEqual(deriveSenses([feature('Truesight', 'You gain Truesight.')]), []);
});

check('every sense the books name is read', () => {
  const senses = deriveSenses([
    feature('Darkvision', 'You have Darkvision with a range of 60 feet.'),
    feature('Echolocation', 'You have Blindsight with a range of 30 feet.'),
    feature('Stone Sense', 'You have Tremorsense with a range of 20 feet.'),
    feature('Pierce the Veil', 'You have Truesight with a range of 15 feet.'),
  ]);
  assert.deepEqual(senses.map((entry) => senseLabel(entry)), [
    'Darkvision',
    'Blindsight',
    'Tremorsense',
    'Truesight',
  ]);
});

console.log(`\nsenses OK: ${passed}/7 checks passed`);
