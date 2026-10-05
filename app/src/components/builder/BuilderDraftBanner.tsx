import { useNavigate } from 'react-router-dom';
import { FileClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dndContent } from '@/data/contentResolvers';
import { hasResumableDraft } from '@/lib/builderDraft';
import { builderStepName, builderStepPath } from '@/lib/builderSteps';
import { cn } from '@/lib/utils';
import { useCharacterStore } from '@/store/characterStore';

/**
 * The character that was being built when the page last went away.
 *
 * The builder's state is persisted now, so the draft is already loaded and the player's choices
 * are where they left them. This says so: a recovered draft that nobody announces reads as the
 * builder having gone wrong, and a player who wanted a fresh character needs somewhere to say so.
 *
 * `variant` is which half of the job it is doing. Inside the builder the draft is already on
 * screen, so it offers the step it was left on; from My Characters it is an offer to go back to it.
 */
export function BuilderDraftBanner({ className, variant }: Readonly<{ className?: string; variant: 'builder' | 'library' }>) {
  const navigate = useNavigate();
  const builderState = useCharacterStore((state) => state.builderState);
  const resetBuilder = useCharacterStore((state) => state.resetBuilder);

  // An edit session is not unfinished work: the character it writes to is already saved, and the
  // shell says whose it is and offers Discard Changes of its own.
  if (builderState.editingCharacterId || !hasResumableDraft(builderState)) return null;

  const character = builderState.character;
  const name = character.name?.trim() || 'An unnamed character';
  const species = character.speciesId ? dndContent().getRuntimeSpeciesById(character.speciesId) : undefined;
  const classLabel = character.classes?.[0]
    ? dndContent().getRuntimeClassById(character.classes[0].classId)?.name
    : undefined;
  const descriptors = [species?.name, classLabel].filter(Boolean).join(' ');
  const stepName = builderStepName(builderState.currentStep);
  const summary = descriptors ? `${name} — ${descriptors}` : name;

  return (
    <div role="status" className={cn('flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm', className)}>
      <FileClock className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        {variant === 'builder'
          ? <>Picking up your unfinished character, <strong>{summary}</strong>. It is saved on this device until you create it.</>
          : <>You have an unfinished character, <strong>{summary}</strong>, waiting on the {stepName} step.</>}
      </span>
      {/* The builder's own header already carries Start Over, so only the library needs buttons. */}
      {variant === 'library' ? (
        <>
          <Button size="sm" onClick={() => navigate(builderStepPath(builderState.currentStep))}>
            Resume
          </Button>
          <Button variant="ghost" size="sm" onClick={resetBuilder}>
            Discard
          </Button>
        </>
      ) : null}
    </div>
  );
}
