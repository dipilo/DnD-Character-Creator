import { useEffect, useMemo, useState } from 'react';
import type { EquipmentOption } from '@/types/dnd';
import { useCharacterStore } from '@/store/characterStore';
import { useContentLibrary } from '@/data';
import { SourceFilterBar } from '@/components/SourceFilterBar';
import { sourceMatchesSelection } from '@/data/librarySources';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Sword } from 'lucide-react';
import { toast } from 'sonner';
import { canEquipSelection, getRulesEdition, resolveCharacterEquipment } from '@/lib/builderRules';
import { dedupeByNamePreferringEdition } from '@/lib/contentSelection';

type EquipmentSortMode = 'name' | 'type' | 'cost-asc' | 'weight-asc' | 'source';
type WeaponCategory = 'simple' | 'martial';
type WeaponType = 'melee' | 'ranged';
type StartingWeaponRule = { category: WeaponCategory; type?: WeaponType };
type EquipmentEntry = NonNullable<ReturnType<typeof useContentLibrary>['equipment']>[number];
type ClassEntry = NonNullable<ReturnType<typeof useContentLibrary>['classes']>[number];
type EquipmentSelectionRecord = { equipmentId: string; quantity: number; equipped: boolean };

const semanticEquipmentFilters = ['instrument', 'gaming set', 'artisan tools', 'holy symbol', 'arcane focus', 'druidic focus'] as const;

function slugify(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '');
}

function normalizeName(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();
}

const implicitQuantityWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twenty: 20
};

function getEquipmentSelectionQuantity(option: EquipmentOption) {
  if (option.count) {
    return option.count;
  }

  if (option.type === 'gold' || /,|\sand\s|choose\s+1\s+from/i.test(option.name)) {
    return 1;
  }

  const numericMatch = /^(\d+)\s+/i.exec(option.name);
  if (numericMatch) {
    return Number.parseInt(numericMatch[1], 10);
  }

  const wordMatch = /^([a-z]+)\s+/i.exec(option.name);
  if (!wordMatch) {
    return 1;
  }

  return implicitQuantityWords[wordMatch[1].toLowerCase()] ?? 1;
}

const weaponRuleByOptionName: Record<string, StartingWeaponRule> = {
  'a simple weapon': { category: 'simple' },
  'any simple weapon': { category: 'simple' },
  'a simple melee weapon': { category: 'simple', type: 'melee' },
  'any simple melee weapon': { category: 'simple', type: 'melee' },
  'a simple ranged weapon': { category: 'simple', type: 'ranged' },
  'any simple ranged weapon': { category: 'simple', type: 'ranged' },
  'a martial weapon': { category: 'martial' },
  'any martial weapon': { category: 'martial' },
  'a martial melee weapon': { category: 'martial', type: 'melee' },
  'any martial melee weapon': { category: 'martial', type: 'melee' },
  'a martial ranged weapon': { category: 'martial', type: 'ranged' },
  'any martial ranged weapon': { category: 'martial', type: 'ranged' }
};

const weaponClassificationByName: Record<string, { category: WeaponCategory; type: WeaponType }> = {
  club: { category: 'simple', type: 'melee' },
  dagger: { category: 'simple', type: 'melee' },
  greatclub: { category: 'simple', type: 'melee' },
  handaxe: { category: 'simple', type: 'melee' },
  javelin: { category: 'simple', type: 'melee' },
  'light hammer': { category: 'simple', type: 'melee' },
  mace: { category: 'simple', type: 'melee' },
  quarterstaff: { category: 'simple', type: 'melee' },
  sickle: { category: 'simple', type: 'melee' },
  spear: { category: 'simple', type: 'melee' },
  'crossbow light': { category: 'simple', type: 'ranged' },
  dart: { category: 'simple', type: 'ranged' },
  shortbow: { category: 'simple', type: 'ranged' },
  sling: { category: 'simple', type: 'ranged' },
  battleaxe: { category: 'martial', type: 'melee' },
  flail: { category: 'martial', type: 'melee' },
  glaive: { category: 'martial', type: 'melee' },
  greataxe: { category: 'martial', type: 'melee' },
  greatsword: { category: 'martial', type: 'melee' },
  halberd: { category: 'martial', type: 'melee' },
  lance: { category: 'martial', type: 'melee' },
  longsword: { category: 'martial', type: 'melee' },
  maul: { category: 'martial', type: 'melee' },
  morningstar: { category: 'martial', type: 'melee' },
  pike: { category: 'martial', type: 'melee' },
  rapier: { category: 'martial', type: 'melee' },
  scimitar: { category: 'martial', type: 'melee' },
  shortsword: { category: 'martial', type: 'melee' },
  trident: { category: 'martial', type: 'melee' },
  'war pick': { category: 'martial', type: 'melee' },
  warhammer: { category: 'martial', type: 'melee' },
  whip: { category: 'martial', type: 'melee' },
  blowgun: { category: 'martial', type: 'ranged' },
  'crossbow hand': { category: 'martial', type: 'ranged' },
  'crossbow heavy': { category: 'martial', type: 'ranged' },
  longbow: { category: 'martial', type: 'ranged' },
  net: { category: 'martial', type: 'ranged' },
  musket: { category: 'martial', type: 'ranged' },
  pistol: { category: 'martial', type: 'ranged' }
};

const getEquipmentSearchText = (entry: EquipmentEntry) => `${entry.name} ${entry.description ?? ''}`.toLowerCase();
const isMusicalInstrument = (entry: EquipmentEntry) => entry.type === 'tool' && /musical instrument/i.test(getEquipmentSearchText(entry));
const isGamingSet = (entry: EquipmentEntry) => entry.type === 'tool' && (/gaming set/i.test(getEquipmentSearchText(entry)) || /dice set|playing card set/i.test(entry.name));
const isArtisanTool = (entry: EquipmentEntry) => entry.type === 'tool' && /(tools|supplies|utensils)/i.test(entry.name);
const isHolySymbol = (entry: EquipmentEntry) => /holy symbol/i.test(getEquipmentSearchText(entry));
const isArcaneFocus = (entry: EquipmentEntry) => /arcane focus/i.test(getEquipmentSearchText(entry));
const isDruidicFocus = (entry: EquipmentEntry) => /druidic focus/i.test(getEquipmentSearchText(entry));

function getEquipmentSemanticTags(entry: EquipmentEntry) {
  const tags = new Set<string>();

  if (entry.armorCategory && entry.armorCategory !== 'shield') {
    tags.add(`${entry.armorCategory} armor`);
  } else if (entry.type === 'armor') {
    tags.add('armor');
  }

  if (entry.type === 'shield' || entry.armorCategory === 'shield') {
    tags.add('shield');
  }

  if (entry.weaponCategory) {
    tags.add(`${entry.weaponCategory} weapon`);
  } else if (entry.type === 'weapon') {
    tags.add('weapon');
  }

  if (entry.weaponType) {
    tags.add(entry.weaponType);
  }

  if (isMusicalInstrument(entry)) {
    tags.add('instrument');
  }

  if (isGamingSet(entry)) {
    tags.add('gaming set');
  }

  if (isArtisanTool(entry)) {
    tags.add('artisan tools');
  }

  if (isHolySymbol(entry)) {
    tags.add('holy symbol');
  }

  if (isArcaneFocus(entry)) {
    tags.add('arcane focus');
  }

  if (isDruidicFocus(entry)) {
    tags.add('druidic focus');
  }

  if (tags.size === 0) {
    tags.add(entry.type);
  }

  return Array.from(tags);
}

function getStartingWeaponRule(option: EquipmentOption) {
  return weaponRuleByOptionName[normalizeName(option.name)] ?? null;
}

function classifyWeapon(entry: EquipmentEntry) {
  if (entry.weaponCategory && entry.weaponType) {
    return { category: entry.weaponCategory, type: entry.weaponType };
  }

  if (!entry.damage) {
    return null;
  }

  return weaponClassificationByName[normalizeName(entry.name)] ?? null;
}

function dedupeEquipmentByName(
  availableEquipment: NonNullable<ReturnType<typeof useContentLibrary>['equipment']>,
  preferredEdition: ReturnType<typeof getRulesEdition>
) {
  const preferredEntries = new Map<string, NonNullable<ReturnType<typeof useContentLibrary>['equipment']>[number]>();

  availableEquipment.forEach((entry) => {
    const key = normalizeName(entry.name);
    const current = preferredEntries.get(key);
    const entryEdition = getRulesEdition(entry.sourceId, entry.source);
    let entryScore = 0;
    if (entryEdition === preferredEdition) {
      entryScore += 2;
    }
    if (entryEdition === 'unknown') {
      entryScore += 1;
    }

    const currentEdition = current ? getRulesEdition(current.sourceId, current.source) : undefined;
    let currentScore = -1;
    if (currentEdition === preferredEdition) {
      currentScore += 2;
    }
    if (currentEdition === 'unknown') {
      currentScore += 1;
    }

    if (!current || entryScore > currentScore || (entryScore === currentScore && entry.name.localeCompare(current.name) < 0)) {
      preferredEntries.set(key, entry);
    }
  });

  return Array.from(preferredEntries.values());
}

function getMatchingWeapons(
  option: EquipmentOption,
  availableEquipment: NonNullable<ReturnType<typeof useContentLibrary>['equipment']>,
  preferredEdition: ReturnType<typeof getRulesEdition>
) {
  const rule = getStartingWeaponRule(option);
  if (!rule) {
    return [];
  }

  return dedupeEquipmentByName(availableEquipment, preferredEdition)
    .filter((entry) => {
      const classification = classifyWeapon(entry);
      return classification?.category === rule.category
        && (!rule.type || classification.type === rule.type);
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getChoiceEquipmentCandidates(
  option: EquipmentOption,
  availableEquipment: NonNullable<ReturnType<typeof useContentLibrary>['equipment']>,
  preferredEdition: ReturnType<typeof getRulesEdition>
) {
  const normalizedOptionName = normalizeName(option.name);
  const dedupedEquipment = dedupeEquipmentByName(availableEquipment, preferredEdition);

  if (normalizedOptionName.includes('musical instrument')) {
    return dedupedEquipment
      .filter(isMusicalInstrument)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  if (normalizedOptionName.includes('gaming set')) {
    return dedupedEquipment
      .filter(isGamingSet)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  if (normalizedOptionName.includes('artisan') && normalizedOptionName.includes('tool')) {
    return dedupedEquipment
      .filter(isArtisanTool)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  if (normalizedOptionName.includes('holy symbol')) {
    return dedupedEquipment
      .filter(isHolySymbol)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  if (normalizedOptionName.includes('arcane focus')) {
    return dedupedEquipment
      .filter(isArcaneFocus)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  if (normalizedOptionName.includes('druidic focus')) {
    return dedupedEquipment
      .filter(isDruidicFocus)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  return [];
}

function getEmbeddedChoiceEquipmentOption(option: EquipmentOption) {
  const chooseFromMatch = /Choose\s+1\s+from\s+([^,]+)/i.exec(option.name);
  if (chooseFromMatch) {
    return {
      name: `Choose 1 from ${chooseFromMatch[1].trim()}`,
      type: 'gear' as const
    } satisfies EquipmentOption;
  }

  const ofYourChoiceMatch = /\b(?:an?|one|1)\s+([^,]+?)\s+of your choice\b/i.exec(option.name);
  if (ofYourChoiceMatch) {
    return {
      name: `A ${ofYourChoiceMatch[1].trim()} of your choice`,
      type: 'gear' as const
    } satisfies EquipmentOption;
  }

  return null;
}

function getAutomaticStartingEquipmentSelections(
  selectedClasses: ClassEntry[],
  currentEquipment: EquipmentSelectionRecord[],
  availableEquipment: EquipmentEntry[]
) {
  const selections: EquipmentSelectionRecord[] = [];

  selectedClasses.forEach((cls) => {
    const classEdition = getRulesEdition(cls.sourceId, cls.source);

    cls.equipmentOptions.forEach((group, groupIndex) => {
      if (group.length !== 1) {
        return;
      }

      const option = group[0];
      if (getMatchingWeapons(option, availableEquipment, classEdition).length > 0) {
        return;
      }

      const prefix = `${cls.id}::${groupIndex}::`;
      if (currentEquipment.some((entry) => entry.equipmentId.startsWith(prefix))) {
        return;
      }

      const bundledOptions = option.contents ?? [option];
      bundledOptions.forEach((bundledOption) => {
        selections.push({
          equipmentId: option.contents?.length
            ? `${prefix}${slugify(option.name)}::${slugify(bundledOption.name)}`
            : `${prefix}${slugify(option.name)}`,
          quantity: getEquipmentSelectionQuantity(bundledOption),
          equipped: false
        });
      });
    });
  });

  return selections;
}

function getResolvedEquipmentId(equipmentId?: string) {
  return equipmentId?.split('::')[3];
}

function getSelectedBackgroundEquipmentId(equipmentId?: string) {
  const parts = equipmentId?.split('::') ?? [];
  return parts[0] === 'background' ? parts[3] : undefined;
}

function getSelectedBackgroundResolvedEquipmentId(equipmentId?: string) {
  const parts = equipmentId?.split('::') ?? [];
  return parts[0] === 'background' ? parts[4] : undefined;
}

interface StartingEquipmentGroupProps {
  classId: string;
  group: EquipmentOption[];
  groupIndex: number;
  selectedEquipmentIds: string[];
  availableEquipment: NonNullable<ReturnType<typeof useContentLibrary>['equipment']>;
  preferredEdition: ReturnType<typeof getRulesEdition>;
  onSelect: (classId: string, groupIndex: number, option: EquipmentOption, resolvedEquipmentId?: string) => void;
  onClear: (classId: string, groupIndex: number) => void;
}

function StartingEquipmentGroup({
  classId,
  group,
  groupIndex,
  selectedEquipmentIds,
  availableEquipment,
  preferredEdition,
  onSelect,
  onClear
}: Readonly<StartingEquipmentGroupProps>) {
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(selectedEquipmentIds[0]?.split('::').slice(0, 3).join('::') ?? null);
  const fixedOption = group.length === 1 ? group[0] : undefined;
  const isFixedGroup = fixedOption
    ? getMatchingWeapons(fixedOption, availableEquipment, preferredEdition).length === 0 && (fixedOption.contents?.length ?? 0) === 0
    : false;

  if (fixedOption && isFixedGroup) {
    return (
      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">Included</p>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="font-medium">{fixedOption.count ? `${fixedOption.count} ` : ''}{fixedOption.name}</div>
          <p className="mt-1 text-xs text-muted-foreground">Added automatically as part of this class kit.</p>
        </div>
      </div>
    );
  }

  const handleOptionToggle = (classId: string, groupIndex: number, option: EquipmentOption, optionId: string, active: boolean, hasChooser: boolean) => {
    if (active) {
      onClear(classId, groupIndex);
      setExpandedOptionId((current) => (current === optionId ? null : current));
      return;
    }

    if (hasChooser) {
      setExpandedOptionId((current) => (current === optionId ? null : optionId));
      return;
    }

    onSelect(classId, groupIndex, option);
  };

  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-sm font-medium">Choose one</p>
      <div className="flex flex-wrap gap-2">
        {group.map((option) => {
          const optionId = `${classId}::${groupIndex}::${slugify(option.name)}`;
          const active = selectedEquipmentIds.some((entry) => entry.startsWith(optionId));
          const matchingWeapons = getMatchingWeapons(option, availableEquipment, preferredEdition);
          const selectedEquipmentId = selectedEquipmentIds.find((entry) => entry.startsWith(optionId));
          const resolvedEquipmentId = getResolvedEquipmentId(selectedEquipmentId);
          const showWeaponChooser = matchingWeapons.length > 0 && (active || expandedOptionId === optionId);
          const bundledOptions = option.contents ?? [];
          let optionContent;

          if (matchingWeapons.length > 0) {
            optionContent = (
              <div className="space-y-3">
                <Button
                  variant={active || showWeaponChooser ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => handleOptionToggle(classId, groupIndex, option, optionId, active, true)}
                >
                  {option.name}
                </Button>
                {active && <Badge variant="default">Selected</Badge>}
                {showWeaponChooser && (
                  <Select
                    value={active ? resolvedEquipmentId : ''}
                    onValueChange={(value) => onSelect(classId, groupIndex, option, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose the weapon" />
                    </SelectTrigger>
                    <SelectContent>
                      {matchingWeapons.map((entry) => (
                        <SelectItem key={`${optionId}-${entry.id}`} value={entry.id}>
                          {entry.name} ({entry.source})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          } else if (bundledOptions.length > 0) {
            optionContent = (
              <div className="space-y-3">
                <Button
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => handleOptionToggle(classId, groupIndex, option, optionId, active, false)}
                >
                  {option.name}
                </Button>
                {active ? <Badge variant="default">Selected</Badge> : null}
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                  {bundledOptions.map((entry) => (
                    <div key={`${optionId}-${entry.name}`}>
                      {entry.count ? `${entry.count} ` : ''}{entry.name}
                    </div>
                  ))}
                </div>
              </div>
            );
          } else {
            optionContent = (
              <Button
                variant={active ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start text-left"
                onClick={() => handleOptionToggle(classId, groupIndex, option, optionId, active, false)}
              >
                {option.name}
              </Button>
            );
          }

          return (
            <div key={optionId} className={`w-full rounded-lg border p-3 sm:w-auto sm:min-w-[16rem] ${active ? 'border-primary bg-primary/5' : 'border-border'}`}>
              {optionContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EquipmentSelectionPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<EquipmentSortMode>('name');
  const { builderState, updateBuilderCharacter, updateBuilderState } = useCharacterStore();
  const selectedSourceIds = builderState.selectedSourceIds;
  const { classes, backgrounds, equipment } = useContentLibrary();

  const selectedClasses = useMemo(() => {
    return (builderState.character?.classes || [])
      .map((entry) => classes.find((cls) => cls.id === entry.classId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [builderState.character?.classes, classes]);

  const background = builderState.character?.backgroundId
    ? backgrounds.find((entry) => entry.id === builderState.character?.backgroundId)
    : undefined;

  useEffect(() => {
    const currentEquipment = builderState.character?.equipment || [];
    const automaticSelections = getAutomaticStartingEquipmentSelections(selectedClasses, currentEquipment, equipment);

    if (automaticSelections.length === 0) {
      return;
    }

    updateBuilderCharacter({
      equipment: [...currentEquipment, ...automaticSelections]
    });
  }, [builderState.character?.equipment, equipment, selectedClasses, updateBuilderCharacter]);

  const equipmentTypes = useMemo(
    () => Array.from(new Set([...equipment.map((entry) => entry.type), ...semanticEquipmentFilters])).sort((left, right) => left.localeCompare(right)),
    [equipment]
  );

  const selectedClassEdition = useMemo(() => {
    for (const cls of selectedClasses) {
      const edition = getRulesEdition(cls.sourceId, cls.source);
      if (edition !== 'unknown') {
        return edition;
      }
    }
    return 'unknown' as const;
  }, [selectedClasses]);

  const filteredEquipment = useMemo(() => {
    const matchingEquipment = equipment.filter((entry) => {
      const matchesSearch =
        entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.source.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || entry.type === typeFilter || getEquipmentSemanticTags(entry).includes(typeFilter);

      return matchesSearch
        && matchesType
        && sourceMatchesSelection(entry.source, entry.sourceId, selectedSourceIds);
    });

    // Both editions print most of the same items; show one card per item name, preferring
    // the printing that matches the selected class's rules edition.
    const nextEquipment = dedupeByNamePreferringEdition(matchingEquipment, selectedClassEdition);

    nextEquipment.sort((left, right) => {
      if (sortBy === 'type') {
        return left.type.localeCompare(right.type) || left.name.localeCompare(right.name);
      }
      if (sortBy === 'cost-asc') {
        return left.cost.amount - right.cost.amount || left.name.localeCompare(right.name);
      }
      if (sortBy === 'weight-asc') {
        return left.weight - right.weight || left.name.localeCompare(right.name);
      }
      if (sortBy === 'source') {
        return left.source.localeCompare(right.source) || left.name.localeCompare(right.name);
      }
      return left.name.localeCompare(right.name);
    });

    return nextEquipment;
  }, [equipment, searchQuery, selectedClassEdition, selectedSourceIds, sortBy, typeFilter]);

  const selectedEquipmentCount = builderState.character?.equipment?.filter((entry) => !entry.equipmentId.includes('::')).length ?? 0;
  const resolvedEquipmentSelections = useMemo(() => {
    return resolveCharacterEquipment({
      equipment: builderState.character?.equipment ?? [],
      getEquipmentById: (equipmentId) => equipment.find((entry) => entry.id === equipmentId),
      findEquipmentByName: (equipmentName) => equipment.find((entry) => normalizeName(entry.name) === normalizeName(equipmentName)),
      getClassById: (classId) => classes.find((entry) => entry.id === classId),
      getBackgroundById: (backgroundId) => backgrounds.find((entry) => entry.id === backgroundId)
    });
  }, [backgrounds, builderState.character?.equipment, classes, equipment]);

  const isSelected = (equipmentId: string) => {
    return (builderState.character?.equipment || []).some((entry) => entry.equipmentId === equipmentId);
  };

  const toggleEquipped = (equipmentId: string) => {
    const currentEquipment = builderState.character?.equipment || [];
    const nextEquipment = currentEquipment.map((entry) => {
      if (entry.equipmentId !== equipmentId) {
        return entry;
      }

      return {
        ...entry,
        equipped: !entry.equipped
      };
    });

    updateBuilderCharacter({ equipment: nextEquipment });
    toast.success('Equipment state updated');
  };

  const selectStartingEquipment = (classId: string, groupIndex: number, option: EquipmentOption, resolvedEquipmentId?: string) => {
    if (getStartingWeaponRule(option) && !resolvedEquipmentId) {
      toast.error('Choose the specific weapon for that starting equipment option.');
      return;
    }

    const prefix = `${classId}::${groupIndex}::`;
    const nextEquipment = (builderState.character?.equipment || []).filter((entry) => !entry.equipmentId.startsWith(prefix));

    if (option.contents?.length) {
      option.contents.forEach((entry) => {
        nextEquipment.push({
          equipmentId: `${prefix}${slugify(option.name)}::${slugify(entry.name)}`,
          quantity: getEquipmentSelectionQuantity(entry),
          equipped: false
        });
      });
    } else {
      const equipmentId = resolvedEquipmentId
        ? `${prefix}${slugify(option.name)}::${resolvedEquipmentId}`
        : `${prefix}${slugify(option.name)}`;

      nextEquipment.push({
        equipmentId,
        quantity: getEquipmentSelectionQuantity(option),
        equipped: false
      });
    }

    updateBuilderCharacter({ equipment: nextEquipment });
    toast.success('Starting equipment updated');
  };

  const clearStartingEquipmentSelection = (classId: string, groupIndex: number) => {
    const prefix = `${classId}::${groupIndex}::`;
    const nextEquipment = (builderState.character?.equipment || []).filter((entry) => !entry.equipmentId.startsWith(prefix));
    updateBuilderCharacter({ equipment: nextEquipment });
    toast.success('Starting equipment cleared');
  };

  const selectBackgroundEquipment = (backgroundId: string, groupIndex: number, option: EquipmentOption, resolvedEquipmentId?: string) => {
    const prefix = `background::${backgroundId}::${groupIndex}::`;
    const nextEquipment = (builderState.character?.equipment || []).filter((entry) => !entry.equipmentId.startsWith(prefix));
    const equipmentId = resolvedEquipmentId
      ? `${prefix}${slugify(option.name)}::${resolvedEquipmentId}`
      : `${prefix}${slugify(option.name)}`;

    nextEquipment.push({
      equipmentId,
      quantity: getEquipmentSelectionQuantity(option),
      equipped: false
    });

    updateBuilderCharacter({ equipment: nextEquipment });
    toast.success('Background equipment updated');
  };

  const toggleEquipment = (equipmentId: string) => {
    const currentEquipment = builderState.character?.equipment || [];
    const selected = currentEquipment.some((entry) => entry.equipmentId === equipmentId);

    const nextEquipment = selected
      ? currentEquipment.filter((entry) => entry.equipmentId !== equipmentId)
      : [...currentEquipment, { equipmentId, quantity: 1, equipped: false }];

    updateBuilderCharacter({ equipment: nextEquipment });
    toast.success(selected ? 'Equipment removed' : 'Equipment added');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose Equipment</h2>
        <p className="text-muted-foreground">
          Pick starting choices from your classes and add extra runtime equipment from imported or homebrew sources.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{selectedClasses.length} class kit{selectedClasses.length === 1 ? '' : 's'}</Badge>
          <Badge variant="outline">{selectedEquipmentCount} extra item{selectedEquipmentCount === 1 ? '' : 's'} selected</Badge>
        </div>
      </div>

      <div className="space-y-4">
        {selectedClasses.map((cls) => (
          <Card key={cls.id}>
            <CardHeader>
              <CardTitle>{cls.name} Starting Equipment</CardTitle>
              <CardDescription>
                {cls.equipmentOptions.length > 0
                  ? 'Choose from each multiple-choice group. Fixed class-kit items are included automatically.'
                  : 'No imported starting equipment choices are currently defined for this class.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cls.equipmentOptions.length > 0 ? (
                cls.equipmentOptions.map((group, groupIndex) => {
                  const selectedPrefix = `${cls.id}::${groupIndex}::`;
                  const selectedItems = (builderState.character?.equipment || []).filter((entry) => entry.equipmentId.startsWith(selectedPrefix));
                  const classEdition = getRulesEdition(cls.sourceId, cls.source);
                  const availableEquipment = equipment.filter((entry) => sourceMatchesSelection(entry.source, entry.sourceId, selectedSourceIds));

                  return (
                    <StartingEquipmentGroup
                      key={`${cls.id}-${groupIndex}`}
                      classId={cls.id}
                      group={group}
                      groupIndex={groupIndex}
                      selectedEquipmentIds={selectedItems.map((entry) => entry.equipmentId)}
                      availableEquipment={availableEquipment}
                      preferredEdition={classEdition}
                      onSelect={selectStartingEquipment}
                      onClear={clearStartingEquipmentSelection}
                    />
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No starting equipment choices are defined for this class.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Background Equipment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {background ? (
            <>
              {background.equipment.map((item, groupIndex) => {
                const selectedPrefix = `background::${background.id}::${groupIndex}::`;
                const selectedItem = (builderState.character?.equipment || []).find((entry) => entry.equipmentId.startsWith(selectedPrefix));
                const selectedSlug = getSelectedBackgroundEquipmentId(selectedItem?.equipmentId);
                const selectedResolvedEquipmentId = getSelectedBackgroundResolvedEquipmentId(selectedItem?.equipmentId);
                const availableEquipment = equipment.filter((entry) => sourceMatchesSelection(entry.source, entry.sourceId, selectedSourceIds));
                const choiceCandidates = getChoiceEquipmentCandidates(item, availableEquipment, getRulesEdition(background.sourceId, background.source));

                if (item.alternatives?.length) {
                  const selectedAlternative = item.alternatives.find((option) => slugify(option.name) === selectedSlug);
                  const embeddedChoiceOption = selectedAlternative ? getEmbeddedChoiceEquipmentOption(selectedAlternative) : null;
                  const embeddedChoiceCandidates = embeddedChoiceOption
                    ? getChoiceEquipmentCandidates(embeddedChoiceOption, availableEquipment, getRulesEdition(background.sourceId, background.source))
                    : [];

                  return (
                    <div key={`${item.name}-${groupIndex}`} className="space-y-3 rounded-lg border p-3">
                      <p className="mb-2 text-sm font-medium">{item.name}</p>
                      <Select
                        value={selectedSlug ?? ''}
                        onValueChange={(value) => {
                          const nextOption = item.alternatives?.find((option) => slugify(option.name) === value);
                          if (nextOption) {
                            selectBackgroundEquipment(background.id, groupIndex, nextOption);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose the background package" />
                        </SelectTrigger>
                        <SelectContent>
                          {item.alternatives.map((option) => (
                            <SelectItem key={`${option.name}-${option.type}`} value={slugify(option.name)}>
                              {option.count ? `${option.count} ` : ''}{option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedAlternative && embeddedChoiceCandidates.length > 0 ? (
                        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">Resolve the remaining choice inside this background package.</p>
                          <Select
                            value={selectedResolvedEquipmentId ?? ''}
                            onValueChange={(value) => selectBackgroundEquipment(background.id, groupIndex, selectedAlternative, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choose the specific item" />
                            </SelectTrigger>
                            <SelectContent>
                              {embeddedChoiceCandidates.map((entry) => (
                                <SelectItem key={`${selectedAlternative.name}-${entry.id}`} value={entry.id}>
                                  {entry.name} ({entry.source})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (choiceCandidates.length > 0) {
                  return (
                    <div key={`${item.name}-${groupIndex}`} className="rounded-lg border p-3 space-y-3">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Choose the specific item to add to your background equipment.</p>
                      </div>
                      <Select
                        value={selectedResolvedEquipmentId ?? ''}
                        onValueChange={(value) => selectBackgroundEquipment(background.id, groupIndex, item, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose the item" />
                        </SelectTrigger>
                        <SelectContent>
                          {choiceCandidates.map((entry) => (
                            <SelectItem key={`${item.name}-${entry.id}`} value={entry.id}>
                              {entry.name} ({entry.source})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedItem && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const prefix = `background::${background.id}::${groupIndex}::`;
                            const nextEquipment = (builderState.character?.equipment || []).filter((entry) => !entry.equipmentId.startsWith(prefix));
                            updateBuilderCharacter({ equipment: nextEquipment });
                            toast.success('Background equipment cleared');
                          }}
                        >
                          Clear choice
                        </Button>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={`${item.name}-${groupIndex}`} className="rounded-lg border p-3 text-sm text-muted-foreground">
                    • {item.count ? `${item.count} ` : ''}{item.name}
                  </div>
                );
              })}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a background to see its equipment package.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selected Equipment</CardTitle>
          <CardDescription>
            Mark armor, shields, and weapons as equipped so the character sheet can derive armor class and loadout from your current gear.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resolvedEquipmentSelections.length > 0 ? (
            <div className="space-y-2">
              {resolvedEquipmentSelections.map((entry) => (
                <div key={entry.equipmentId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{entry.name}</div>
                    <div className="text-xs text-muted-foreground">{entry.sourceLabel}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={entry.equipped ? 'default' : 'outline'}>
                      {entry.equipped ? 'Equipped' : 'Carried'}
                    </Badge>
                    {entry.item ? getEquipmentSemanticTags(entry.item).slice(0, 3).map((tag) => (
                      <Badge key={`${entry.equipmentId}-${tag}`} variant="secondary">
                        {tag}
                      </Badge>
                    )) : null}
                    {canEquipSelection(entry) && (
                      <Button type="button" variant="outline" size="sm" onClick={() => toggleEquipped(entry.equipmentId)}>
                        {entry.equipped ? 'Unequip' : 'Equip'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No equipment selected yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search equipment..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {equipmentTypes.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as EquipmentSortMode)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sort equipment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="type">Sort: Type</SelectItem>
            <SelectItem value="cost-asc">Sort: Cost</SelectItem>
            <SelectItem value="weight-asc">Sort: Weight</SelectItem>
            <SelectItem value="source">Sort: Source</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <SourceFilterBar selectedSourceIds={selectedSourceIds} onChange={(next) => updateBuilderState({ selectedSourceIds: next })} />

      <ScrollArea className="h-[32rem] rounded-lg border">
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEquipment.map((entry) => {
            const selected = isSelected(entry.id);

            return (
              <Card
                key={entry.id}
                className={`cursor-pointer transition-all hover:border-primary ${selected ? 'border-primary ring-1 ring-primary' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleEquipment(entry.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleEquipment(entry.id);
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Sword className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{entry.name}</CardTitle>
                        <CardDescription className="text-xs">{entry.source}</CardDescription>
                      </div>
                    </div>
                    {selected && <Badge>Selected</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex flex-wrap gap-2">
                    {getEquipmentSemanticTags(entry).slice(0, 4).map((tag) => (
                      <Badge key={`${entry.id}-${tag}`} variant={tag === entry.type ? 'secondary' : 'outline'}>{tag}</Badge>
                    ))}
                    <Badge variant="outline">{entry.cost.amount} {entry.cost.unit}</Badge>
                    <Badge variant="outline">{entry.weight} lb</Badge>
                  </div>
                  {entry.description && <p className="line-clamp-3 text-sm text-muted-foreground">{entry.description}</p>}
                  <Button variant={selected ? 'default' : 'outline'} size="sm" className="w-full">
                    {selected ? 'Selected' : 'Add Equipment'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {filteredEquipment.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No equipment found matching the current filters.
        </div>
      )}
    </div>
  );
}