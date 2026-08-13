// D&D Beyond character JSON as a *seed* (MERGE_PLAN.md Phase 5).
//
// The scheduler stored a D&D Beyond blob on the campaign seat (`players.ddb_json`) and rendered it
// as the character sheet. Phase 5 replaces that with a real link to a builder character, which
// leaves the existing blobs needing a way out: this reads one and produces a *starting point* for
// the builder. It is deliberately not a converter — the blob is a different game object with its
// own ids, and pretending otherwise would silently invent content.
//
// So it fills in only what can be matched with confidence — name, ability scores, species, classes
// and background, by name against the runtime content — and reports everything it could not place,
// so the player finishes the job in the builder rather than trusting a half-built sheet.
import { getRuntimeBackgrounds, getRuntimeClasses, getRuntimeSpecies, getRuntimeSubclasses } from '@/data';
import type { AbilityScores, Character } from '@/types/dnd';

/** D&D Beyond's ability ids, in its own order. */
const DDB_ABILITY_IDS: [number, keyof AbilityScores][] = [
  [1, 'strength'],
  [2, 'dexterity'],
  [3, 'constitution'],
  [4, 'intelligence'],
  [5, 'wisdom'],
  [6, 'charisma'],
];

export interface DdbSeedResult {
  /** What the builder should start from. Always safe to spread over a fresh builder character. */
  seed: Partial<Character>;
  /** Human-readable notes: what matched, and what the player still has to choose. */
  matched: string[];
  unmatched: string[];
}

const normalise = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Find a content entry whose name matches. Exact first, then a containment match, because D&D
 * Beyond writes "Hill Dwarf" where the builder has "Dwarf" with a Hill variant — a near match is
 * worth offering, and the builder is where it gets confirmed either way.
 */
function matchByName<T extends { id: string; name: string }>(entries: T[], rawName: string): T | undefined {
  const wanted = normalise(rawName);
  if (!wanted) return undefined;
  const exact = entries.find((entry) => normalise(entry.name) === wanted);
  if (exact) return exact;
  return entries.find((entry) => {
    const candidate = normalise(entry.name);
    return candidate.length > 2 && (wanted.includes(candidate) || candidate.includes(wanted));
  });
}

/** The character object, whichever envelope the export used. */
function unwrapCharacter(parsed: unknown): Record<string, unknown> | null {
  const root = readRecord(parsed);
  if (!root) return null;
  return readRecord(root.character) ?? root;
}

function seedAbilityScores(character: Record<string, unknown>, result: DdbSeedResult): void {
  const stats = Array.isArray(character.stats) ? character.stats : [];
  const byId = new Map<number, number>();
  for (const stat of stats) {
    const row = readRecord(stat);
    const id = row ? readNumber(row.id) : null;
    const value = row ? readNumber(row.value) : null;
    if (id !== null && value !== null) byId.set(id, value);
  }

  const scores: Partial<AbilityScores> = {};
  for (const [id, ability] of DDB_ABILITY_IDS) {
    const value = byId.get(id) ?? readNumber(character[ability]);
    if (value !== null && value >= 1 && value <= 30) scores[ability] = value;
  }

  if (Object.keys(scores).length === 6) {
    result.seed.abilityScores = scores as AbilityScores;
    // The import states totals, not the roll or point-buy that produced them, so the builder is
    // told to treat them as entered by hand rather than re-deriving them from a method it cannot know.
    result.matched.push('Ability scores');
  } else {
    result.unmatched.push('Ability scores — the export did not carry all six');
  }
}

function seedSpecies(character: Record<string, unknown>, result: DdbSeedResult): void {
  const race = readRecord(character.race);
  const name = readString(race?.fullName) || readString(race?.baseName) || readString(race?.name);
  if (!name) {
    result.unmatched.push('Species — none named in the export');
    return;
  }
  const species = matchByName(getRuntimeSpecies(), name);
  if (species) {
    result.seed.speciesId = species.id;
    result.matched.push(`Species: ${species.name} (from "${name}")`);
  } else {
    result.unmatched.push(`Species "${name}" — no match in the loaded sources`);
  }
}

function seedClasses(character: Record<string, unknown>, result: DdbSeedResult): void {
  const entries = Array.isArray(character.classes) ? character.classes : [];
  const runtimeClasses = getRuntimeClasses();
  const classes: NonNullable<Character['classes']> = [];

  for (const entry of entries) {
    const row = readRecord(entry);
    if (!row) continue;
    const definition = readRecord(row.definition);
    const name = readString(definition?.name) || readString(row.name);
    const level = readNumber(row.level) ?? 1;
    const matchedClass = matchByName(runtimeClasses, name);
    if (!matchedClass) {
      result.unmatched.push(`Class "${name || 'unnamed'}" — no match in the loaded sources`);
      continue;
    }

    const subclassName = readString(readRecord(row.subclassDefinition)?.name);
    const subclass = subclassName
      ? matchByName(getRuntimeSubclasses().filter((entry) => entry.classId === matchedClass.id), subclassName)
      : undefined;
    if (subclassName && !subclass) {
      result.unmatched.push(`Subclass "${subclassName}" — no match under ${matchedClass.name}`);
    }

    classes.push({
      classId: matchedClass.id,
      level: Math.max(1, Math.min(20, Math.round(level))),
      subclassId: subclass?.id,
      // The export carries spent hit dice, but a seed is a character about to be built rather than
      // one mid-adventure — start it rested and let the player spend them again.
      hitDiceUsed: 0,
    });
    const subclassNote = subclass ? ` (${subclass.name})` : '';
    result.matched.push(`Class: ${matchedClass.name} ${level}${subclassNote}`);
  }

  if (classes.length > 0) result.seed.classes = classes;
  else result.unmatched.push('Classes — none could be matched');
}

function seedBackground(character: Record<string, unknown>, result: DdbSeedResult): void {
  const background = readRecord(character.background);
  const name = readString(readRecord(background?.definition)?.name) || readString(background?.name);
  if (!name) {
    result.unmatched.push('Background — none named in the export');
    return;
  }
  const matchedBackground = matchByName(getRuntimeBackgrounds(), name);
  if (matchedBackground) {
    result.seed.backgroundId = matchedBackground.id;
    result.matched.push(`Background: ${matchedBackground.name} (from "${name}")`);
  } else {
    result.unmatched.push(`Background "${name}" — no match in the loaded sources`);
  }
}

/**
 * Read a stored `players.ddb_json` blob. Returns null only when it is not JSON at all — a blob that
 * parses but matches nothing still comes back, with everything listed as unmatched, because "we
 * read it and none of it fits your sources" is a more useful answer than a silent failure.
 */
export function seedCharacterFromDdbJson(raw: string | null | undefined): DdbSeedResult | null {
  if (!raw?.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('players.ddb_json is not valid JSON', e instanceof Error ? e.message : e);
    return null;
  }

  const character = unwrapCharacter(parsed);
  if (!character) return null;

  const result: DdbSeedResult = { seed: {}, matched: [], unmatched: [] };

  const name = readString(character.name) || readString(character.characterName);
  if (name) {
    result.seed.name = name;
    result.matched.push(`Name: ${name}`);
  }

  seedAbilityScores(character, result);
  seedSpecies(character, result);
  seedClasses(character, result);
  seedBackground(character, result);

  return result;
}
