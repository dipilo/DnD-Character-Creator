// One derivation for the sheet and the builder; opens closed past a handful.
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AdvancementTask } from '@/lib/characterAdvancement';

/** More than this and the list starts closed. */
const ALWAYS_OPEN_UP_TO = 3;

interface AdvancementTasksProps {
  readonly tasks: readonly AdvancementTask[];
  /** The sheet passes a handler, since it must load the character first; the builder links. */
  readonly onOpen?: (href: string) => void;
  readonly title?: string;
}

export function AdvancementTasks({ tasks, onOpen, title = 'Unfinished choices' }: AdvancementTasksProps) {
  if (tasks.length === 0) return null;

  const total = tasks.reduce((sum, task) => sum + task.count, 0);
  const summary = total === 1 ? 'One choice from your levels is still open' : `${total} choices from your levels are still open`;

  return (
    <Card className="border-amber-500/60 bg-amber-500/5">
      <Collapsible defaultOpen={tasks.length <= ALWAYS_OPEN_UP_TO}>
        <CardContent className="space-y-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded text-left transition-colors hover:bg-accent/40 [&[data-state=open]>svg]:rotate-180"
            >
              <span className="min-w-0">
                <span className="block font-semibold leading-5">{title}</span>
                <span className="block text-xs leading-4 text-muted-foreground">{summary}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5">
            {tasks.map((task) => (
              <AdvancementTaskRow key={task.id} task={task} onOpen={onOpen} />
            ))}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

const ROW_CLASS =
  'flex w-full min-h-9 items-center justify-between gap-3 rounded-lg border bg-background px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent coarse:min-h-11';

function AdvancementTaskBody({ task }: Readonly<{ task: AdvancementTask }>) {
  return (
    <>
      {/* shadcn's Button is whitespace-nowrap and the row inherits it, which no wrap rule beats. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 whitespace-normal">
        <span className="font-medium leading-5">{task.label}</span>
        {task.detail ? <span className="text-xs leading-4 text-muted-foreground">{task.detail}</span> : null}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );
}

function AdvancementTaskRow({ task, onOpen }: Readonly<{ task: AdvancementTask; onOpen?: (href: string) => void }>) {
  if (onOpen) {
    return (
      <button type="button" className={ROW_CLASS} onClick={() => onOpen(task.href)}>
        <AdvancementTaskBody task={task} />
      </button>
    );
  }

  return (
    <Button asChild variant="ghost" className={`${ROW_CLASS} h-auto`}>
      <Link to={task.href}>
        <AdvancementTaskBody task={task} />
      </Link>
    </Button>
  );
}
