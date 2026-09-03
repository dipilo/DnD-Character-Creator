import { useCallback } from 'react';
import { getMyPreGameForm, getPreGameFormSummary, listPreGameForms } from '@/lib/api';
import type { PreGameForm, PreGameFormSummary } from '@/lib/api';
import { useTaggedLoad } from './useTaggedLoad';

export function useMyPreGameForm(campaignId: number) {
  return useTaggedLoad<PreGameForm | null>(
    campaignId,
    true,
    useCallback((id: number) => getMyPreGameForm(id), []),
    'Could not load your Pre-Game Form.',
  );
}

/** The table's compiled answers. Every member may read this; nobody's name is on any line. */
export function usePreGameFormSummary(campaignId: number) {
  return useTaggedLoad<PreGameFormSummary>(
    campaignId,
    true,
    useCallback((id: number) => getPreGameFormSummary(id), []),
    'Could not load the table’s answers.',
  );
}

/** Every member's form with names. Only ever requested when the caller runs the campaign. */
export function useAllPreGameForms(campaignId: number, isOwner: boolean) {
  return useTaggedLoad<PreGameForm[]>(
    campaignId,
    isOwner,
    useCallback((id: number) => listPreGameForms(id), []),
    'Could not load the table’s forms.',
  );
}
