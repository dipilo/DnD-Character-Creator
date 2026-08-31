import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listGroups } from '@/lib/api';
import type { Group } from '@/lib/api';

/**
 * A campaign's groups, and the one a `?group=` link is asking for.
 *
 * The Groups tab links into Schedule and Party this way, so a table can be looked at as a table
 * rather than as a slice of the whole campaign. A group id that no longer resolves reads as "no
 * filter" instead of an empty page.
 */
export function useCampaignGroups(campaignId: number) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!Number.isFinite(campaignId)) return;
    let cancelled = false;
    listGroups(campaignId)
      .then((result) => {
        if (!cancelled) setGroups(result);
      })
      .catch((e: unknown) => {
        // A filter is an enhancement; the page works unfiltered.
        console.warn('could not list groups', e instanceof Error ? e.message : e);
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const requested = Number(searchParams.get('group'));
  const selected = useMemo(
    () => (groups ?? []).find((group) => group.id === requested) ?? null,
    [groups, requested],
  );

  // Memoised: a fresh array every render would re-key the aggregate calendar's loader.
  const memberIds = useMemo(
    () => (selected ? selected.members.map((member) => member.id) : null),
    [selected],
  );

  const selectGroup = (groupId: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (groupId === null) next.delete('group');
    else next.set('group', String(groupId));
    setSearchParams(next, { replace: true });
  };

  return { groups: groups ?? [], selected, memberIds, selectGroup };
}
