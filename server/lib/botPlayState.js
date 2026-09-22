// The play state the Discord bot reads and writes: hit points, death saves, slots, hit dice,
// conditions, class resources, the purse and the pack. The rules are the app's own —
// `app/src/lib/sheetPlayState.ts` decides what damage does to temporary hit points and what a
// long rest gives back, `spellSlots.ts` says how many slots a multiclass caster has — loaded the
// way `botSheet.js` loads the sheet maths, so both files may hold only `type` imports. Every
// action here is one of those functions applied to the stored document; nothing is re-derived.
//
// `ACTIONS` is the whole write surface: one shared key reaches the bot routes, so the allowlist is
// this table, and an action it does not name is 400 rather than a document write.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { abilityScores, loadIndex, loadMaths, resolveClass, resolveSubclass, findEquipment } = require('./botSheet');

const APP_LIB = path.join(__dirname, '..', '..', 'app', 'src', 'lib');
const COIN_UNITS = ['cp', 'sp', 'ep', 'gp', 'pp'];
// Copper per coin, the way both printings state the exchange.
const COIN_IN_COPPER = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const MAX_QUANTITY = 9999;

let mathsPromise = null;

function loadPlayMaths() {
  if (!mathsPromise) {
    mathsPromise = Promise.all([
      import(pathToFileURL(path.join(APP_LIB, 'sheetPlayState.ts')).href),
      import(pathToFileURL(path.join(APP_LIB, 'spellSlots.ts')).href),
      loadMaths(),
    ]).then(([playState, spellSlots, sheetMath]) => ({ ...playState, ...spellSlots, ...sheetMath }));
  }
  return mathsPromise;
}

const toInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};

/** The document with every play field the maths reads present, so a sheet saved before a field existed still works. */
function withDefaults(doc) {
  const hp = doc.hp && typeof doc.hp === 'object' ? doc.hp : {};
  return {
    ...doc,
    classes: Array.isArray(doc.classes) ? doc.classes : [],
    equipment: Array.isArray(doc.equipment) ? doc.equipment : [],
    hp: {
      current: toInt(hp.current) || 0,
      maximum: Math.max(0, toInt(hp.maximum) || 0),
      temporary: Math.max(0, toInt(hp.temporary) || 0),
    },
  };
}

function classEntries(doc) {
  return doc.classes
    .map((entry) => ({
      entry,
      cls: resolveClass(String(entry?.classId ?? '')),
      subclass: resolveSubclass(entry?.subclassId),
      level: Math.max(0, toInt(entry?.level) || 0),
    }))
    .filter((pair) => pair.cls);
}

function slotTotals(maths, doc) {
  return maths.deriveSlotTotals(classEntries(doc).map(({ cls, subclass, level }) => ({ cls, subclass, level })));
}

// A pool sized by an ability or the proficiency bonus reads the same scores the sheet route does.
function classResources(maths, doc) {
  const scores = abilityScores(doc);
  const totalLevel = classEntries(doc).reduce((sum, { level }) => sum + level, 0) || 1;
  return maths.resolveClassResources(doc, (id) => resolveClass(id), {
    abilityModifier: (ability) => maths.abilityModifier(scores[ability]),
    proficiencyBonus: maths.getCharacterProficiencyBonus(totalLevel),
  }, (id) => resolveSubclass(id));
}

const slotRows = (totals, used) => totals
  .map((total, index) => ({ level: index + 1, total, used: Math.min(total, Math.max(0, toInt(used?.[index]) || 0)) }))
  .filter((row) => row.total > 0);

async function playState(rawDoc) {
  const maths = await loadPlayMaths();
  const doc = withDefaults(rawDoc ?? {});
  const { equipment } = loadIndex();
  const totals = slotTotals(maths, doc);
  const saves = maths.getDeathSaves(doc);
  return {
    hp: { ...doc.hp },
    deathSaves: { successes: saves.successes, failures: saves.failures },
    dying: maths.isDying(doc),
    conditions: Array.isArray(doc.conditions) ? doc.conditions.map(String) : [],
    exhaustion: Math.max(0, toInt(doc.exhaustion) || 0),
    inspiration: Boolean(doc.inspiration),
    concentration: doc.concentration && typeof doc.concentration === 'object'
      ? { spellId: String(doc.concentration.spellId ?? ''), spellName: String(doc.concentration.spellName ?? ''), slotLevel: toInt(doc.concentration.slotLevel) || 0 }
      : null,
    slots: slotRows(totals.slotsByLevel, doc.spellSlotsUsed),
    pactSlots: slotRows(totals.pactSlotsByLevel, doc.pactSlotsUsed),
    hitDice: classEntries(doc).map(({ entry, cls, level }) => ({
      classId: String(entry.classId),
      className: cls.name,
      die: cls.hitDie ?? null,
      total: level,
      used: Math.min(level, Math.max(0, toInt(entry.hitDiceUsed) || 0)),
    })),
    resources: classResources(maths, doc).map((resource) => ({
      key: resource.key,
      name: resource.name,
      className: resource.className,
      maximum: resource.maximum,
      maximumSource: resource.maximumSource ?? null,
      used: resource.used,
      active: resource.active,
      activatable: resource.activatable,
      resetsOn: resource.resetsOn ?? null,
    })),
    currency: Object.fromEntries(COIN_UNITS.map((unit) => [unit, maths.getCoins(doc, unit)])),
    purseCopper: COIN_UNITS.reduce((sum, unit) => sum + maths.getCoins(doc, unit) * COIN_IN_COPPER[unit], 0),
    equipment: doc.equipment.map((entry) => ({
      equipmentId: String(entry?.equipmentId ?? ''),
      name: equipment.get(String(entry?.equipmentId ?? ''))?.name ?? String(entry?.equipmentId ?? ''),
      quantity: Math.max(0, toInt(entry?.quantity) || 0),
      equipped: Boolean(entry?.equipped),
    })),
  };
}

const fail = (error, detail) => ({ error, ...(detail ? { detail } : {}) });

function amountOf(args, key = 'amount') {
  const n = toInt(args[key]);
  return Number.isNaN(n) || n < 0 ? null : n;
}

/** Which slot a spend or restore lands on; `pact: true` picks the Warlock's pool. */
function slotTarget(maths, doc, args) {
  const level = toInt(args.level);
  if (Number.isNaN(level) || level < 1 || level > 9) return fail('bad_slot_level');
  const totals = slotTotals(maths, doc);
  const pact = Boolean(args.pact);
  const total = (pact ? totals.pactSlotsByLevel : totals.slotsByLevel)[level - 1] ?? 0;
  if (total <= 0) return fail('no_such_slot', `no level ${level}${pact ? ' pact' : ''} slots`);
  const used = maths.getSlotsUsed(pact ? doc.pactSlotsUsed : doc.spellSlotsUsed, level);
  return { level, pact, total, used };
}

function findResource(maths, doc, key) {
  const wanted = String(key ?? '').trim().toLowerCase();
  const all = classResources(maths, doc);
  return all.find((resource) => resource.key.toLowerCase() === wanted)
    ?? all.find((resource) => String(resource.name).toLowerCase() === wanted)
    ?? all.find((resource) => String(resource.name).toLowerCase().startsWith(wanted));
}

function findClassEntry(doc, classId) {
  const wanted = String(classId ?? '').trim().toLowerCase();
  const entries = classEntries(doc);
  if (!wanted) return entries.length === 1 ? entries[0] : undefined;
  return entries.find(({ entry }) => String(entry.classId).toLowerCase() === wanted)
    ?? entries.find(({ cls }) => String(cls.name).toLowerCase() === wanted)
    ?? entries.find(({ cls }) => String(cls.name).toLowerCase().startsWith(wanted));
}

/** The stored equipment line an item action names: by id, then by the record's name. */
function findEquipmentLine(doc, query) {
  const raw = String(query ?? '').trim();
  const { equipment } = loadIndex();
  const key = raw.toLowerCase();
  const byId = doc.equipment.findIndex((entry) => String(entry?.equipmentId ?? '').toLowerCase() === key);
  if (byId >= 0) return byId;
  return doc.equipment.findIndex((entry) => String(equipment.get(String(entry?.equipmentId ?? ''))?.name ?? '').toLowerCase() === key);
}

const ACTIONS = {
  damage: (m, doc, args) => {
    const amount = amountOf(args);
    return amount === null ? fail('bad_amount') : m.applyDamage(doc, amount);
  },
  heal: (m, doc, args) => {
    const amount = amountOf(args);
    return amount === null ? fail('bad_amount') : m.applyHealing(doc, amount);
  },
  hp_set: (m, doc, args) => {
    const value = amountOf(args, 'value');
    if (value === null) return fail('bad_amount');
    const current = Math.min(doc.hp.maximum, value);
    const patch = { hp: { ...doc.hp, current } };
    if (current > 0 && doc.hp.current <= 0) patch.deathSaves = { successes: 0, failures: 0 };
    return patch;
  },
  temp_hp: (m, doc, args) => {
    const value = amountOf(args, 'value');
    return value === null ? fail('bad_amount') : m.setTemporaryHitPoints(doc, value);
  },
  death_save: (m, doc, args) => {
    if (args.roll !== undefined) {
      const roll = toInt(args.roll);
      if (Number.isNaN(roll) || roll < 1 || roll > 20) return fail('bad_roll');
      return m.applyDeathSaveRoll(doc, roll);
    }
    let patch = {};
    for (const kind of ['successes', 'failures']) {
      if (args[kind] === undefined) continue;
      const count = toInt(args[kind]);
      if (Number.isNaN(count)) return fail('bad_amount');
      patch = { ...patch, ...m.setDeathSave({ ...doc, ...patch }, kind, count) };
    }
    return patch;
  },
  slot: (m, doc, args) => {
    const target = slotTarget(m, doc, args);
    if (target.error) return target;
    let used;
    if (args.used !== undefined) used = toInt(args.used);
    else {
      const delta = toInt(args.delta ?? 1);
      used = target.used + delta;
      if (delta > 0 && target.used + delta > target.total) return fail('no_slot_left', `all ${target.total} level ${target.level} slots are spent`);
    }
    if (Number.isNaN(used)) return fail('bad_amount');
    return target.pact
      ? m.setPactSlotsUsed(doc, target.level, used, target.total)
      : m.setSpellSlotsUsed(doc, target.level, used, target.total);
  },
  condition: (m, doc, args) => {
    const wanted = String(args.name ?? '').trim().toLowerCase();
    const name = m.CONDITION_NAMES.find((entry) => entry.toLowerCase() === wanted)
      ?? m.CONDITION_NAMES.find((entry) => entry.toLowerCase().startsWith(wanted));
    if (!wanted || !name) return fail('unknown_condition', `one of ${m.CONDITION_NAMES.join(', ')}`);
    const has = (doc.conditions ?? []).includes(name);
    const set = args.set === undefined ? !has : Boolean(args.set);
    return set === has ? {} : m.toggleCondition(doc, name);
  },
  conditions_clear: () => ({ conditions: [] }),
  exhaustion: (m, doc, args) => {
    const level = toInt(args.level);
    return Number.isNaN(level) ? fail('bad_amount') : m.setExhaustion(level);
  },
  inspiration: (m, doc, args) => ({ inspiration: args.value === undefined ? !doc.inspiration : Boolean(args.value) }),
  concentration_end: (m) => m.endConcentration(),
  hit_dice: (m, doc, args) => {
    const target = findClassEntry(doc, args.classId);
    if (!target) return fail('unknown_class');
    const delta = toInt(args.delta ?? 1);
    if (Number.isNaN(delta)) return fail('bad_amount');
    const used = Math.max(0, toInt(target.entry.hitDiceUsed) || 0);
    if (delta > 0 && used + delta > target.level) return fail('no_hit_dice_left', `${target.level - used} of ${target.level} left`);
    return m.adjustHitDice(doc, target.entry.classId, delta);
  },
  rest: (m, doc, args) => {
    const kind = String(args.kind ?? 'long').toLowerCase();
    if (kind === 'short') return m.applyShortRest(doc, classResources(m, doc));
    if (kind === 'long') return m.applyLongRest(doc, classResources(m, doc));
    return fail('bad_rest');
  },
  coins: (m, doc, args) => {
    const unit = String(args.unit ?? 'gp').toLowerCase();
    if (!COIN_UNITS.includes(unit)) return fail('bad_coin', `one of ${COIN_UNITS.join(', ')}`);
    const have = m.getCoins(doc, unit);
    let value;
    if (args.value !== undefined) value = toInt(args.value);
    else {
      const delta = toInt(args.delta);
      if (Number.isNaN(delta)) return fail('bad_amount');
      if (have + delta < 0) return fail('not_enough_coins', `${have} ${unit} on hand`);
      value = have + delta;
    }
    if (Number.isNaN(value) || value < 0) return fail('bad_amount');
    return m.setCoins(doc, unit, value);
  },
  item: (m, doc, args) => {
    let index = findEquipmentLine(doc, args.item);
    let equipmentId = index >= 0 ? String(doc.equipment[index].equipmentId) : null;
    if (index < 0) {
      // A line the pack does not hold yet resolves against the library, so `item add rope` works.
      const record = findEquipment(args.item);
      if (!record) return fail('unknown_item');
      equipmentId = record.id;
      index = doc.equipment.findIndex((entry) => String(entry?.equipmentId ?? '') === equipmentId);
    }
    const lines = doc.equipment.map((entry) => ({ ...entry }));
    const existing = index >= 0 ? lines[index] : null;
    const have = existing ? Math.max(0, toInt(existing.quantity) || 0) : 0;
    let quantity = have;
    if (args.quantity !== undefined) quantity = toInt(args.quantity);
    else if (args.delta !== undefined) {
      const delta = toInt(args.delta);
      if (Number.isNaN(delta)) return fail('bad_amount');
      if (have + delta < 0) return fail('not_enough_items', `${have} carried`);
      quantity = have + delta;
    }
    if (Number.isNaN(quantity) || quantity < 0 || quantity > MAX_QUANTITY) return fail('bad_amount');
    const equipped = args.equipped === undefined ? Boolean(existing?.equipped) : Boolean(args.equipped);
    if (quantity === 0) {
      if (!existing) return fail('not_carried');
      return { equipment: lines.filter((_, i) => i !== index) };
    }
    if (existing) lines[index] = { ...existing, quantity, equipped };
    else lines.push({ equipmentId, quantity, equipped });
    return { equipment: lines };
  },
  // Casting is the slot and the concentration together (`spellCasting.ts` says the same); the
  // bot rolls the dice, this records what the cast cost. A cantrip costs nothing and still may
  // take up concentration.
  cast: (m, doc, args) => {
    const { spells } = loadIndex();
    const wanted = String(args.spellId ?? args.spell ?? '').trim();
    const key = wanted.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const spell = spells.get(wanted)
      ?? [...spells.values()].find((entry) => String(entry.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === key);
    if (!spell) return fail('unknown_spell');
    const level = Math.max(0, toInt(spell.level) || 0);
    let patch = {};
    let slotLevel = 0;
    if (level > 0) {
      slotLevel = args.level === undefined ? level : toInt(args.level);
      if (Number.isNaN(slotLevel) || slotLevel < level) return fail('bad_slot_level', `${spell.name} is a level ${level} spell`);
      const totals = slotTotals(m, doc);
      // A caster with only pact slots at that level casts from them without being asked.
      const pact = args.pact === undefined
        ? (totals.slotsByLevel[slotLevel - 1] ?? 0) <= 0 && (totals.pactSlotsByLevel[slotLevel - 1] ?? 0) > 0
        : Boolean(args.pact);
      const target = slotTarget(m, doc, { level: slotLevel, pact });
      if (target.error) return target;
      if (target.used >= target.total) return fail('no_slot_left', `all ${target.total} level ${target.level}${pact ? ' pact' : ''} slots are spent`);
      patch = pact
        ? m.setPactSlotsUsed(doc, target.level, target.used + 1, target.total)
        : m.setSpellSlotsUsed(doc, target.level, target.used + 1, target.total);
    }
    if (spell.concentration) patch = { ...patch, ...m.startConcentration(spell.id, spell.name, slotLevel) };
    return patch;
  },
  resource: (m, doc, args) => {
    const resource = findResource(m, doc, args.key);
    if (!resource) return fail('unknown_resource');
    if (args.toggle) {
      if (!resource.activatable) return fail('not_activatable', `${resource.name} is spent, not entered`);
      return m.toggleResourceActive(doc, resource);
    }
    let used;
    if (args.used !== undefined) used = toInt(args.used);
    else {
      const delta = toInt(args.delta ?? 1);
      if (Number.isNaN(delta)) return fail('bad_amount');
      if (delta > 0 && resource.maximum !== null && resource.used + delta > resource.maximum) {
        return fail('no_resource_left', `all ${resource.maximum} used`);
      }
      used = resource.used + delta;
    }
    if (Number.isNaN(used)) return fail('bad_amount');
    return m.setClassResourceUsed(doc, resource, used);
  },
};

/**
 * Apply one action to a document. Returns `{ doc }` with the patched copy, or `{ error, detail }`
 * naming what was wrong with the request; the caller decides whether anything is written.
 */
async function applyPlayAction(rawDoc, action, args = {}) {
  const maths = await loadPlayMaths();
  const handler = Object.hasOwn(ACTIONS, String(action ?? '')) ? ACTIONS[action] : null;
  if (!handler) return fail('unknown_action', `one of ${Object.keys(ACTIONS).join(', ')}`);
  const doc = withDefaults(rawDoc ?? {});
  const patch = handler(maths, doc, args && typeof args === 'object' ? args : {});
  if (patch?.error) return patch;
  const next = { ...doc, ...patch };
  // `undefined` in a patch means "clear the field"; JSON would keep the old value through a spread.
  for (const key of Object.keys(patch)) if (patch[key] === undefined) delete next[key];
  return { doc: next };
}

module.exports = { ACTIONS: Object.keys(ACTIONS), applyPlayAction, playState, loadPlayMaths };
