export { species, getSpeciesById, getSpeciesVariant } from './species';
export { classes, getClassById, getSubclass } from './classes';
export { backgrounds, getBackgroundById } from './backgrounds';

export { contentSourceManifest, sourceMatchesSelection, getContentSourceLabel } from './librarySources';

export { sourceFileRegistry, getSourceBuckets, getSourceBucketsById, getSourceEntryCount, getSourceFilesById } from './sourceHelpers';
export { getBundledSourceEntryCount, getStaticSourceEntryCount } from './bundledSourceCounts';
export {
	getRuntimeBackgroundById,
	getRuntimeBackgrounds,
	getRuntimeClassById,
	getRuntimeClasses,
	getRuntimeEquipmentById,
	getRuntimeEquipment,
	getRuntimeFeatById,
	getRuntimeFeats,
	getRuntimeLanguageNames,
	getRuntimeLanguages,
	getRuntimeMonsterById,
	getRuntimeCombatActions,
	getRuntimeMonsters,
	getRuntimeSpeciesById,
	getRuntimeSpeciesVariant,
	getRuntimeSpecies,
	getRuntimeSpellById,
	getRuntimeSpells,
	getRuntimeSubclass,
	getRuntimeSubclasses,
	resolveClassById,
	resolveSubclassById,
	useContentLibrary
} from './runtimeContent';

// Wiring, not re-export: `characterStore` must not drag this library into boot.
import { registerDndContentResolvers } from './contentResolvers';
import {
	getRuntimeBackgroundById as resolveBackground,
	getRuntimeClassById as resolveClass,
	getRuntimeFeatById as resolveFeat,
	getRuntimeFeats as resolveFeats,
	getRuntimeSpeciesById as resolveSpecies,
	getRuntimeSpeciesVariant as resolveSpeciesVariant,
	getRuntimeSubclass as resolveSubclass
} from './runtimeContent';

registerDndContentResolvers({
	getRuntimeBackgroundById: resolveBackground,
	getRuntimeClassById: resolveClass,
	getRuntimeFeatById: resolveFeat,
	getRuntimeFeats: resolveFeats,
	getRuntimeSpeciesById: resolveSpecies,
	getRuntimeSpeciesVariant: resolveSpeciesVariant,
	getRuntimeSubclass: resolveSubclass
});
