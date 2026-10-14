// How the picker folds 167 flat species into one card per base. Run with `npm run test:species-groups`.
import assert from 'node:assert/strict';

const { groupSpeciesByBase, parseSpeciesLineage, collectGroupSpeciesIds, findSpeciesGroup, lineagesBesideVariantsOf, findLineageNode } =
  await import('@/lib/speciesGroups');

const species = (name, overrides = {}) => ({
  id: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, ''),
  name,
  description: '',
  size: 'Medium',
  speed: 30,
  abilityScoreIncreases: [],
  features: [],
  languages: [],
  source: 'Book',
  ...overrides
});

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, detail: error.message.split('\n')[0] });
  }
}

check('a printed lineage is read off the name, and "Variant" is not one', () => {
  assert.deepEqual(parseSpeciesLineage('Half-Elf (Variant; Drow Descent)'), { base: 'Half-Elf', path: ['Drow Descent'] });
  assert.deepEqual(parseSpeciesLineage('Dragonborn (Chromatic; Black)'), { base: 'Dragonborn', path: ['Chromatic', 'Black'] });
  assert.deepEqual(parseSpeciesLineage('Gnome (Deep/Svirfneblin)'), { base: 'Gnome', path: ['Deep/Svirfneblin'] });
  assert.deepEqual(parseSpeciesLineage('Half-Elf'), { base: 'Half-Elf', path: [] });
});

check('a parenthetical that states nothing but "Variant" is part of the name', () => {
  assert.deepEqual(parseSpeciesLineage('Human (Variant)'), { base: 'Human (Variant)', path: [] });
});

check('the seven half-elf entries are one card', () => {
  const groups = groupSpeciesByBase([
    species('Half-Elf'),
    species('Half-Elf (Variant; Drow Descent)'),
    species('Half-Elf (Variant; Wood Elf Descent)'),
    species('Half-Elf (Mark of Storm)')
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, 'Half-Elf');
  assert.equal(groups[0].lineages.length, 3);
  assert.equal(groups[0].selectableCount, 4);
});

check('a lineage under a branch nests, and the branch is not counted twice', () => {
  const groups = groupSpeciesByBase([
    species('Dragonborn'),
    species('Dragonborn (Chromatic)'),
    species('Dragonborn (Chromatic; Black)'),
    species('Dragonborn (Chromatic; Blue)'),
    species('Dragonborn (Gem; Topaz)')
  ]);
  const [dragonborn] = groups;
  assert.deepEqual(dragonborn.lineages.map((node) => node.name), ['Chromatic', 'Gem']);
  const chromatic = dragonborn.lineages[0];
  assert.deepEqual(chromatic.children.map((node) => node.name), ['Black', 'Blue']);
  assert.equal(chromatic.species?.name, 'Dragonborn (Chromatic)');
  // The base and the three colors; the two branches are headings, not picks.
  assert.equal(dragonborn.selectableCount, 4);
});

check('a branch the book prints only as a heading carries no species of its own', () => {
  const groups = groupSpeciesByBase([species('Dragonborn (Gem; Topaz)')]);
  const gem = groups[0].lineages[0];
  assert.equal(gem.species, undefined);
  assert.equal(gem.children.length, 1);
  assert.equal(groups[0].selectableCount, 1);
});

check('a nested variant reads as a lineage of the entry that states it', () => {
  const groups = groupSpeciesByBase([
    species('Elf', { variants: [{ id: 'high', name: 'High Elf', description: '', features: [] }] }),
    species('Elf (Pallid)')
  ]);
  const [elf] = groups;
  assert.deepEqual(elf.lineages.map((node) => node.name), ['High Elf', 'Pallid']);
  assert.equal(elf.lineages[0].variant?.id, 'high');
  assert.equal(elf.lineages[0].owner?.name, 'Elf');
  assert.equal(elf.selectableCount, 3);
});

check('a species with no lineage is its own group of one', () => {
  const groups = groupSpeciesByBase([species('Aarakocra'), species('Tortle')]);
  assert.deepEqual(groups.map((group) => group.selectableCount), [1, 1]);
  assert.deepEqual(groups.map((group) => group.lineages.length), [0, 0]);
});

check('a group collects every id a selection could be stored under', () => {
  const groups = groupSpeciesByBase([
    species('Elf', { variants: [{ id: 'high', name: 'High Elf', description: '', features: [] }] }),
    species('Elf (Pallid)')
  ]);
  assert.deepEqual(collectGroupSpeciesIds(groups[0]).sort(), ['elf', 'elf-pallid']);
});

check('a lineage finds its own group from its printed name', () => {
  const entries = [species('Tiefling'), species('Tiefling (Zariel)')];
  const groups = groupSpeciesByBase(entries);
  assert.equal(findSpeciesGroup(groups, entries[1])?.name, 'Tiefling');
});

check('a nested variant loses to a later book printing the same lineage on its own', () => {
  const groups = groupSpeciesByBase([
    species('Elf', { variants: [{ id: 'eladrin', name: 'Eladrin', description: 'nested', features: [] }] }),
    species('Elf (Eladrin)')
  ]);
  const [eladrin] = groups[0].lineages;
  assert.equal(eladrin.species?.name, 'Elf (Eladrin)');
  assert.equal(eladrin.variant, undefined);
  assert.equal(groups[0].selectableCount, 2);
});

check('the details page lists the siblings, not the entry own variants', () => {
  const elf = species('Elf', { variants: [{ id: 'high', name: 'High Elf', description: '', features: [] }] });
  const groups = groupSpeciesByBase([elf, species('Elf (Pallid)')]);
  const beside = lineagesBesideVariantsOf(groups[0].lineages, elf.id);
  assert.deepEqual(beside.map((node) => node.name), ['Pallid']);
});

check('a branch is found by the path its own name states', () => {
  const groups = groupSpeciesByBase([species('Dragonborn (Gem)'), species('Dragonborn (Gem; Topaz)')]);
  assert.equal(findLineageNode(groups[0].lineages, ['Gem'])?.children.length, 1);
  assert.equal(findLineageNode(groups[0].lineages, ['Gem', 'Topaz'])?.children.length, 0);
  assert.equal(findLineageNode(groups[0].lineages, ['Metallic']), undefined);
});

const failed = checks.filter((entry) => !entry.ok);
checks.forEach((entry) => console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`));
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length > 0) process.exitCode = 1;
