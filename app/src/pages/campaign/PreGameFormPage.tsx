import { useCallback, useMemo, useState } from 'react';
import { ClipboardList, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { kob } from '@/data/gameSystems/kidsOnBikes/rules';
import { savePreGameForm } from '@/lib/api';
import type { PreGameFormData, PreGameFormList } from '@/lib/api';
import { isCampaignOwner, useCampaignStore } from '@/store/campaignStore';
import { useCampaignId } from './useCampaignData';
import { useAllPreGameForms, useMyPreGameForm, usePreGameFormSummary } from './usePreGameForm';

const EMPTY_LIST: PreGameFormList = { warnings: [], notes: [] };

function listOf(data: PreGameFormData | null | undefined, id: string): PreGameFormList {
  return data?.lists?.[id] ?? EMPTY_LIST;
}

function withList(data: PreGameFormData, id: string, list: PreGameFormList): PreGameFormData {
  return { lists: { ...data.lists, [id]: list } };
}

/**
 * The Pre-Game Form, from Appendix A of the rulebook.
 *
 * Three views of the same answers, and which of them a member sees is the point of the screen:
 * their own form, the table's compiled answers with no names on them, and — for whoever runs the
 * campaign — each person's form as they wrote it. The merge is assembled by the server, so the
 * first two never carry anybody else's document.
 */
export function PreGameFormPage() {
  const campaignId = useCampaignId();
  const { membership } = useCampaignStore();
  const owner = isCampaignOwner(membership);

  const mine = useMyPreGameForm(campaignId);
  const summary = usePreGameFormSummary(campaignId);
  const everyone = useAllPreGameForms(campaignId, owner);

  const form = kob.preGameForm;

  if (form.lists.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pre-Game Form</CardTitle>
          <CardDescription>
            The rulebook’s appendix did not import, so there is nothing to fill in yet. Re-run
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">npm run import:kids-on-bikes</code>
            with the rulebook beside the vault.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold short:text-base">
          <ClipboardList className="h-5 w-5" />
          {form.title || 'Pre-Game Form'}
        </h2>
        {form.intro ? <p className="text-sm text-muted-foreground">{form.intro}</p> : null}
      </div>

      <Tabs defaultValue="mine">
        <TabsList className="scroll-strip [&>*]:flex-none">
          <TabsTrigger value="mine" className="coarse:min-h-11">Your form</TabsTrigger>
          <TabsTrigger value="table" className="coarse:min-h-11">The table</TabsTrigger>
          {owner ? <TabsTrigger value="everyone" className="coarse:min-h-11">Everyone</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="mine" className="mt-4">
          <MyForm campaignId={campaignId} state={mine} onSaved={summary.reload} />
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <CompiledAnswers state={summary} />
        </TabsContent>

        {owner ? (
          <TabsContent value="everyone" className="mt-4">
            <EveryonesForms state={everyone} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

interface MyFormProps {
  campaignId: number;
  state: ReturnType<typeof useMyPreGameForm>;
  onSaved: () => void;
}

/**
 * The editor is mounted only once its answers have arrived, and it is keyed on the campaign, so
 * the loaded form seeds `useState` directly. Copying it in from an effect would be mirroring props
 * into state, which is the rule the rest of the campaign pages already follow.
 */
function MyForm({ campaignId, state, onSaved }: Readonly<MyFormProps>) {
  if (state.loading) return <LoadingCard label="Loading your form..." />;
  if (state.error) return <ErrorCard message={state.error} onRetry={state.reload} />;
  return (
    <MyFormEditor
      key={campaignId}
      campaignId={campaignId}
      initial={state.data?.data ?? { lists: {} }}
      onSaved={onSaved}
    />
  );
}

interface MyFormEditorProps {
  campaignId: number;
  initial: PreGameFormData;
  onSaved: () => void;
}

function MyFormEditor({ campaignId, initial, onSaved }: Readonly<MyFormEditorProps>) {
  const [draft, setDraft] = useState<PreGameFormData>(initial);
  const [saving, setSaving] = useState(false);

  const setList = useCallback((id: string, list: PreGameFormList) => {
    setDraft((current) => withList(current, id, list));
  }, []);

  const save = () => {
    setSaving(true);
    savePreGameForm(campaignId, draft)
      .then(() => {
        toast.success('Your Pre-Game Form is saved.');
        onSaved();
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Could not save your form.');
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Your answers go to the table without your name on them. Whoever runs the campaign sees the
        form as you wrote it.
      </p>
      {kob.preGameForm.lists.map((list) => (
        <ListEditor
          key={list.id}
          name={list.name}
          prompt={list.prompt}
          list={listOf(draft, list.id)}
          onChange={(next) => setList(list.id, next)}
        />
      ))}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="min-h-11 coarse:min-h-11">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

interface ListEditorProps {
  name: string;
  prompt: string;
  list: PreGameFormList;
  onChange: (list: PreGameFormList) => void;
}

function ListEditor({ name, prompt, list, onChange }: Readonly<ListEditorProps>) {
  const [note, setNote] = useState('');
  const selected = useMemo(() => new Set(list.warnings), [list.warnings]);

  const toggle = (warning: string) => {
    const warnings = selected.has(warning)
      ? list.warnings.filter((entry) => entry !== warning)
      : [...list.warnings, warning];
    onChange({ ...list, warnings });
  };

  const addNote = () => {
    const trimmed = note.trim();
    if (!trimmed || list.notes.includes(trimmed)) return;
    onChange({ ...list, notes: [...list.notes, trimmed] });
    setNote('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{name}</CardTitle>
        <CardDescription>{prompt}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {list.notes.map((entry) => (
            <Badge key={entry} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
              {entry}
              <button
                type="button"
                aria-label={`Remove ${entry}`}
                className="rounded-sm p-1 hover:bg-background/60 coarse:min-h-11 coarse:min-w-11 coarse:p-3"
                onClick={() => onChange({ ...list, notes: list.notes.filter((n) => n !== entry) })}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="flex items-start gap-2">
          <Label htmlFor={`note-${name}`} className="sr-only">
            Add to {name}
          </Label>
          <Input
            id={`note-${name}`}
            value={note}
            placeholder="Add your own"
            className="coarse:min-h-11"
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addNote();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addNote} className="min-h-11 coarse:min-h-11">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <WarningPicker name={name} selected={selected} onToggle={toggle} />
      </CardContent>
    </Card>
  );
}

interface WarningPickerProps {
  name: string;
  selected: Set<string>;
  onToggle: (warning: string) => void;
}

/** Appendix B's list, offered under every list because the form says to reference it from each. */
function WarningPicker({ name, selected, onToggle }: Readonly<WarningPickerProps>) {
  const [open, setOpen] = useState(false);
  const warnings = kob.preGameForm.contentWarnings;
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11 px-0 coarse:min-h-11"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'Hide' : 'Choose from'} the content warning list
        {selected.size > 0 ? <Badge variant="secondary">{selected.size}</Badge> : null}
      </Button>
      {open ? (
        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
          {warnings.map((warning) => {
            const id = `${name}-${warning}`;
            return (
              <label key={warning} htmlFor={id} className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox id={id} checked={selected.has(warning)} onCheckedChange={() => onToggle(warning)} />
                {warning}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CompiledAnswers({ state }: Readonly<{ state: ReturnType<typeof usePreGameFormSummary> }>) {
  if (state.loading) return <LoadingCard label="Loading the table’s answers..." />;
  if (state.error) return <ErrorCard message={state.error} onRetry={state.reload} />;

  const summary = state.data;
  const respondents = summary?.respondents ?? 0;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {respondents === 1 ? '1 person has answered.' : `${respondents} people have answered.`}
      </p>
      {kob.preGameForm.lists.map((list) => {
        const entries = summary?.lists?.[list.id] ?? [];
        return (
          <Card key={list.id}>
            <CardHeader>
              <CardTitle className="text-base">{list.name}</CardTitle>
              <CardDescription>{list.prompt}</CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {entries.map((entry) => (
                    <Badge key={entry} variant="secondary">
                      {entry}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function EveryonesForms({ state }: Readonly<{ state: ReturnType<typeof useAllPreGameForms> }>) {
  if (state.loading) return <LoadingCard label="Loading the table’s forms..." />;
  if (state.error) return <ErrorCard message={state.error} onRetry={state.reload} />;

  const forms = state.data ?? [];
  if (forms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Nobody has filled one in yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {forms.map((entry) => (
        <Card key={entry.user_id}>
          <CardHeader>
            <CardTitle className="text-base">{entry.owner_name ?? `Member #${entry.user_id}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kob.preGameForm.lists.map((list) => {
              const own = listOf(entry.data, list.id);
              const all = [...own.warnings, ...own.notes];
              if (all.length === 0) return null;
              return (
                <div key={list.id} className="space-y-1">
                  <p className="text-sm font-medium">{list.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {all.map((line) => (
                      <Badge key={line} variant="outline">
                        {line}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LoadingCard({ label }: Readonly<{ label: string }>) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner className="size-4" />
      {label}
    </div>
  );
}

function ErrorCard({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={onRetry} className="min-h-11 coarse:min-h-11">
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
