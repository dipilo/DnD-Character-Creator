import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createPlayer, previewAvailabilityFromText, updatePlayer } from '@/lib/api';
import type { AvailabilityBlock, Player, PlayerWritePayload } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TimeZoneField } from '@/components/schedule/TimeZoneField';
import { browserTimeZone } from '@/lib/timezones';
import { playerLabel } from '@/pages/campaign/useCampaignData';
import { useAuthStore } from '@/store/authStore';

interface PlayerEditorDialogProps {
  campaignId: number;
  /** null creates a new seat. */
  player: Player | null;
  open: boolean;
  /** The rest of the roster, for the "plays well with" pickers. */
  roster: Player[];
  onOpenChange: (open: boolean) => void;
  onSaved: (player: Player) => void;
}

/** The free-text fields, and the label each one carries in the form. */
const TEXT_FIELDS = [
  { key: 'discord', label: 'Discord handle', placeholder: 'name#0000' },
  { key: 'age', label: 'Age', placeholder: 'Optional' },
  { key: 'computer_access', label: 'Computer access', placeholder: 'Desktop, phone only, ...' },
  { key: 'pref_party_size', label: 'Preferred party size', placeholder: '4–5' },
  { key: 'pref_session_length', label: 'Preferred session length', placeholder: '3 hours' },
  { key: 'pref_vtt', label: 'Preferred VTT', placeholder: 'Roll20, Foundry, in person' },
] as const satisfies readonly { key: keyof PlayerWritePayload; label: string; placeholder: string }[];

type FormState = Record<string, string>;

/**
 * What a brand-new seat starts with. A seat is almost always the person creating it, so their own
 * device's timezone and — when they signed in with Discord, where the username *is* the handle —
 * their handle are filled in. Both are ordinary editable fields: a guess, not a fact.
 */
function seatDefaults(user: { username: string | null; discord_id: string | null } | null): Partial<FormState> {
  return {
    timezone: browserTimeZone(),
    discord: user?.discord_id ? (user.username ?? '') : '',
  };
}

function toFormState(player: Player | null, defaults: Partial<FormState> = {}): FormState {
  return {
    name: player?.name ?? '',
    discord: player?.discord ?? defaults.discord ?? '',
    timezone: player?.timezone ?? defaults.timezone ?? '',
    notes: player?.notes ?? '',
    age: player?.age ?? '',
    computer_access: player?.computer_access ?? '',
    pref_party_size: player?.pref_party_size ?? '',
    pref_session_length: player?.pref_session_length ?? '',
    pref_vtt: player?.pref_vtt ?? '',
    pref_play_with: player?.pref_play_with ?? '',
    pref_play_not_with: player?.pref_play_not_with ?? '',
  };
}

function formatBlock(block: AvailabilityBlock): string {
  const start = new Date(block.start_iso);
  const end = new Date(block.end_iso);
  const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time(start)} – ${time(end)}`;
}

/**
 * Edit one campaign seat.
 *
 * The notes field is also the availability source: the server can parse free text like
 * "Tuesdays and Thursdays after 7pm" into blocks. Those heuristics are loose (MERGE_PLAN.md §13),
 * so the parse is shown as a preview the player confirms rather than something that happens
 * silently on save — nothing is written unless "use these blocks" is ticked.
 */
export function PlayerEditorDialog({ open, onOpenChange, ...rest }: Readonly<PlayerEditorDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The form is keyed on the seat and remounted, which is how its state is reset — an effect
          that copied the seat into form state on open would be mirroring props into state. */}
      {open ? <PlayerEditorForm key={rest.player?.id ?? 'new'} onOpenChange={onOpenChange} {...rest} /> : null}
    </Dialog>
  );
}

type PlayerEditorFormProps = Omit<PlayerEditorDialogProps, 'open'>;

function PlayerEditorForm({
  campaignId,
  player,
  roster,
  onOpenChange,
  onSaved,
}: Readonly<PlayerEditorFormProps>) {
  const user = useAuthStore((state) => state.user);
  // Lazy, so the defaults are read once when the form mounts rather than on every keystroke.
  const [form, setForm] = useState<FormState>(() => toFormState(player, player ? {} : seatDefaults(user)));
  const [preview, setPreview] = useState<AvailabilityBlock[] | null>(null);
  const [usePreview, setUsePreview] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const otherPlayers = useMemo(() => roster.filter((p) => p.id !== player?.id), [roster, player?.id]);

  const setField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleParse = async () => {
    setParsing(true);
    try {
      const result = await previewAvailabilityFromText(form.notes, form.timezone);
      setPreview(result.availability);
      setUsePreview(result.availability.length > 0);
      if (result.availability.length === 0) {
        toast.info('Nothing in those notes read as availability');
      }
    } catch (e) {
      toast.error('Could not read those notes', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const payload: PlayerWritePayload = { ...form };
    if (usePreview && preview) {
      payload.availability_preview_blocks = preview;
    }
    try {
      const saved = player
        ? await updatePlayer(player.id, payload)
        : await createPlayer(campaignId, payload);
      toast.success(`Saved ${playerLabel(saved)}`);
      onSaved(saved);
    } catch (e) {
      toast.error('Could not save that seat', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
          <DialogTitle>{player ? `Edit ${playerLabel(player)}` : 'Add a seat'}</DialogTitle>
          <DialogDescription>
            Everything here is optional except the name. Notes double as the availability source.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55dvh] pr-4">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="player-name">Name</Label>
                <Input id="player-name" value={form.name} onChange={(e) => setField('name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="player-timezone">Timezone</Label>
                <TimeZoneField
                  id="player-timezone"
                  placeholder="Europe/London, CST, -06:00"
                  value={form.timezone}
                  onChange={(value) => setField('timezone', value)}
                />
              </div>
              {TEXT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`player-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`player-${field.key}`}
                    placeholder={field.placeholder}
                    value={form[field.key] ?? ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <Separator />

            <PlayerPicker
              id="pref-with"
              label="Plays well with"
              hint="The server matches these names to seats in the roster."
              value={form.pref_play_with}
              options={otherPlayers}
              onChange={(value) => setField('pref_play_with', value)}
            />
            <PlayerPicker
              id="pref-not-with"
              label="Would rather not play with"
              hint="Used by the group suggestion engine as a soft constraint."
              value={form.pref_play_not_with}
              options={otherPlayers}
              onChange={(value) => setField('pref_play_not_with', value)}
            />

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="player-notes">Notes and availability</Label>
              <Textarea
                id="player-notes"
                rows={4}
                placeholder="Free most evenings after 7pm CET, not Wednesdays"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={handleParse} disabled={parsing}>
                  {parsing ? 'Reading...' : 'Read availability from these notes'}
                </Button>
              </div>
            </div>

            {preview ? <PreviewList blocks={preview} checked={usePreview} onCheckedChange={setUsePreview} /> : null}
          </div>
        </ScrollArea>

      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || form.name.trim().length === 0}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface PlayerPickerProps {
  id: string;
  label: string;
  hint: string;
  value: string;
  options: Player[];
  onChange: (value: string) => void;
}

/**
 * Names as a comma-separated list, toggled from the roster. The server resolves the text back to
 * ids (`resolveNamesToPlayerIds`), so offering the real names is what makes that resolution land —
 * the old client asked for free text and let it miss.
 */
function PlayerPicker({ id, label, hint, value, options, onChange }: Readonly<PlayerPickerProps>) {
  const selected = useMemo(
    () => new Set(value.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)),
    [value],
  );

  const toggle = (player: Player) => {
    const name = playerLabel(player);
    const next = selected.has(name.toLowerCase())
      ? [...selected].filter((entry) => entry !== name.toLowerCase())
      : [...selected, name.toLowerCase()];
    // Rebuild from the roster so the stored text keeps each player's real capitalisation.
    const names: string[] = options
      .filter((p) => next.includes(playerLabel(p).toLowerCase()))
      .map((p) => playerLabel(p));
    onChange(names.join(', '));
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap gap-3">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground">No other seats in this campaign yet.</p>
        ) : null}
        {options.map((player) => (
          <label key={player.id} className="flex items-center gap-2 text-sm" htmlFor={`${id}-${player.id}`}>
            <Checkbox
              id={`${id}-${player.id}`}
              checked={selected.has(playerLabel(player).toLowerCase())}
              onCheckedChange={() => toggle(player)}
            />
            {playerLabel(player)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface PreviewListProps {
  blocks: AvailabilityBlock[];
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function PreviewList({ blocks, checked, onCheckedChange }: Readonly<PreviewListProps>) {
  if (blocks.length === 0) {
    return <p className="text-sm text-muted-foreground">Those notes did not read as availability.</p>;
  }
  return (
    <div className="space-y-2 rounded-md border p-3">
      <label className="flex items-center gap-2 text-sm font-medium" htmlFor="use-parsed-availability">
        <Checkbox
          id="use-parsed-availability"
          checked={checked}
          onCheckedChange={(state) => onCheckedChange(state === true)}
        />
        Replace this seat's imported availability with these {blocks.length} blocks
      </label>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
        {blocks.map((block) => (
          <li key={`${block.start_iso}-${block.end_iso}`}>{formatBlock(block)}</li>
        ))}
      </ul>
    </div>
  );
}
