import { useMemo, useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { resolveClassById, resolveSubclassById, useContentLibrary } from '@/data';
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
import { Search, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { applyAbilityScoreBonuses, getSelectedClassEdition, getSpellcastingRulesSummary, resolveCharacterClasses, type SelectedClassWithLevel } from '@/lib/builderRules';
import { dedupeByNamePreferringEdition } from '@/lib/contentSelection';

type SpellSortMode = 'level-asc' | 'level-desc' | 'name' | 'source';

const formatSpellLevel = (level: number) => (level === 0 ? 'Cantrip' : `Level ${level}`);
const normalizeName = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();

export function SpellsSelectionPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SpellSortMode>('level-asc');
  const [ritualOnly, setRitualOnly] = useState(false);
  const [concentrationOnly, setConcentrationOnly] = useState(false);
  const { builderState, updateBuilderCharacter, updateBuilderState } = useCharacterStore();
  const selectedSourceIds = builderState.selectedSourceIds;
  const { classes, spells } = useContentLibrary();

  const selectedClasses = useMemo<SelectedClassWithLevel[]>(() => {
    // Canonical lookup, not an exact id match: a character holding an older class id otherwise
    // reads as having no spellcasting class at all and the step says "select a spellcasting class".
    return resolveCharacterClasses({
      classes: builderState.character?.classes ?? [],
      getClassById: (classId) => resolveClassById(classes, classId),
      getSubclassById: (classId, subclassId) => resolveSubclassById(classes, classId, subclassId)
    }).map(({ entry, cls, subclass }) => ({
      cls,
      level: entry.level,
      subclassId: entry.subclassId,
      subclass
    }));
  }, [builderState.character?.classes, classes]);

  const spellMap = useMemo(() => new Map(spells.map((spell) => [spell.id, spell])), [spells]);
  const effectiveAbilityScores = useMemo(() => {
    return applyAbilityScoreBonuses(builderState.character?.abilityScores, builderState.character?.abilityScoreBonuses);
  }, [builderState.character?.abilityScoreBonuses, builderState.character?.abilityScores]);

  const spellRules = useMemo(() => {
    return getSpellcastingRulesSummary({
      selectedClasses,
      abilityScores: effectiveAbilityScores,
      selectedSpells: builderState.character?.spells || [],
      getSpellById: (spellId) => spellMap.get(spellId)
    });
  }, [builderState.character?.spells, effectiveAbilityScores, selectedClasses, spellMap]);

  const leveledSpellDisplay = spellRules.leveledSpellLimit === undefined
    ? `${spellRules.selectedLeveledSpells} selected`
    : `${spellRules.selectedLeveledSpells} / ${spellRules.leveledSpellLimit}`;

  const availableClassNames = useMemo(() => [...spellRules.availableClassNames].sort((left, right) => left.localeCompare(right)), [spellRules.availableClassNames]);
  const normalizedAvailableClassNames = useMemo(() => {
    return new Set(availableClassNames.map((entry) => normalizeName(entry)));
  }, [availableClassNames]);
  const schoolOptions = useMemo(() => Array.from(new Set(spells.map((spell) => spell.school))).sort((left, right) => left.localeCompare(right)), [spells]);

  const selectedClassEdition = useMemo(() => getSelectedClassEdition(selectedClasses), [selectedClasses]);

  const filteredSpells = useMemo(() => {
    const matchingSpells = spells.filter((spell) => {
      const matchesSearch =
        spell.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spell.school.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spell.source.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSource = sourceMatchesSelection(spell.source, spell.sourceId, selectedSourceIds);
      const matchesClass = normalizedAvailableClassNames.size > 0
        && spell.classes.some((entry) => normalizedAvailableClassNames.has(normalizeName(entry)));
      const matchesUnlockedLevel = spell.level === 0 || spell.level <= spellRules.maxSelectableSpellLevel;
      const matchesLevelFilter = levelFilter === 'all' || String(spell.level) === levelFilter;
      const matchesSchool = schoolFilter === 'all' || spell.school === schoolFilter;
      const matchesClassFilter = classFilter === 'all'
        || spell.classes.some((entry) => normalizeName(entry) === normalizeName(classFilter));
      const matchesRitual = !ritualOnly || spell.ritual;
      const matchesConcentration = !concentrationOnly || spell.concentration;

      return matchesSearch
        && matchesSource
        && matchesClass
        && matchesUnlockedLevel
        && matchesLevelFilter
        && matchesSchool
        && matchesClassFilter
        && matchesRitual
        && matchesConcentration;
    });

    // Both editions of the same spell can pass the filters; show one card, preferring the
    // printing that matches the selected class's rules edition.
    const nextSpells = dedupeByNamePreferringEdition(matchingSpells, selectedClassEdition);

    nextSpells.sort((left, right) => {
      if (sortBy === 'name') {
        return left.name.localeCompare(right.name);
      }
      if (sortBy === 'source') {
        return left.source.localeCompare(right.source) || left.name.localeCompare(right.name);
      }
      if (sortBy === 'level-desc') {
        return right.level - left.level || left.name.localeCompare(right.name);
      }
      return left.level - right.level || left.name.localeCompare(right.name);
    });

    return nextSpells;
  }, [classFilter, concentrationOnly, levelFilter, normalizedAvailableClassNames, ritualOnly, schoolFilter, searchQuery, selectedClassEdition, selectedSourceIds, sortBy, spellRules.maxSelectableSpellLevel, spells]);

  const isSelected = (spellId: string) => {
    return (builderState.character?.spells || []).some((spell) => spell.spellId === spellId);
  };

  const getUnavailableReason = (spellId: string) => {
    const spell = spellMap.get(spellId);
    if (!spell) {
      return 'Spell data is unavailable.';
    }
    if (spellRules.classes.length === 0) {
      return 'Select a spellcasting class first.';
    }
    if (spell.level > 0 && spell.level > spellRules.maxSelectableSpellLevel) {
      return 'Your current class levels do not unlock this spell level yet.';
    }
    if (spell.level === 0 && spellRules.cantripLimit <= 0) {
      return 'You do not currently have any cantrip selections available.';
    }
    if (spell.level === 0 && !isSelected(spell.id) && spellRules.selectedCantrips >= spellRules.cantripLimit) {
      return 'You have already selected the maximum number of cantrips for your current class levels.';
    }
    if (spell.level > 0 && spellRules.leveledSpellLimit !== undefined && !isSelected(spell.id) && spellRules.selectedLeveledSpells >= spellRules.leveledSpellLimit) {
      return 'You have already filled your current prepared or known spell selections.';
    }
    return undefined;
  };

  const toggleSpell = (spellId: string) => {
    const currentSpells = builderState.character?.spells || [];
    const selected = currentSpells.some((spell) => spell.spellId === spellId);
    const unavailableReason = getUnavailableReason(spellId);

    if (!selected && unavailableReason) {
      toast.error(unavailableReason);
      return;
    }

    const nextSpells = selected
      ? currentSpells.filter((spell) => spell.spellId !== spellId)
      : [...currentSpells, { spellId, prepared: true }];

    updateBuilderCharacter({ spells: nextSpells });
    toast.success(selected ? 'Spell removed' : 'Spell added');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose Spells</h2>
        <p className="text-muted-foreground">
          The list is filtered automatically by your spellcasting classes and the spell levels they currently unlock.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Spellcasting Summary</CardTitle>
          <CardDescription>
            Limits are based on your current class levels. Prepared casters use the builder&apos;s current preparation estimate from class level and spellcasting ability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {spellRules.classes.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {spellRules.classes.map((entry) => (
                  <Badge key={`${entry.classId}-${entry.level}`} variant="secondary">
                    {entry.className} {entry.level}
                  </Badge>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs uppercase text-muted-foreground">Cantrips</p>
                  <p className="text-lg font-semibold">{spellRules.selectedCantrips} / {spellRules.cantripLimit}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs uppercase text-muted-foreground">Leveled Spells</p>
                  <p className="text-lg font-semibold">{leveledSpellDisplay}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs uppercase text-muted-foreground">Highest Spell Level</p>
                  <p className="text-lg font-semibold">{spellRules.maxSelectableSpellLevel > 0 ? formatSpellLevel(spellRules.maxSelectableSpellLevel) : 'None'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {spellRules.slotsByLevel
                  .map((slotCount, index) => ({ slotCount, index }))
                  .filter(({ slotCount }) => slotCount > 0)
                  .map(({ slotCount, index }) => (
                  <Badge key={`spell-slot-${index + 1}`} variant="outline">
                    Spell Slots {index + 1}: {slotCount}
                  </Badge>
                ))}
                {spellRules.pactSlotsByLevel
                  .map((slotCount, index) => ({ slotCount, index }))
                  .filter(({ slotCount }) => slotCount > 0)
                  .map(({ slotCount, index }) => (
                  <Badge key={`pact-slot-${index + 1}`} variant="secondary">
                    Pact Slots {index + 1}: {slotCount}
                  </Badge>
                ))}
              </div>
              {spellRules.multiclassCasterLevel > 0 && spellRules.classes.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Shared spell slots use multiclass caster level {spellRules.multiclassCasterLevel}. Spell selection still follows each class&apos;s own unlocked spell levels.
                </p>
              )}
            </>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              Select a spellcasting class to unlock spell choices.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search spells..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Spell level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="0">Cantrips</SelectItem>
            {Array.from({ length: Math.max(spellRules.maxSelectableSpellLevel, 1) }, (_, index) => index + 1).map((level) => (
              <SelectItem key={level} value={String(level)}>{formatSpellLevel(level)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={schoolFilter} onValueChange={setSchoolFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="School" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {schoolOptions.map((school) => (
              <SelectItem key={school} value={school}>{school}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Spellcasting Classes</SelectItem>
            {availableClassNames.map((className) => (
              <SelectItem key={className} value={className}>{className}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SpellSortMode)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sort spells" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="level-asc">Sort: Level ↑</SelectItem>
            <SelectItem value="level-desc">Sort: Level ↓</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="source">Sort: Source</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={ritualOnly ? 'default' : 'outline'} size="sm" onClick={() => setRitualOnly((current) => !current)}>
          Ritual Only
        </Button>
        <Button type="button" variant={concentrationOnly ? 'default' : 'outline'} size="sm" onClick={() => setConcentrationOnly((current) => !current)}>
          Concentration Only
        </Button>
      </div>

      <SourceFilterBar selectedSourceIds={selectedSourceIds} onChange={(next) => updateBuilderState({ selectedSourceIds: next })} />

      <ScrollArea className="h-[32rem] rounded-lg border">
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSpells.map((spell) => {
            const selected = isSelected(spell.id);
            const unavailableReason = selected ? undefined : getUnavailableReason(spell.id);
            let actionLabel = 'Add Spell';
            if (selected) {
              actionLabel = 'Selected';
            } else if (unavailableReason) {
              actionLabel = 'Unavailable';
            }

            return (
              <Card
                key={spell.id}
                className={`cursor-pointer transition-all hover:border-primary ${selected ? 'border-primary ring-1 ring-primary' : ''} ${unavailableReason ? 'opacity-75' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleSpell(spell.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleSpell(spell.id);
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Wand2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{spell.name}</CardTitle>
                        <CardDescription className="text-xs">{spell.source}</CardDescription>
                      </div>
                    </div>
                    {selected && <Badge>Selected</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{formatSpellLevel(spell.level)}</Badge>
                    <Badge variant="outline">{spell.school}</Badge>
                    {spell.ritual && <Badge variant="outline">Ritual</Badge>}
                    {spell.concentration && <Badge variant="outline">Concentration</Badge>}
                  </div>
                  <p className="line-clamp-3 text-sm text-muted-foreground">{spell.description}</p>
                  <div className="text-xs text-muted-foreground">
                    Classes: {spell.classes.join(', ') || 'None listed'}
                  </div>
                  {unavailableReason && <p className="text-xs text-amber-600 dark:text-amber-400">{unavailableReason}</p>}
                  <Button variant={selected ? 'default' : 'outline'} size="sm" className="w-full">
                    {actionLabel}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {filteredSpells.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No spells found matching the current filters.
        </div>
      )}
    </div>
  );
}