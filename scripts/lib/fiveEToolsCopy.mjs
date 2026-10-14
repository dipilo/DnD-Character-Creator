// A reprint or a variant is stored as a pointer in 5etools data: `_copy` names the entry it is
// built from, `_versions` the variants built from it. Both are silent when unread — the entry
// arrives with a name and nothing else. See scripts/README.md.

const lower = (value) => String(value ?? '').toLowerCase();

// A copy takes the parent's content, not its printing metadata; `_preserve` names what it keeps.
const PRINTING_KEYS = [
  'page', 'srd', 'srd52', 'basicRules', 'basicRules2024', 'freeRules2024', 'otherSources',
  'additionalSources', 'reprintedAs', 'hasFluff', 'hasFluffImages', 'hasToken', 'hasTokenEmbed'
];

// The parent of a sub-entry is identified by its owner as well as by its name.
const OWNER_FIELDS = [
  ['raceName', 'raceSource'],
  ['className', 'classSource'],
  ['subclassShortName', 'subclassSource']
];

const ownerSuffix = (entry) => OWNER_FIELDS
  .filter(([name]) => entry?.[name])
  .map(([name]) => `|${lower(entry[name])}`)
  .join('');

const identityKeys = (entry) => {
  const base = `${lower(entry?.name)}|${lower(entry?.source)}`;
  const suffix = ownerSuffix(entry);
  return suffix ? [`${base}${suffix}`, base] : [base];
};

const warned = new Set();
const warnOnce = (message) => {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
};

const asArray = (value) => (Array.isArray(value) ? value : [value]).filter((entry) => entry != null);

const entryName = (entry) => lower(typeof entry === 'string' ? entry : entry?.name);

const matchesTarget = (entry, target) => {
  if (typeof target === 'string') return entryName(entry) === lower(target);
  if (target && typeof target === 'object') {
    if (target.name) return entryName(entry) === lower(target.name);
    return JSON.stringify(entry) === JSON.stringify(target);
  }
  return false;
};

const walkStrings = (value, replace, skipKeys) => {
  if (typeof value === 'string') return replace(value);
  if (Array.isArray(value)) return value.map((entry) => walkStrings(entry, replace, skipKeys));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .map(([key, entry]) => [key, skipKeys?.has(key) ? entry : walkStrings(entry, replace, skipKeys)]));
  }
  return value;
};

const walkNumbers = (value, apply) => {
  if (typeof value === 'number') return apply(value);
  if (Array.isArray(value)) return value.map((entry) => walkNumbers(entry, apply));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, walkNumbers(entry, apply)]));
  }
  return value;
};

const setByPath = (target, path, value) => {
  const parts = String(path).split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (typeof cursor[part] !== 'object' || cursor[part] === null) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
};

const asList = (value) => (Array.isArray(value) ? [...value] : []);

const REPLACE_TXT_PROTECTED_KEYS = new Set(['name']);

const SKILL_ABILITY = {
  athletics: 'str',
  acrobatics: 'dex', 'sleight of hand': 'dex', stealth: 'dex',
  arcana: 'int', history: 'int', investigation: 'int', nature: 'int', religion: 'int',
  'animal handling': 'wis', insight: 'wis', medicine: 'wis', perception: 'wis', survival: 'wis',
  deception: 'cha', intimidation: 'cha', performance: 'cha', persuasion: 'cha'
};

const abilityModifier = (score) => Math.floor((Number(score ?? 10) - 10) / 2);

const challengeProficiencyBonus = (cr) => {
  const stated = typeof cr === 'object' && cr !== null ? cr.cr : cr;
  const text = String(stated ?? '0');
  const rating = text.includes('/') ? 0 : Number(text);
  return 2 + Math.floor((Math.max(Number.isFinite(rating) ? rating : 0, 1) - 1) / 4);
};

// A spell is a tagged reference, sometimes with a parenthetical; the tag is not part of its name.
const spellKey = (value) => lower(String(value ?? '')
  .replaceAll(/\{@spell\s+([^}|]+)(?:\|[^}]*)?\}/g, '$1')).trim();

// The spell modes name the creature's spellcasting block rather than a property of it, so they
// arrive keyed "_" and all three walk the same three shapes: `will` is one list, a frequency group
// holds lists keyed by how many uses it states, and `spells` holds one per spell level.
const applyToSpellLists = (target, operation, label, visit) => {
  const block = Array.isArray(target.spellcasting) ? target.spellcasting[0] : null;
  if (!block) {
    warnOnce(`${label}: _mod ${operation.mode} changes spells, but this entry states no spellcasting block.`);
    return;
  }

  for (const [group, value] of Object.entries(operation)) {
    if (group === 'mode') continue;

    if (group === 'will') {
      block.will = visit(asList(block.will), asArray(value));
      continue;
    }

    if (group === 'spells') {
      block.spells = { ...block.spells };
      for (const [level, spec] of Object.entries(value ?? {})) {
        const current = block.spells[level] ?? {};
        // replaceSpells states a bare list of swaps per level; the other two state a slot record.
        const incoming = Array.isArray(spec) ? spec : asList(spec?.spells);
        const slots = Array.isArray(spec) ? {} : Object.fromEntries(Object.entries(spec ?? {}).filter(([key]) => key !== 'spells'));
        block.spells[level] = { ...current, ...slots, spells: visit(asList(current.spells), incoming) };
      }
      continue;
    }

    block[group] = { ...block[group] };
    for (const [uses, spells] of Object.entries(value ?? {})) {
      block[group][uses] = visit(asList(block[group][uses]), asArray(spells));
    }
  }
};

const insertItems = (current, operation) => {
  const items = asArray(operation.items);
  if (operation.mode === 'prependArr') return [...items, ...current];
  if (operation.mode === 'insertArr') {
    const index = Number(operation.index ?? current.length);
    return [...current.slice(0, index), ...items, ...current.slice(index)];
  }
  if (operation.mode === 'appendIfNotExistsArr') {
    const missing = items.filter((item) => !current.some((existing) => matchesTarget(existing, item)));
    return [...current, ...missing];
  }
  return [...current, ...items];
};

// One operation against one property. Keyed by mode so no handler carries the others' branches.
const MOD_HANDLERS = {
  appendArr: (target, key, operation) => { target[key] = insertItems(asList(target[key]), operation); },
  prependArr: (target, key, operation) => { target[key] = insertItems(asList(target[key]), operation); },
  insertArr: (target, key, operation) => { target[key] = insertItems(asList(target[key]), operation); },
  appendIfNotExistsArr: (target, key, operation) => { target[key] = insertItems(asList(target[key]), operation); },

  removeArr: (target, key, operation) => {
    const targets = [...asArray(operation.names), ...asArray(operation.items)];
    if (!Array.isArray(target[key])) return;
    target[key] = target[key].filter((entry) => !targets.some((candidate) => matchesTarget(entry, candidate)));
  },

  replaceArr: (target, key, operation, label) => {
    if (!Array.isArray(target[key])) return;
    const items = asArray(operation.items);
    // The target is a name, a whole entry, or a position — an unnamed opening paragraph has only
    // the last, and matching it by value appends the replacement beside what it replaces.
    const index = Number.isInteger(operation.replace?.index)
      ? operation.replace.index
      : target[key].findIndex((entry) => matchesTarget(entry, operation.replace));
    if (index === -1 || index >= target[key].length) {
      warnOnce(`${label}: _mod replaceArr found no "${operation.replace?.name ?? operation.replace?.index ?? operation.replace}" in ${key}; appended instead.`);
      target[key] = [...target[key], ...items];
      return;
    }
    target[key] = [...target[key].slice(0, index), ...items, ...target[key].slice(index + 1)];
  },

  // A text sweep rewrites prose, never a name: a copy that means to rename says `props: ["name"]`,
  // so rewriting names anyway left "Longsword" as "Longknife" for the next operation to miss.
  replaceTxt: (target, key, operation, label, { explicitProps } = {}) => {
    if (!explicitProps && REPLACE_TXT_PROTECTED_KEYS.has(key)) return;
    // 5etools adds the global flag to whatever the operation states; without it `flags: "i"`
    // rewrote only the first match in each string.
    const flags = [...new Set([...(operation.flags ?? ''), 'g'])].join('');
    const pattern = new RegExp(operation.replace, flags);
    const rewrite = (text) => text.replace(pattern, operation.with ?? '');
    target[key] = walkStrings(target[key], rewrite, REPLACE_TXT_PROTECTED_KEYS);
  },

  renameArr: (target, key, operation, label) => {
    if (!Array.isArray(target[key])) return;
    for (const rename of asArray(operation.renames)) {
      const entry = target[key].find((candidate) => matchesTarget(candidate, rename?.rename));
      if (!entry || typeof entry !== 'object') {
        warnOnce(`${label}: _mod renameArr found no "${rename?.rename}" in ${key}; nothing was renamed.`);
        continue;
      }
      entry.name = rename.with;
    }
  },

  addSkills: (target, key, operation, label) => {
    target.skill = { ...target.skill };
    for (const [skill, multiplier] of Object.entries(operation.skills ?? {})) {
      const ability = SKILL_ABILITY[lower(skill)];
      if (!ability) {
        warnOnce(`${label}: _mod addSkills names "${skill}", which is not a skill; it is left off.`);
        continue;
      }
      const total = abilityModifier(target[ability]) + (Number(multiplier) * challengeProficiencyBonus(target.cr));
      target.skill[skill] = total < 0 ? String(total) : `+${total}`;
    }
  },

  addSpells: (target, key, operation, label) => {
    applyToSpellLists(target, operation, label, (current, incoming) => [...current, ...incoming]);
  },

  removeSpells: (target, key, operation, label) => {
    applyToSpellLists(target, operation, label, (current, incoming) => {
      const unwanted = new Set(incoming.map(spellKey));
      return current.filter((spell) => !unwanted.has(spellKey(spell)));
    });
  },

  replaceSpells: (target, key, operation, label) => {
    applyToSpellLists(target, operation, label, (current, incoming) => current.map((spell) => {
      const swap = incoming.find((entry) => spellKey(entry?.replace) === spellKey(spell));
      return swap ? swap.with : spell;
    }));
  },

  scalarAdd: (target, key, operation) => applyScalar(target, key, operation),
  scalarMultiply: (target, key, operation) => applyScalar(target, key, operation),

  setProp: (target, key, operation) => setByPath(target, operation.prop ?? key, operation.value)
};

function applyScalar(target, key, operation) {
  const scalar = Number(operation.scalar ?? 0);
  const apply = (value) => (operation.mode === 'scalarAdd' ? value + scalar : value * scalar);
  const nested = operation.prop && operation.prop !== '*' ? operation.prop : null;
  if (nested && target[key] && typeof target[key] === 'object') {
    target[key][nested] = apply(Number(target[key][nested] ?? 0));
    return;
  }
  target[key] = walkNumbers(target[key], apply);
}

const applyOperation = (target, prop, operation, label) => {
  if (operation === 'remove' || operation?.mode === 'remove') {
    delete target[prop];
    return;
  }

  const handler = MOD_HANDLERS[operation?.mode];
  if (!handler) {
    warnOnce(`${label}: unsupported _mod mode "${operation?.mode}" on "${prop}"; that change is not applied.`);
    return;
  }

  // "*" is how a copy restates every property it holds, which replaceTxt is written for; `props`
  // overrides it with the properties the operation names, and is how a name gets rewritten.
  const named = Array.isArray(operation?.props) ? operation.props : null;
  for (const key of named ?? (prop === '*' ? Object.keys(target) : [prop])) {
    handler(target, key, operation, label, { explicitProps: Boolean(named) });
  }
};

const applyMods = (target, mods, label) => {
  for (const [prop, operations] of Object.entries(mods ?? {})) {
    for (const operation of asArray(operations)) {
      applyOperation(target, prop, operation, label);
    }
  }
};

const substituteVariables = (value, variables) => {
  if (!variables) return value;
  return walkStrings(value, (text) => text.replaceAll(/\{\{(\w+)\}\}|<\$(\w+)\$>/g, (match, braced, dollared) => {
    const name = braced ?? dollared;
    return name in variables ? String(variables[name]) : match;
  }));
};

const VERSION_META_KEYS = new Set(['_mod', '_abstract', '_implementations', '_variables', '_template', '_preserve']);

/**
 * `_copy` pointers resolved against `pool`, which spans every book in the directory because a
 * supplement's reprint copies the book it reprints.
 */
export const resolveFiveEToolsCopies = (entries, { pool = entries, bucket = 'entry' } = {}) => {
  const index = new Map();
  for (const entry of pool) {
    for (const key of identityKeys(entry)) {
      if (!index.has(key)) index.set(key, entry);
    }
  }

  const resolved = new Map();
  const resolve = (entry, chain) => {
    if (!entry?._copy) return entry;
    const cacheKey = identityKeys(entry)[0];
    if (resolved.has(cacheKey)) return resolved.get(cacheKey);
    if (chain.has(cacheKey)) {
      warnOnce(`${bucket} "${entry.name}": _copy points back at itself; kept unresolved.`);
      return entry;
    }

    const pointer = entry._copy;
    // The pointer states its own owner for a sub-entry, and inherits the copy's otherwise.
    const owners = Object.fromEntries(OWNER_FIELDS.flat().map((field) => [field, pointer[field] ?? entry[field]]));
    const parentRaw = identityKeys({ ...owners, name: pointer.name, source: pointer.source })
      .map((key) => index.get(key))
      .find(Boolean);
    if (!parentRaw) {
      warnOnce(`${bucket} "${entry.name}": _copy names "${pointer.name}" (${pointer.source}), which is not in the directory; it ships with only what it states itself.`);
      return entry;
    }

    const parent = resolve(parentRaw, new Set([...chain, cacheKey]));
    const merged = structuredClone(parent);
    const preserved = new Set(Object.keys(pointer._preserve ?? {}));
    for (const key of PRINTING_KEYS) {
      if (!preserved.has(key)) delete merged[key];
    }
    delete merged._copy;
    delete merged._versions;

    for (const [key, value] of Object.entries(entry)) {
      if (key === '_copy') continue;
      merged[key] = structuredClone(value);
    }

    applyMods(merged, pointer._mod, `${bucket} "${entry.name}"`);
    resolved.set(cacheKey, merged);
    return merged;
  };

  return entries.map((entry) => resolve(entry, new Set()));
};

const buildVersion = (base, version, variables, bucket) => {
  const resolvedVersion = substituteVariables(version, variables);
  const built = structuredClone(base);
  delete built._versions;
  for (const [key, value] of Object.entries(resolvedVersion)) {
    if (VERSION_META_KEYS.has(key)) continue;
    built[key] = structuredClone(value);
  }
  applyMods(built, resolvedVersion._mod, `${bucket} "${built.name ?? base.name}"`);
  // The variables reach the inherited text as well, which is where a template states the part
  // that varies ("You exhale {{color}} damage").
  Object.assign(built, substituteVariables(built, variables));
  if (/\{\{|<\$/.test(String(built.name ?? ''))) {
    warnOnce(`${bucket} "${base.name}": a _versions template left "${built.name}" unresolved; that variant is dropped.`);
    return null;
  }
  return built;
};

/** A template states what every variant shares in `_abstract` and what differs in `_variables`. */
const expandImplementations = (base, version, bucket) => version._implementations
  .map((implementation) => {
    const abstract = version._abstract ?? {};
    const mods = { ...version._mod, ...abstract._mod, ...implementation._mod };
    const spec = {
      ...abstract,
      ...Object.fromEntries(Object.entries(implementation).filter(([key]) => !VERSION_META_KEYS.has(key)))
    };
    if (Object.keys(mods).length > 0) spec._mod = mods;
    return buildVersion(base, spec, implementation._variables, bucket);
  })
  .filter(Boolean);

/** `_versions` are entries of their own, printed alongside the one they are built from. */
export const expandFiveEToolsVersions = (entries, { bucket = 'entry' } = {}) => entries.flatMap((entry) => [
  entry,
  ...(entry?._versions ?? []).flatMap((version) => (version?._implementations
    ? expandImplementations(entry, version, bucket)
    : [buildVersion(entry, version, version?._variables, bucket)].filter(Boolean)))
]);
