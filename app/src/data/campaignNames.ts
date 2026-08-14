/**
 * Word banks and templates for the campaign-name suggestion shown as placeholder text.
 *
 * This is flavour, not content: nothing here is book material, so it does not go through the
 * import pipeline. It stays a data table rather than a hardcoded string so the shape of a
 * suggestion can change without touching a component.
 */

const ADJECTIVES = [
  'Ashen', 'Bleeding', 'Broken', 'Buried', 'Burning', 'Crimson', 'Crooked', 'Dead',
  'Drowned', 'Eternal', 'Fallen', 'Forgotten', 'Frozen', 'Gilded', 'Grinning', 'Hollow',
  'Hungry', 'Iron', 'Jagged', 'Last', 'Laughing', 'Nameless', 'Obsidian', 'Pale',
  'Restless', 'Rotting', 'Ruined', 'Salted', 'Screaming', 'Shattered', 'Silent', 'Sleeping',
  'Starless', 'Sunken', 'Thirsting', 'Thorned', 'Unquiet', 'Veiled', 'Weeping', 'Whispering',
];

const NOUNS = [
  'Ascent', 'Bargain', 'Bell', 'Betrayal', 'Bloom', 'Cage', 'Choir', 'Crown',
  'Descent', 'Doctrine', 'Feast', 'Gate', 'Harvest', 'Hollow', 'Hunt', 'Key',
  'Lantern', 'Ledger', 'Machine', 'Mask', 'Menagerie', 'Mirror', 'Oath', 'Orphanage',
  'Pilgrimage', 'Procession', 'Reckoning', 'Requiem', 'Rite', 'Siege', 'Spire', 'Storm',
  'Tally', 'Throne', 'Tide', 'Vault', 'Vigil', 'Wake', 'Ward', 'Wound',
];

const PLACES = [
  'Ambervale', 'Ashfall', 'Blackmere', 'Bleakwater', 'Candlerock', 'Coldharbor', 'Dreadmoor',
  'Duskvale', 'Eastwatch', 'Fennhollow', 'Gallowsmere', 'Graymarch', 'Greyhollow', 'Hearthfall',
  'Ironrest', 'Lanternhill', 'Mournhold', 'Nettlewick', 'Ravensgate', 'Saltmarrow', 'Shadowfen',
  'Silverpine', 'Sorrowmoor', 'Stonewatch', 'Thornwick', 'Tidefall', 'Weatherstone', 'Winterhearth',
];

const FIGURES = [
  'the Ashen King', 'the Cartographer', 'the Drowned Queen', 'the Gravebound', 'the Hollow Saint',
  'the Lamplighter', 'the Nine', 'the Pale Duke', 'the Sleeping God', 'the Tallyman',
  'the Thousandth Child', 'the Unmade', 'the Widow of Ravensgate', 'the Witch of Thornwick',
];

const VERBS = [
  'Beneath', 'Beyond', 'Into', 'Under',
];

/** Each template names the banks it draws from, in the order its slots appear. */
const TEMPLATES: ReadonlyArray<{ banks: ReadonlyArray<readonly string[]>; render: (parts: string[]) => string }> = [
  { banks: [ADJECTIVES, NOUNS], render: ([a, n]) => `The ${a} ${n}` },
  { banks: [NOUNS, PLACES], render: ([n, p]) => `The ${n} of ${p}` },
  { banks: [ADJECTIVES, NOUNS, PLACES], render: ([a, n, p]) => `The ${a} ${n} of ${p}` },
  { banks: [NOUNS, FIGURES], render: ([n, f]) => `The ${n} of ${f}` },
  { banks: [PLACES], render: ([p]) => `Curse of ${p}` },
  { banks: [PLACES], render: ([p]) => `Ghosts of ${p}` },
  { banks: [ADJECTIVES, NOUNS], render: ([a, n]) => `${a} ${n}s` },
  { banks: [VERBS, PLACES], render: ([v, p]) => `${v} ${p}` },
  { banks: [NOUNS, ADJECTIVES, NOUNS], render: ([n, a, m]) => `The ${n} and the ${a} ${m}` },
  { banks: [FIGURES], render: ([f]) => `In the Shadow of ${f}` },
];

function pick<T>(bank: readonly T[]): T {
  return bank[Math.floor(Math.random() * bank.length)];
}

/**
 * A single suggested campaign name. Flavour only — never persisted, never sent to the server;
 * it exists so the "Start a campaign" field suggests something different on each visit.
 */
export function randomCampaignName(): string {
  const template = pick(TEMPLATES);
  return template.render(template.banks.map((bank) => pick(bank)));
}
