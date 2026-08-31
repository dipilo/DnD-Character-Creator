import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AggregateCalendar } from '@/components/schedule/AggregateCalendar';
import { AvailabilityCalendar } from '@/components/schedule/AvailabilityCalendar';
import { ScheduleSettings } from '@/components/schedule/ScheduleSettings';
import { useCalendarLayout } from '@/components/schedule/useCalendarLayout';
import { useCampaignGroups } from '@/hooks/useCampaignGroups';
import { isCampaignOwner, membershipPlayerId, useCampaignStore } from '@/store/campaignStore';
import { playerLabel, useCampaignId, useRoster } from '@/pages/campaign/useCampaignData';

/** Radix rejects an empty item value, so "no group filter" needs a value of its own. */
const ALL_GROUPS = 'all';

export function SchedulePage() {
  const campaignId = useCampaignId();
  const membership = useCampaignStore((state) => state.membership);
  const { players, loading, error } = useRoster(campaignId);
  const [searchParams, setSearchParams] = useSearchParams();

  const ownSeatId = membershipPlayerId(membership);
  const isOwner = isCampaignOwner(membership);

  // The roster page links here with ?player=…; otherwise default to the viewer's own seat.
  const requestedId = Number(searchParams.get('player'));
  const selectedId = Number.isFinite(requestedId) && requestedId > 0 ? requestedId : ownSeatId;
  const selected = useMemo(() => players.find((p) => p.id === selectedId) ?? null, [players, selectedId]);

  // The Groups tab links here with ?group=…, so a table can be read as a table.
  const { groups, selected: selectedGroup, memberIds: groupMemberIds, selectGroup } = useCampaignGroups(campaignId);

  const [filterToSelected, setFilterToSelected] = useState(false);
  // Memoised because a fresh array every render would re-key the aggregate calendar's loader. The
  // seat filter is the narrower of the two, so it wins where both are on.
  const aggregateFilter = useMemo(() => {
    if (filterToSelected && selected) return [selected.id];
    return groupMemberIds;
  }, [filterToSelected, selected, groupMemberIds]);

  // Owners edit any seat; everyone else edits only their own.
  const canEditSelected = Boolean(selected) && (isOwner || selected?.id === ownSeatId);

  // The gestures differ by pointer type, so the instructions have to as well — "Ctrl-click" is
  // not something a phone can do, and it was the only place the repeat action was named.
  const { isTouch } = useCalendarLayout();
  let editingHint = "You can look at this seat's availability but not change it.";
  if (canEditSelected && isTouch) {
    editingHint = 'Press and hold to add a block, drag its edges to resize, tap one for its actions.';
  } else if (canEditSelected) {
    editingHint = 'Drag to add a block, click one to delete it, drag its edges to resize. Ctrl-click a block to repeat it weekly.';
  }

  const chooseSeat = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('player', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4 short:space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3 short:flex-nowrap">
        <div className="w-full min-w-0 space-y-1.5 sm:w-auto sm:min-w-56">
          {/* The select shows the seat's name, so on a landscape phone the label is the first
              thing to go — the calendar needs the rows more than the caption does. */}
          <span className="text-sm font-medium short:hidden">Seat</span>
          <Select value={selected ? String(selected.id) : ''} onValueChange={chooseSeat}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Choose a seat" />
            </SelectTrigger>
            <SelectContent>
              {players.map((player) => (
                <SelectItem key={player.id} value={String(player.id)}>
                  {playerLabel(player)}
                  {player.id === ownSeatId ? ' (you)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {groups.length > 0 ? (
          <div className="w-full min-w-0 space-y-1.5 sm:w-auto">
            <span className="text-sm font-medium short:hidden">Group</span>
            <Select
              value={selectedGroup ? String(selectedGroup.id) : ALL_GROUPS}
              onValueChange={(value) => selectGroup(value === ALL_GROUPS ? null : Number(value))}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GROUPS}>Everyone in the campaign</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={String(group.id)}>
                    {group.name || 'Unnamed group'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <ScheduleSettings
          filterAggregate={filterToSelected}
          onFilterAggregateChange={setFilterToSelected}
        />
      </div>

      {loading ? (
        <output className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading the roster...
        </output>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && players.length === 0 ? (
        <Alert>
          <AlertTitle>Nobody in this campaign yet</AlertTitle>
          <AlertDescription>Add seats on the Roster tab, then availability can go on them.</AlertDescription>
        </Alert>
      ) : null}

      {!loading && players.length > 0 && !selected ? (
        <Alert>
          <AlertTitle>You do not hold a seat here</AlertTitle>
          <AlertDescription>
            Claim one on the Roster tab to record your own availability, or pick a seat above to
            look at someone else's.
          </AlertDescription>
        </Alert>
      ) : null}

      {selected ? (
        <Tabs defaultValue="own">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="own" className="flex-1 sm:flex-none">
              <span className="truncate">{playerLabel(selected)}</span>
            </TabsTrigger>
            <TabsTrigger value="everyone" className="flex-1 sm:flex-none">
              <span className="truncate">{selectedGroup ? selectedGroup.name || 'This group' : 'Everyone'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="own" className="space-y-2">
            {editingHint ? <p className="text-xs text-muted-foreground short:hidden">{editingHint}</p> : null}
            <AvailabilityCalendar player={selected} campaignId={campaignId} editable={canEditSelected} />
          </TabsContent>

          <TabsContent value="everyone" className="space-y-2">
            <AggregateCalendar campaignId={campaignId} players={players} playerFilter={aggregateFilter} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
