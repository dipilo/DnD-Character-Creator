import {
  getRuntimeBackgroundById,
  getRuntimeClassById,
  getRuntimeEquipment,
  getRuntimeEquipmentById,
  getRuntimeFeatById,
  getRuntimeSpeciesById,
  getRuntimeSpeciesVariant,
  getRuntimeSpellById,
  getRuntimeSubclass
} from '@/data';
import {
  applyAbilityScoreBonuses,
  deriveArmorClass,
  deriveCharacterHitPoints,
  deriveCharacterProficiencies,
  getActiveFeatures,
  getCharacterProficiencyBonus,
  getSpellcastingRulesSummary,
  resolveCharacterClasses,
  resolveCharacterEquipment
} from '@/lib/builderRules';
import type { AbilityScores, Character, Equipment, Feature } from '@/types/dnd';
import type { PDFForm, PDFImage } from 'pdf-lib';

const abilityFieldMap: Record<keyof AbilityScores, { score: string; modifier: string; save: string }> = {
  strength: { score: 'STR', modifier: 'STRmod', save: 'ST Strength' },
  dexterity: { score: 'DEX', modifier: 'DEXmod', save: 'ST Dexterity' },
  constitution: { score: 'CON', modifier: 'CONmod', save: 'ST Constitution' },
  intelligence: { score: 'INT', modifier: 'INTmod', save: 'ST Intelligence' },
  wisdom: { score: 'WIS', modifier: 'WISmod', save: 'ST Wisdom' },
  charisma: { score: 'CHA', modifier: 'CHamod', save: 'ST Charisma' }
};

const skillFieldMap: Array<{ label: string; ability: keyof AbilityScores; field: string }> = [
  { label: 'Acrobatics', ability: 'dexterity', field: 'Acrobatics' },
  { label: 'Animal Handling', ability: 'wisdom', field: 'Animal' },
  { label: 'Arcana', ability: 'intelligence', field: 'Arcana' },
  { label: 'Athletics', ability: 'strength', field: 'Athletics' },
  { label: 'Deception', ability: 'charisma', field: 'Deception' },
  { label: 'History', ability: 'intelligence', field: 'History' },
  { label: 'Insight', ability: 'wisdom', field: 'Insight' },
  { label: 'Intimidation', ability: 'charisma', field: 'Intimidation' },
  { label: 'Investigation', ability: 'intelligence', field: 'Investigation' },
  { label: 'Medicine', ability: 'wisdom', field: 'Medicine' },
  { label: 'Nature', ability: 'intelligence', field: 'Nature' },
  { label: 'Perception', ability: 'wisdom', field: 'Perception' },
  { label: 'Performance', ability: 'charisma', field: 'Performance' },
  { label: 'Persuasion', ability: 'charisma', field: 'Persuasion' },
  { label: 'Religion', ability: 'intelligence', field: 'Religion' },
  { label: 'Sleight of Hand', ability: 'dexterity', field: 'SleightofHand' },
  { label: 'Stealth', ability: 'dexterity', field: 'Stealth' },
  { label: 'Survival', ability: 'wisdom', field: 'Survival' }
];

const saveCheckboxFieldMap: Record<keyof AbilityScores, string> = {
  strength: 'Check Box 11',
  dexterity: 'Check Box 18',
  constitution: 'Check Box 19',
  intelligence: 'Check Box 20',
  wisdom: 'Check Box 21',
  charisma: 'Check Box 22'
};

const skillCheckboxFieldMap: Record<string, string> = {
  Acrobatics: 'Check Box 23',
  'Animal Handling': 'Check Box 24',
  Arcana: 'Check Box 25',
  Athletics: 'Check Box 26',
  Deception: 'Check Box 27',
  History: 'Check Box 28',
  Insight: 'Check Box 29',
  Intimidation: 'Check Box 30',
  Investigation: 'Check Box 31',
  Medicine: 'Check Box 32',
  Nature: 'Check Box 33',
  Perception: 'Check Box 34',
  Performance: 'Check Box 35',
  Persuasion: 'Check Box 36',
  Religion: 'Check Box 37',
  'Sleight of Hand': 'Check Box 38',
  Stealth: 'Check Box 39',
  Survival: 'Check Box 40'
};

const weaponFieldMap = [
  { name: 'Wpn Name', attack: 'Wpn1 AtkBonus', damage: 'Wpn1 Damage' },
  { name: 'Wpn Name 2', attack: 'Wpn2 AtkBonus', damage: 'Wpn2 Damage' },
  { name: 'Wpn Name 3', attack: 'Wpn3 AtkBonus', damage: 'Wpn3 Damage' }
];

const slotTotalFieldNames = [
  'SlotsTotal 19',
  'SlotsTotal 20',
  'SlotsTotal 21',
  'SlotsTotal 22',
  'SlotsTotal 23',
  'SlotsTotal 24',
  'SlotsTotal 25',
  'SlotsTotal 26',
  'SlotsTotal 27'
];

const slotRemainingFieldNames = [
  'SlotsRemaining 19',
  'SlotsRemaining 20',
  'SlotsRemaining 21',
  'SlotsRemaining 22',
  'SlotsRemaining 23',
  'SlotsRemaining 24',
  'SlotsRemaining 25',
  'SlotsRemaining 26',
  'SlotsRemaining 27'
];

const spellFieldNames = [
  'Spells 1014', 'Spells 1015', 'Spells 1016', 'Spells 1017', 'Spells 1018', 'Spells 1019', 'Spells 1020', 'Spells 1021', 'Spells 1022',
  'Spells 1023', 'Spells 1024', 'Spells 1025', 'Spells 1026', 'Spells 1027', 'Spells 1028', 'Spells 1029', 'Spells 1030', 'Spells 1031', 'Spells 1032', 'Spells 1033',
  'Spells 1034', 'Spells 1035', 'Spells 1036', 'Spells 1037', 'Spells 1038', 'Spells 1039', 'Spells 1040', 'Spells 1041', 'Spells 1042', 'Spells 1043', 'Spells 1044', 'Spells 1045', 'Spells 1046',
  'Spells 1047', 'Spells 1048', 'Spells 1049', 'Spells 1050', 'Spells 1051', 'Spells 1052', 'Spells 1053', 'Spells 1054', 'Spells 1055', 'Spells 1056', 'Spells 1057', 'Spells 1058', 'Spells 1059',
  'Spells 1060', 'Spells 1061', 'Spells 1062', 'Spells 1063', 'Spells 1064', 'Spells 1065', 'Spells 1066', 'Spells 1067', 'Spells 1068', 'Spells 1069', 'Spells 1070', 'Spells 1071', 'Spells 1072',
  'Spells 1073', 'Spells 1074', 'Spells 1075', 'Spells 1076', 'Spells 1077', 'Spells 1078', 'Spells 1079', 'Spells 1080', 'Spells 1081',
  'Spells 1082', 'Spells 1083', 'Spells 1084', 'Spells 1085', 'Spells 1086', 'Spells 1087', 'Spells 1088', 'Spells 1089', 'Spells 1090',
  'Spells 1091', 'Spells 1092', 'Spells 1093', 'Spells 1094', 'Spells 1095', 'Spells 1096', 'Spells 1097', 'Spells 1098', 'Spells 1099',
  'Spells 10100', 'Spells 10101', 'Spells 10102', 'Spells 10103', 'Spells 10104', 'Spells 10105', 'Spells 10106', 'Spells 10107', 'Spells 10108', 'Spells 10109', 'Spells 101010', 'Spells 101011', 'Spells 101012', 'Spells 101013'
];

const spellPreparedCheckboxFieldMap: Partial<Record<string, string>> = {
  'Spells 1015': 'Check Box 251',
  'Spells 1023': 'Check Box 309',
  'Spells 1024': 'Check Box 3010',
  'Spells 1025': 'Check Box 3011',
  'Spells 1026': 'Check Box 3012',
  'Spells 1027': 'Check Box 3013',
  'Spells 1028': 'Check Box 3014',
  'Spells 1029': 'Check Box 3015',
  'Spells 1030': 'Check Box 3016',
  'Spells 1031': 'Check Box 3017',
  'Spells 1032': 'Check Box 3018',
  'Spells 1033': 'Check Box 3019',
  'Spells 1046': 'Check Box 313',
  'Spells 1034': 'Check Box 310',
  'Spells 1035': 'Check Box 3020',
  'Spells 1036': 'Check Box 3021',
  'Spells 1037': 'Check Box 3022',
  'Spells 1038': 'Check Box 3023',
  'Spells 1039': 'Check Box 3024',
  'Spells 1040': 'Check Box 3025',
  'Spells 1041': 'Check Box 3026',
  'Spells 1042': 'Check Box 3027',
  'Spells 1043': 'Check Box 3028',
  'Spells 1044': 'Check Box 3029',
  'Spells 1045': 'Check Box 3030',
  'Spells 1048': 'Check Box 315',
  'Spells 1047': 'Check Box 314',
  'Spells 1049': 'Check Box 3031',
  'Spells 1050': 'Check Box 3032',
  'Spells 1051': 'Check Box 3033',
  'Spells 1052': 'Check Box 3034',
  'Spells 1053': 'Check Box 3035',
  'Spells 1054': 'Check Box 3036',
  'Spells 1055': 'Check Box 3037',
  'Spells 1056': 'Check Box 3038',
  'Spells 1057': 'Check Box 3039',
  'Spells 1058': 'Check Box 3040',
  'Spells 1059': 'Check Box 3041',
  'Spells 1061': 'Check Box 317',
  'Spells 1060': 'Check Box 316',
  'Spells 1062': 'Check Box 3042',
  'Spells 1063': 'Check Box 3043',
  'Spells 1064': 'Check Box 3044',
  'Spells 1065': 'Check Box 3045',
  'Spells 1066': 'Check Box 3046',
  'Spells 1067': 'Check Box 3047',
  'Spells 1068': 'Check Box 3048',
  'Spells 1069': 'Check Box 3049',
  'Spells 1070': 'Check Box 3050',
  'Spells 1071': 'Check Box 3051',
  'Spells 1072': 'Check Box 3052',
  'Spells 1074': 'Check Box 319',
  'Spells 1073': 'Check Box 318',
  'Spells 1075': 'Check Box 3053',
  'Spells 1076': 'Check Box 3054',
  'Spells 1077': 'Check Box 3055',
  'Spells 1078': 'Check Box 3056',
  'Spells 1079': 'Check Box 3057',
  'Spells 1080': 'Check Box 3058',
  'Spells 1081': 'Check Box 3059',
  'Spells 1083': 'Check Box 321',
  'Spells 1082': 'Check Box 320',
  'Spells 1084': 'Check Box 3060',
  'Spells 1085': 'Check Box 3061',
  'Spells 1086': 'Check Box 3062',
  'Spells 1087': 'Check Box 3063',
  'Spells 1088': 'Check Box 3064',
  'Spells 1089': 'Check Box 3065',
  'Spells 1090': 'Check Box 3066',
  'Spells 1092': 'Check Box 323',
  'Spells 1091': 'Check Box 322',
  'Spells 1093': 'Check Box 3067',
  'Spells 1094': 'Check Box 3068',
  'Spells 1095': 'Check Box 3069',
  'Spells 1096': 'Check Box 3070',
  'Spells 1097': 'Check Box 3071',
  'Spells 1098': 'Check Box 3072',
  'Spells 1099': 'Check Box 3073',
  'Spells 10101': 'Check Box 325',
  'Spells 10100': 'Check Box 324',
  'Spells 10102': 'Check Box 3074',
  'Spells 10103': 'Check Box 3075',
  'Spells 10104': 'Check Box 3076',
  'Spells 10105': 'Check Box 3077',
  'Spells 10106': 'Check Box 3078',
  'Spells 10108': 'Check Box 327',
  'Spells 10107': 'Check Box 326',
  'Spells 10109': 'Check Box 3079',
  'Spells 101010': 'Check Box 3080',
  'Spells 101011': 'Check Box 3081',
  'Spells 101012': 'Check Box 3082',
  'Spells 101013': 'Check Box 3083'
};

const isDefined = <T,>(value: T | undefined | null): value is T => Boolean(value);

const normalizeName = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();
const truncate = (value: string, maxLength: number) => value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...` : value;
const getAbilityModifier = (score: number) => Math.floor((score - 10) / 2);
const formatSigned = (value: number) => (value >= 0 ? `+${value}` : `${value}`);
const sanitizeFileName = (value: string) => value.replaceAll(/[\\/:*?"<>|]+/g, '').trim() || 'character';

const joinLines = (lines: string[], maxLength: number) => {
  const filtered = lines.map((line) => line.trim()).filter(Boolean);
  return truncate(filtered.join('\n'), maxLength);
};

const getAbilityLabel = (ability: keyof AbilityScores) => ability.slice(0, 3).toUpperCase();

const hasNamedProficiency = (values: string[], target: string) => {
  const normalizedTarget = normalizeName(target);
  return values.some((value) => normalizeName(value) === normalizedTarget);
};

const hasWeaponProficiency = (proficiencies: string[], weapon: Equipment) => {
  if (hasNamedProficiency(proficiencies, weapon.name)) {
    return true;
  }

  if (weapon.weaponCategory === 'simple' && proficiencies.some((value) => normalizeName(value).includes('simple'))) {
    return true;
  }

  if (weapon.weaponCategory === 'martial' && proficiencies.some((value) => normalizeName(value).includes('martial'))) {
    return true;
  }

  return false;
};

const getWeaponAbilityModifier = (weapon: Equipment, abilityScores: AbilityScores) => {
  if (weapon.weaponType === 'ranged') {
    return getAbilityModifier(abilityScores.dexterity);
  }

  const strengthModifier = getAbilityModifier(abilityScores.strength);
  const dexterityModifier = getAbilityModifier(abilityScores.dexterity);
  const finesse = weapon.properties?.some((property) => normalizeName(property) === 'finesse');
  return finesse ? Math.max(strengthModifier, dexterityModifier) : strengthModifier;
};

const buildWeaponDamage = (weapon: Equipment, abilityModifier: number) => {
  const parts = [weapon.damage ?? ''];
  if (abilityModifier > 0) {
    parts[0] = `${parts[0]} + ${abilityModifier}`;
  } else if (abilityModifier < 0) {
    parts[0] = `${parts[0]} - ${Math.abs(abilityModifier)}`;
  }
  if (weapon.damageType) {
    parts.push(weapon.damageType);
  }
  return parts.join(' ').trim();
};

const buildWeaponEntries = ({
  equipment,
  proficiencies,
  abilityScores,
  proficiencyBonus
}: {
  equipment: ReturnType<typeof resolveCharacterEquipment>;
  proficiencies: ReturnType<typeof deriveCharacterProficiencies>;
  abilityScores: AbilityScores;
  proficiencyBonus: number;
}) => {
  return equipment
    .filter((entry) => entry.item?.type === 'weapon')
    .sort((left, right) => {
      if (left.equipped !== right.equipped) {
        return left.equipped ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 3)
    .map((entry) => {
      const weapon = entry.item as Equipment;
      const abilityModifier = getWeaponAbilityModifier(weapon, abilityScores);
      const proficient = hasWeaponProficiency(proficiencies.weapons, weapon);
      const attackBonus = abilityModifier + (proficient ? proficiencyBonus : 0);

      return {
        name: entry.name,
        attackBonus: formatSigned(attackBonus),
        damage: buildWeaponDamage(weapon, abilityModifier)
      };
    });
};

const setTextField = (form: { getTextField: (name: string) => { setText: (value: string) => void } }, name: string, value?: string) => {
  if (!value) {
    return;
  }

  try {
    form.getTextField(name).setText(value);
  } catch {
    // Ignore fields that do not exist on the template.
  }
};

const setCheckboxField = (form: { getCheckBox: (name: string) => { check: () => void; uncheck: () => void } }, name: string, checked: boolean) => {
  try {
    const field = form.getCheckBox(name);
    if (checked) {
      field.check();
    } else {
      field.uncheck();
    }
  } catch {
    // Ignore fields that do not exist on the template.
  }
};

const setButtonImage = (form: PDFForm, name: string, image: PDFImage) => {
  try {
    form.getButton(name).setImage(image);
  } catch {
    // Ignore fields that do not exist on the template.
  }
};

const decodeImageSource = async (source?: string) => {
  if (!source) {
    return undefined;
  }

  const response = await fetch(source);
  if (!response.ok) {
    return undefined;
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const bytes = await response.arrayBuffer();
  if (contentType.includes('png')) {
    return { bytes, type: 'png' as const };
  }
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    return { bytes, type: 'jpg' as const };
  }
  if (source.startsWith('data:image/png')) {
    return { bytes, type: 'png' as const };
  }
  if (source.startsWith('data:image/jpeg') || source.startsWith('data:image/jpg')) {
    return { bytes, type: 'jpg' as const };
  }

  return undefined;
};

const getRemainingSlots = (character: Character, slotsByLevel: number[]) => {
  const usedByLevel = new Array(slotsByLevel.length).fill(0);
  character.classes.forEach((entry) => {
    entry.spellSlotsUsed?.forEach((used, index) => {
      usedByLevel[index] = (usedByLevel[index] ?? 0) + used;
    });
  });

  return slotsByLevel.map((total, index) => Math.max(0, total - (usedByLevel[index] ?? 0)));
};

const buildFeatureLines = ({
  speciesFeatures,
  classFeatures,
  featNames,
  backgroundFeature
}: {
  speciesFeatures: Feature[];
  classFeatures: Feature[];
  featNames: string[];
  backgroundFeature?: string;
}) => {
  const seen = new Set<string>();
  const lines: string[] = [];

  [...speciesFeatures, ...classFeatures].forEach((feature) => {
    const key = normalizeName(feature.name);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    lines.push(feature.name);
  });

  featNames.forEach((featName) => {
    const key = normalizeName(featName);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    lines.push(featName);
  });

  if (backgroundFeature) {
    const key = normalizeName(backgroundFeature);
    if (!seen.has(key)) {
      lines.push(backgroundFeature);
    }
  }

  return lines;
};

export const exportCharacterToFillablePdf = async (character: Character) => {
  const [templateResponse, pdfLib] = await Promise.all([
    fetch('/5E_CharacterSheet_Fillable.pdf'),
    import('pdf-lib')
  ]);

  if (!templateResponse.ok) {
    throw new Error('Unable to load the fillable PDF template.');
  }

  const templateBytes = await templateResponse.arrayBuffer();
  const { PDFDocument } = pdfLib;
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();

  const species = getRuntimeSpeciesById(character.speciesId);
  const variant = character.variantId ? getRuntimeSpeciesVariant(character.speciesId, character.variantId) : undefined;
  const background = getRuntimeBackgroundById(character.backgroundId);
  const resolvedClasses = resolveCharacterClasses({
    classes: character.classes,
    getClassById: getRuntimeClassById,
    getSubclassById: getRuntimeSubclass
  });
  const resolvedEquipment = resolveCharacterEquipment({
    equipment: character.equipment,
    getEquipmentById: getRuntimeEquipmentById,
    findEquipmentByName: (equipmentName) => getRuntimeEquipment().find((entry) => entry.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim() === equipmentName.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim()),
    getClassById: getRuntimeClassById,
    getBackgroundById: getRuntimeBackgroundById
  });
  const selectedFeats = character.feats.map((featId) => getRuntimeFeatById(featId)).filter(isDefined);
  const derivedProficiencies = deriveCharacterProficiencies({
    character,
    resolvedClasses,
    background,
    species,
    variant
  });
  const activeFeatures = getActiveFeatures({
    species,
    variant,
    resolvedClasses,
    feats: selectedFeats,
    selectedFeatures: character.features
  });
  const displayedAbilityScores = applyAbilityScoreBonuses(character.abilityScores, character.abilityScoreBonuses);
  const displayedHp = character.hp.maximum > 0
    ? character.hp
    : deriveCharacterHitPoints({
      classes: character.classes,
      abilityScores: displayedAbilityScores,
      previousHp: character.hp,
      getClassById: getRuntimeClassById
    });
  const derivedArmor = deriveArmorClass({
    abilityScores: displayedAbilityScores,
    proficiencies: derivedProficiencies,
    equipment: resolvedEquipment,
    activeFeatures
  });
  const totalLevel = character.classes.reduce((sum, entry) => sum + entry.level, 0) || 1;
  const proficiencyBonus = getCharacterProficiencyBonus(totalLevel);
  const spellSummary = getSpellcastingRulesSummary({
    selectedClasses: resolvedClasses.map(({ entry, cls, subclass }) => ({
      cls,
      level: entry.level,
      subclassId: entry.subclassId,
      subclass
    })),
    abilityScores: displayedAbilityScores,
    selectedSpells: character.spells,
    getSpellById: getRuntimeSpellById
  });
  const primarySpellcastingClass = spellSummary.classes[0];
  const primarySpellcastingAbility = primarySpellcastingClass?.classId
    ? resolvedClasses.find((entry) => entry.cls.id === primarySpellcastingClass.classId)?.subclass?.spellcasting?.ability
      ?? resolvedClasses.find((entry) => entry.cls.id === primarySpellcastingClass.classId)?.cls.spellcasting?.ability
    : undefined;

  setTextField(form, 'CharacterName', character.name);
  setTextField(form, 'CharacterName 2', character.name);
  setTextField(form, 'ClassLevel', resolvedClasses.map(({ entry, cls, subclass }) => {
    const classLabel = `${cls.name} ${entry.level}`;
    return subclass ? `${classLabel} (${subclass.name})` : classLabel;
  }).join(' / '));
  setTextField(form, 'Background', background?.name);
  setTextField(form, 'Race', variant ? `${species?.name ?? ''} (${variant.name})`.trim() : species?.name);
  setTextField(form, 'Alignment', character.notes ? truncate(character.notes, 60) : undefined);
  setTextField(form, 'ProfBonus', formatSigned(proficiencyBonus));
  setTextField(form, 'AC', String(derivedArmor.value));
  setTextField(form, 'Initiative', formatSigned(getAbilityModifier(displayedAbilityScores.dexterity)));
  setTextField(form, 'Speed', species ? `${species.speed} ft.` : undefined);
  setTextField(form, 'HPMax', String(displayedHp.maximum));
  setTextField(form, 'HPCurrent', String(displayedHp.current));
  setTextField(form, 'HPTemp', displayedHp.temporary > 0 ? String(displayedHp.temporary) : undefined);
  setTextField(form, 'HDTotal', String(totalLevel));
  setTextField(form, 'HD', resolvedClasses.map(({ entry, cls }) => `${entry.level}d${cls.hitDie}`).join(' + '));

  (Object.keys(abilityFieldMap) as (keyof AbilityScores)[]).forEach((ability) => {
    const modifier = getAbilityModifier(displayedAbilityScores[ability]);
    const savingThrow = modifier + (derivedProficiencies.saves.includes(ability) ? proficiencyBonus : 0);
    setTextField(form, abilityFieldMap[ability].score, String(displayedAbilityScores[ability]));
    setTextField(form, abilityFieldMap[ability].modifier, formatSigned(modifier));
    setTextField(form, abilityFieldMap[ability].save, formatSigned(savingThrow));
    setCheckboxField(form, saveCheckboxFieldMap[ability], derivedProficiencies.saves.includes(ability));
  });

  skillFieldMap.forEach(({ label, ability, field }) => {
    const proficient = hasNamedProficiency(derivedProficiencies.skills, label);
    const modifier = getAbilityModifier(displayedAbilityScores[ability]) + (proficient ? proficiencyBonus : 0);
    setTextField(form, field, formatSigned(modifier));
    setCheckboxField(form, skillCheckboxFieldMap[label], proficient);
  });

  const passivePerceptionModifier = getAbilityModifier(displayedAbilityScores.wisdom) + (hasNamedProficiency(derivedProficiencies.skills, 'Perception') ? proficiencyBonus : 0);
  setTextField(form, 'Passive', String(10 + passivePerceptionModifier));

  const weaponEntries = buildWeaponEntries({
    equipment: resolvedEquipment,
    proficiencies: derivedProficiencies,
    abilityScores: displayedAbilityScores,
    proficiencyBonus
  });
  weaponEntries.forEach((entry, index) => {
    const fieldMap = weaponFieldMap[index];
    if (!fieldMap) {
      return;
    }

    setTextField(form, fieldMap.name, entry.name);
    setTextField(form, fieldMap.attack, entry.attackBonus);
    setTextField(form, fieldMap.damage, entry.damage);
  });

  const spellcastingSummaryLine = primarySpellcastingAbility
    ? `${getAbilityLabel(primarySpellcastingAbility)} save DC ${8 + proficiencyBonus + getAbilityModifier(displayedAbilityScores[primarySpellcastingAbility])}, attack ${formatSigned(proficiencyBonus + getAbilityModifier(displayedAbilityScores[primarySpellcastingAbility]))}`
    : undefined;
  const attackSummaryLines = weaponEntries.map((entry) => `${entry.name}: ${entry.attackBonus} to hit, ${entry.damage}`);
  if (spellcastingSummaryLine) {
    attackSummaryLines.push(spellcastingSummaryLine);
  }
  setTextField(form, 'AttacksSpellcasting', joinLines(attackSummaryLines, 1000));

  const equipmentLines = [
    ...resolvedEquipment.map((entry) => {
      const quantitySuffix = entry.quantity > 1 ? ` x${entry.quantity}` : '';
      return `${entry.name}${quantitySuffix}`;
    }),
    ...(background?.equipment.map((entry) => entry.name) ?? [])
  ];
  setTextField(form, 'Equipment', joinLines(equipmentLines, 1400));

  const proficiencyLines = [
    derivedProficiencies.languages.length > 0 ? `Languages: ${derivedProficiencies.languages.join(', ')}` : '',
    derivedProficiencies.armor.length > 0 ? `Armor: ${derivedProficiencies.armor.join(', ')}` : '',
    derivedProficiencies.weapons.length > 0 ? `Weapons: ${derivedProficiencies.weapons.join(', ')}` : '',
    derivedProficiencies.tools.length > 0 ? `Tools: ${derivedProficiencies.tools.join(', ')}` : ''
  ];
  setTextField(form, 'ProficienciesLang', joinLines(proficiencyLines, 1200));

  const featureLines = buildFeatureLines({
    speciesFeatures: [...(species?.features ?? []), ...(variant?.features ?? [])],
    classFeatures: activeFeatures,
    featNames: selectedFeats.map((feat) => feat.name),
    backgroundFeature: background?.feature.name
  });
  setTextField(form, 'Features and Traits', joinLines(featureLines, 1400));
  setTextField(form, 'Feat+Traits', joinLines(featureLines, 1400));

  setTextField(form, 'PersonalityTraits', character.personality?.traits);
  setTextField(form, 'Ideals', character.personality?.ideals);
  setTextField(form, 'Bonds', character.personality?.bonds);
  setTextField(form, 'Flaws', character.personality?.flaws);
  setTextField(form, 'Age', character.appearance?.age);
  setTextField(form, 'Height', character.appearance?.height);
  setTextField(form, 'Weight', character.appearance?.weight);
  setTextField(form, 'Eyes', character.appearance?.eyes);
  setTextField(form, 'Skin', character.appearance?.skin);
  setTextField(form, 'Hair', character.appearance?.hair);
  setTextField(form, 'FactionName', character.faction?.name);
  setTextField(form, 'Backstory', character.personality?.backstory);
  setTextField(form, 'Allies', character.personality?.bonds || character.notes);
  setTextField(form, 'Treasure', joinLines(equipmentLines.slice(0, 20), 1000));

  const portraitImage = await decodeImageSource(character.portrait?.imageDataUrl || character.avatar);
  if (portraitImage) {
    const embeddedPortrait = portraitImage.type === 'png'
      ? await pdf.embedPng(portraitImage.bytes)
      : await pdf.embedJpg(portraitImage.bytes);
    setButtonImage(form, 'CHARACTER IMAGE', embeddedPortrait);
  }

  const factionImage = await decodeImageSource(character.faction?.symbolImageDataUrl);
  if (factionImage) {
    const embeddedFactionImage = factionImage.type === 'png'
      ? await pdf.embedPng(factionImage.bytes)
      : await pdf.embedJpg(factionImage.bytes);
    setButtonImage(form, 'Faction Symbol Image', embeddedFactionImage);
  }

  if (primarySpellcastingClass && primarySpellcastingAbility) {
    const abilityModifier = getAbilityModifier(displayedAbilityScores[primarySpellcastingAbility]);
    setTextField(form, 'Spellcasting Class 2', primarySpellcastingClass.className);
    setTextField(form, 'SpellcastingAbility 2', getAbilityLabel(primarySpellcastingAbility));
    setTextField(form, 'SpellSaveDC  2', String(8 + proficiencyBonus + abilityModifier));
    setTextField(form, 'SpellAtkBonus 2', formatSigned(proficiencyBonus + abilityModifier));
  }

  const remainingSlots = getRemainingSlots(character, spellSummary.slotsByLevel);
  slotTotalFieldNames.forEach((fieldName, index) => {
    if ((spellSummary.slotsByLevel[index] ?? 0) > 0) {
      setTextField(form, fieldName, String(spellSummary.slotsByLevel[index]));
    }
  });
  slotRemainingFieldNames.forEach((fieldName, index) => {
    if ((remainingSlots[index] ?? 0) > 0) {
      setTextField(form, fieldName, String(remainingSlots[index]));
    }
  });

  const spellEntries = character.spells
    .map((entry) => {
      const spell = getRuntimeSpellById(entry.spellId);
      return spell ? { spell, entry } : undefined;
    })
    .filter(isDefined)
    .sort((left, right) => left.spell.level - right.spell.level || left.spell.name.localeCompare(right.spell.name))
    .map(({ spell, entry }) => {
      const levelLabel = spell.level === 0 ? 'C' : `L${spell.level}`;
      return {
        value: `${levelLabel}: ${spell.name}`,
        prepared: entry.prepared || entry.alwaysPrepared || false
      };
    });

  spellFieldNames.forEach((fieldName, index) => {
    setTextField(form, fieldName, spellEntries[index]?.value);

    const checkboxFieldName = spellPreparedCheckboxFieldMap[fieldName];
    if (checkboxFieldName) {
      setCheckboxField(form, checkboxFieldName, spellEntries[index]?.prepared ?? false);
    }
  });

  const output = await pdf.save();
  const blobBytes = new Uint8Array(output.length);
  blobBytes.set(output);
  const blob = new Blob([blobBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(character.name)}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};