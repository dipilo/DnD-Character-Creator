// Here, not in the page: a `.tsx` may export components and nothing else.

export const builderSteps = [
  { id: 'species', name: 'Species', path: '/builder/species' },
  { id: 'class', name: 'Class', path: '/builder/class' },
  { id: 'background', name: 'Background', path: '/builder/background' },
  { id: 'ability-scores', name: 'Ability Scores', path: '/builder/ability-scores' },
  { id: 'advancements', name: 'Feats', path: '/builder/advancements' },
  { id: 'spells', name: 'Spells', path: '/builder/spells' },
  { id: 'equipment', name: 'Equipment', path: '/builder/equipment' },
  { id: 'review', name: 'Review', path: '/builder/review' },
] as const;

export type BuilderRailStepId = (typeof builderSteps)[number]['id'];

/** Which rail step a builder route belongs to, or undefined for a route outside the rail. */
export function builderStepIdForPath(pathname: string): BuilderRailStepId | undefined {
  // A subclass is chosen from inside the Class step, so its routes sit under that one.
  if (pathname.startsWith('/builder/subclass')) return 'class';
  return builderSteps.find((step) => pathname.startsWith(step.path))?.id;
}

/** Validated against the rail: any earlier version may have written it. */
export function builderStepPath(id: string | undefined): string {
  return builderSteps.find((step) => step.id === id)?.path ?? builderSteps[0].path;
}

export function builderStepName(id: string | undefined): string {
  return builderSteps.find((step) => step.id === id)?.name ?? builderSteps[0].name;
}

/** From the one derivation the sheet and the builder share. */
export function outstandingByBuilderStep(
  tasks: readonly { href: string; count: number }[],
): Partial<Record<BuilderRailStepId, number>> {
  const totals: Partial<Record<BuilderRailStepId, number>> = {};
  for (const task of tasks) {
    const id = builderStepIdForPath(task.href);
    if (!id) continue;
    totals[id] = (totals[id] ?? 0) + task.count;
  }
  return totals;
}
