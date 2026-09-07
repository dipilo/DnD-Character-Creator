// One spell on its own page, so a spell opened from a sheet or the builder can be read, linked and
// kept in a second tab.
import { useNavigate, useParams } from 'react-router-dom';
import { getRuntimeSpellById } from '@/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { SpellDetail } from '@/components/spells/SpellDetail';
import { formatSpellSubtitle } from '@/components/spells/spellFormatting';

export function SpellReferencePage() {
  const { spellId } = useParams<{ spellId: string }>();
  const navigate = useNavigate();
  const spell = spellId ? getRuntimeSpellById(spellId) : undefined;

  if (!spell) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">That spell is not in the sources you have enabled.</p>
        <Button className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button variant="outline" size="sm" className="min-h-11" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{spell.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{formatSpellSubtitle(spell)}</p>
        </CardHeader>
        <CardContent>
          <SpellDetail spell={spell} />
        </CardContent>
      </Card>
    </div>
  );
}
