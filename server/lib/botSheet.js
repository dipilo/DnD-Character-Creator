// The derived sheet the Discord bot rolls from: to-hit and damage per equipped weapon, spell save
// DC and attack bonus per casting class, and each known spell's attack-or-save line and dice at
// this character's level. Nothing here is a second copy of the sheet's maths — the functions are
// the app's own (`app/src/lib/sheetMath.ts`, `spellFacets.ts`), loaded through Node's type
// stripping, which is why those two files may import only types. The bot deliberately does not
// reimplement any of it.
//
// Records resolve against every pack under imports/, not just the two the content routes serve:
// only derived numbers leave here, never the record, so a Tasha's weapon still gets its row.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_LIB = path.join(__dirname, '..', '..', 'app', 'src', 'lib');
const IMPORTS_DIR = path.join(__dirname, '..', '..', 'imports');
const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

let mathsPromise = null;
let index = null;

/** Loaded once and cached, failure included: a Node without type stripping fails every call the same way. */
function loadMaths() {
  if (!mathsPromise) {
    mathsPromise = Promise.all([
      import(pathToFileURL(path.join(APP_LIB, 'sheetMath.ts')).href),
      import(pathToFileURL(path.join(APP_LIB, 'spellFacets.ts')).href),
    ]).then(([sheetMath, spellFacets]) => ({ ...sheetMath, ...spellFacets }));
  }
  return mathsPromise;
}

const normalise = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Same fallback the app's `resolveClassById` uses: a stored `rogue` or `phb-2024-rogue` still finds the class.
const CLASS_PREFIX = /^(basic rules|player s handbook|phb)\s+(2014|2024)\s+/;
const classKey = (value) => normalise(value).replace(CLASS_PREFIX, '');
const editionOf = (value) => (/(2014|2024)/.exec(String(value ?? '')) || [])[1] ?? '';

function loadIndex() {
  if (index) return index;
  const built = { equipment: new Map(), spells: new Map(), classes: new Map(), subclasses: new Map(), classList: [] };
  const files = fs.readdirSync(IMPORTS_DIR).filter((name) => name.endsWith('.canonical.json')).sort();
  for (const file of files) {
    let content;
    try {
      content = JSON.parse(fs.readFileSync(path.join(IMPORTS_DIR, file), 'utf8'))?.content ?? {};
    } catch (e) {
      console.warn(`bot sheet: could not read ${file}:`, e?.message);
      continue;
    }
    for (const [key, map] of [['equipment', built.equipment], ['spells', built.spells], ['classes', built.classes], ['subclasses', built.subclasses]]) {
      for (const entry of Array.isArray(content[key]) ? content[key] : []) {
        if (entry && typeof entry.id === 'string' && !map.has(entry.id)) map.set(entry.id, entry);
      }
    }
  }
  built.classList = [...built.classes.values()];
  index = built;
  return index;
}

function resolveClass(id) {
  const { classes, classList } = loadIndex();
  const exact = classes.get(id);
  if (exact) return exact;
  const key = classKey(id);
  const edition = editionOf(id);
  return classList.find((cls) => classKey(cls.name || cls.id) === key && (!edition || editionOf(cls.sourceId) === edition))
    ?? classList.find((cls) => classKey(cls.name || cls.id) === key);
}

function resolveSubclass(id) {
  if (typeof id !== 'string' || !id) return undefined;
  const { subclasses } = loadIndex();
  const exact = subclasses.get(id);
  if (exact) return exact;
  const key = normalise(id);
  for (const entry of subclasses.values()) {
    if (normalise(entry.id) === key || normalise(entry.name) === key) return entry;
  }
  return undefined;
}

/** An equipment record by id, else by exact name, else by the one name that starts with the query. */
function findEquipment(query) {
  const { equipment } = loadIndex();
  const raw = String(query ?? '').trim();
  if (!raw) return undefined;
  const exact = equipment.get(raw);
  if (exact) return exact;
  const key = normalise(raw);
  let named;
  const prefixed = [];
  for (const entry of equipment.values()) {
    const name = normalise(entry.name);
    if (name === key) { named = named ?? entry; continue; }
    if (name.startsWith(key)) prefixed.push(entry);
  }
  if (named) return named;
  return prefixed.length === 1 ? prefixed[0] : undefined;
}

function abilityScores(doc) {
  const base = doc.abilityScores ?? {};
  const bonus = doc.abilityScoreBonuses ?? {};
  return Object.fromEntries(ABILITIES.map((ability) => [ability, Number(base[ability] ?? 10) + Number(bonus[ability] ?? 0)]));
}

/** Every spell id the document names, wherever it names it; prepared wins when it is listed twice. */
function spellSelections(doc) {
  const out = new Map();
  const note = (id, prepared) => {
    if (typeof id !== 'string' || !id) return;
    out.set(id, Boolean(out.get(id)) || prepared);
  };
  for (const entry of Array.isArray(doc.spells) ? doc.spells : []) note(entry?.spellId, Boolean(entry?.prepared || entry?.alwaysPrepared));
  for (const cls of Array.isArray(doc.classes) ? doc.classes : []) {
    for (const id of cls?.spellsKnown ?? []) note(id, false);
    for (const id of cls?.preparedSpells ?? []) note(id, true);
  }
  for (const ids of Object.values(doc.featSpellSelections ?? {})) for (const id of ids ?? []) note(id, true);
  return out;
}

/** The casting class a spell rolls with: the one whose list names it, else the first caster. */
function castingStatFor(spell, stats, classesByName) {
  const named = (spell.classes ?? []).map((name) => normalise(name));
  return stats.find((entry) => named.includes(normalise(entry.className)))
    ?? stats.find((entry) => classesByName.has(normalise(entry.className)))
    ?? stats[0] ?? null;
}

async function deriveSheet(doc) {
  const maths = await loadMaths();
  const { equipment, spells } = loadIndex();
  const scores = abilityScores(doc);
  const level = Math.max(1, (Array.isArray(doc.classes) ? doc.classes : []).reduce((sum, cls) => sum + Number(cls?.level ?? 0), 0));
  const proficiencyBonus = maths.getCharacterProficiencyBonus(level);

  const resolvedClasses = (Array.isArray(doc.classes) ? doc.classes : [])
    .map((entry) => ({ entry: { level: Number(entry?.level ?? 0) }, cls: resolveClass(String(entry?.classId ?? '')) }))
    .filter((pair) => pair.cls);
  const spellcasting = maths.deriveSpellcastingStats(scores, proficiencyBonus, resolvedClasses);
  const classesByName = new Set(resolvedClasses.map((pair) => normalise(pair.cls.name)));

  const weapons = (Array.isArray(doc.equipment) ? doc.equipment : []).map((entry) => {
    const item = equipment.get(String(entry?.equipmentId ?? ''));
    return { name: item?.name ?? '', equipped: Boolean(entry?.equipped), item };
  });
  const attacks = [
    maths.deriveUnarmedStrike(scores, proficiencyBonus),
    ...maths.deriveAttacks({
      equipment: weapons,
      abilityScores: scores,
      proficiencyBonus,
      weaponProficiencies: (doc.proficiencies?.weapons ?? []).map(String),
    }),
  ];

  const knownSpells = [];
  for (const [id, prepared] of spellSelections(doc)) {
    const spell = spells.get(id);
    if (!spell) continue;
    const stat = castingStatFor(spell, spellcasting, classesByName);
    const scaling = maths.deriveSpellScaling(spell);
    const diceBySlot = {};
    if (spell.level > 0 && scaling.upcast) {
      for (let slot = spell.level; slot <= 9; slot += 1) {
        diceBySlot[slot] = maths.deriveSpellDice(spell, { characterLevel: level, slotLevel: slot }) ?? null;
      }
    }
    knownSpells.push({
      id: spell.id,
      name: spell.name,
      level: Number(spell.level ?? 0),
      school: spell.school ?? null,
      castingTime: spell.castingTime ?? null,
      range: spell.range ?? null,
      concentration: Boolean(spell.concentration),
      ritual: Boolean(spell.ritual),
      prepared,
      attackOrSave: maths.deriveSpellAttackOrSave(spell),
      damageOrEffect: maths.deriveSpellDamageOrEffect(spell),
      dice: maths.deriveSpellDice(spell, { characterLevel: level }) ?? null,
      diceBySlot,
      castingClass: stat?.className ?? null,
      saveDc: stat?.saveDc ?? null,
      attackBonus: stat?.attackBonus ?? null,
    });
  }
  knownSpells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return {
    level,
    proficiencyBonus,
    abilityScores: scores,
    abilityModifiers: Object.fromEntries(ABILITIES.map((ability) => [ability, maths.abilityModifier(scores[ability])])),
    spellcasting,
    attacks,
    spells: knownSpells,
  };
}

module.exports = { deriveSheet, loadMaths, loadIndex, resolveClass, resolveSubclass, findEquipment };
