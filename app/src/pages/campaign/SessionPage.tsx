// The table's live dice feed.
//
// While a session is open, every roll anybody at this campaign makes — on their sheet, on the dice
// page, anywhere — is posted to it, so the DM and the players read the same history. The watcher
// that posts them is started at boot (`startSessionBroadcast`); this page is where the session is
// started, ended and read.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dices, Play, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { SESSION_POLL_MS, useSessionStore } from '@/store/sessionStore';
import type { SessionRoll } from '@/lib/api';
import { useCampaignId } from './useCampaignData';

const formatTime = (iso: string) => {
  const parsed = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function RollRow({ roll }: Readonly<{ roll: SessionRoll }>) {
  const who = roll.character_name ?? roll.username ?? 'Someone';

  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b px-3 py-2 last:border-0">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">
          {who}: {roll.label}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">{roll.notation}</span>
          {roll.results.map((die, index) => (
            <Badge
              key={`${roll.id}-${index}`}
              variant="secondary"
              className={`tabular-nums ${die.dropped ? 'opacity-40 line-through' : ''}`}
            >
              d{die.sides}: {die.value}
            </Badge>
          ))}
        </div>
        {roll.note ? <p className="mt-1 text-xs text-muted-foreground">{roll.note}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-2xl font-bold tabular-nums leading-none">{roll.total}</p>
        <p className="text-xs text-muted-foreground">{formatTime(roll.rolled_at)}</p>
      </div>
    </div>
  );
}

export function SessionPage() {
  const campaignId = useCampaignId();
  const { session, history, canManage, rolls, loading, error, load, start, end, poll } = useSessionStore();
  const [name, setName] = useState('');

  useEffect(() => {
    if (!Number.isFinite(campaignId)) return;
    void load(campaignId);
  }, [campaignId, load]);

  // Polling is the whole live story: there is no socket, and a session runs for hours, so the feed
  // asks only for rolls newer than the last one it holds.
  useEffect(() => {
    if (!session) return undefined;
    const timer = setInterval(() => void poll(), SESSION_POLL_MS);
    return () => clearInterval(timer);
  }, [poll, session]);

  const startSession = useCallback(() => {
    void start(name.trim());
    setName('');
  }, [name, start]);

  const closed = useMemo(() => history.filter((entry) => !entry.is_open), [history]);
  const reversed = useMemo(() => [...rolls].reverse(), [rolls]);

  if (loading) {
    return <Spinner className="mx-auto my-12" />;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" className="min-h-11" onClick={() => void load(campaignId)}>Try again</Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Dices className="h-5 w-5" />
                {session ? session.name || 'Session in progress' : 'No session running'}
              </CardTitle>
              <CardDescription>
                While a session is running, every roll made by anyone at this table shows up here.
              </CardDescription>
            </div>
            {session ? <Badge>Started {formatTime(session.started_at)}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {session ? (
                <Button variant="outline" className="min-h-11" onClick={() => void end()}>
                  <Square className="mr-2 h-4 w-4" />
                  End session
                </Button>
              ) : (
                <>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Session name"
                    className="max-w-xs"
                    aria-label="Session name"
                  />
                  <Button className="min-h-11" onClick={startSession}>
                    <Play className="mr-2 h-4 w-4" />
                    Start session
                  </Button>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {session
                ? 'Your rolls are being shared with the table.'
                : 'The DM starts a session, and everyone’s rolls appear here while it runs.'}
            </p>
          )}
        </CardContent>
      </Card>

      {session ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rolls</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {/* Newest first: the roll somebody just made is the one being read, and a feed that
                grows downward has to be chased on a phone. */}
            <ScrollArea className="h-[26rem]">
              {reversed.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nothing rolled yet.
                </p>
              ) : (
                reversed.map((roll) => <RollRow key={roll.id} roll={roll} />)
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      {closed.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Past sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {closed.map((entry) => (
              <p key={entry.id} className="text-sm text-muted-foreground">
                {entry.name || 'Session'} — {formatTime(entry.started_at)}
                {entry.ended_at ? ` to ${formatTime(entry.ended_at)}` : ''}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
