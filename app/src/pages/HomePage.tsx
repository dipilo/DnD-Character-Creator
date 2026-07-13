import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sword, Users, Download, FlaskConical, Dices, ArrowRight, type LucideIcon } from 'lucide-react';

interface HomeShortcut {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const primaryShortcut: HomeShortcut = {
  to: '/builder',
  icon: Sword,
  title: 'Character Builder',
  description: 'Select species, class, background, ability scores, spells, and equipment.'
};

const secondaryShortcuts: HomeShortcut[] = [
  {
    to: '/characters',
    icon: Users,
    title: 'My Characters',
    description: 'Open, edit, or export the characters you have already saved.'
  },
  {
    to: '/dice',
    icon: Dices,
    title: 'Dice Roller',
    description: 'Roll 3D physics dice.'
  },
  {
    to: '/content/import',
    icon: Download,
    title: 'Import Sources',
    description: 'Load source books from local JSON into your library.'
  },
  {
    to: '/homebrew',
    icon: FlaskConical,
    title: 'Homebrew',
    description: 'Make your own species, classes, spells, feats, and monsters.'
  }
];

function ShortcutCard({ shortcut }: Readonly<{ shortcut: HomeShortcut }>) {
  const { to, icon: Icon, title, description } = shortcut;
  return (
    <Link to={to} className="group">
      <Card className="h-full transition-colors hover:border-primary">
        <CardHeader>
          <Icon className="mb-2 h-7 w-7 text-primary" />
          <CardTitle className="flex items-center justify-between gap-2">
            {title}
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

export function HomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">D&D Character Builder</h1>
        <p className="text-muted-foreground">Pick up where you left off or start something new.</p>
      </div>

      <Link to={primaryShortcut.to} className="group block">
        <Card className="border-primary/40 bg-primary/5 transition-colors hover:border-primary">
          <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <primaryShortcut.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold">{primaryShortcut.title}</p>
                <p className="text-sm text-muted-foreground">{primaryShortcut.description}</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </CardContent>
        </Card>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        {secondaryShortcuts.map((shortcut) => (
          <ShortcutCard key={shortcut.to} shortcut={shortcut} />
        ))}
      </div>
    </div>
  );
}
