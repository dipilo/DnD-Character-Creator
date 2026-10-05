// The builder's step rail.
//
// It lives here rather than in `CharacterBuilderPage` because the draft banner resumes a recovered
// character by step id, and a `.tsx` may export components and nothing else.

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

/**
 * Where a recorded step id resumes. A stored id is validated against the rail rather than trusted:
 * it is read back out of localStorage, where a build from any earlier version may have written it.
 */
export function builderStepPath(id: string | undefined): string {
  return builderSteps.find((step) => step.id === id)?.path ?? builderSteps[0].path;
}

export function builderStepName(id: string | undefined): string {
  return builderSteps.find((step) => step.id === id)?.name ?? builderSteps[0].name;
}
