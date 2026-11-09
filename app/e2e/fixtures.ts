// Seeds the character cache directly. Walking the builder for every spec would test the builder,
// and the cache is the app's own persisted shape — `dnd-character-storage`, zustand's envelope.
import type { Page } from '@playwright/test';

export const DRUID_2024 = 'basic-rules-2024-druid';
export const DRUID_2014 = 'basic-rules-2014-druid';

export interface SeedCharacter {
  id: string;
  name: string;
  speciesId: string;
  classId: string;
  level: number;
  wildShape?: { knownFormIds?: string[]; activeFormId?: string };
}

/** The document shape the sheet reads. Only the fields a spec needs are set; the rest derive. */
function toDocument(seed: SeedCharacter) {
  return {
    id: seed.id,
    name: seed.name,
    speciesId: seed.speciesId,
    backgroundId: '',
    classes: [{ classId: seed.classId, level: seed.level, hitDiceUsed: 0 }],
    abilityScores: {
      strength: 10, dexterity: 14, constitution: 14, intelligence: 12, wisdom: 17, charisma: 10
    },
    hp: { current: 20, maximum: 20, temporary: 0 },
    features: [],
    feats: [],
    spells: [],
    equipment: [],
    proficiencies: { skills: [], saves: [], tools: [], languages: [], armor: [], weapons: [] },
    currency: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...(seed.wildShape ? { wildShape: seed.wildShape } : {})
  };
}

/** Must run before the app's first paint, so it is an init script rather than an action. */
export async function seedCharacters(page: Page, seeds: readonly SeedCharacter[]): Promise<void> {
  const characters = seeds.map(toDocument);
  const syncMeta = Object.fromEntries(seeds.map((seed) => [seed.id, { version: null, dirty: true }]));

  await page.addInitScript(
    ({ payload }) => {
      window.localStorage.setItem('dnd-character-storage', JSON.stringify(payload));
    },
    {
      payload: {
        state: { characters, syncMeta, pendingDeletes: [], pendingSeats: {}, uploadPromptDismissedAt: null },
        version: 0
      }
    }
  );
}

/** The check `docs/rules/ui.md` names: wide content scrolls inside its own container, never the page. */
export async function pageScrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}
