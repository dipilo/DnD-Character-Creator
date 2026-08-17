import { useParams, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileDown, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CharacterSheetView } from '@/components/character/CharacterSheetView';
import { exportCharacterToFillablePdf } from '@/lib/characterPdf';
import type { Character } from '@/types/dnd';

/**
 * One of your own characters, out of the local cache. The sheet itself is `CharacterSheetView`,
 * shared with the campaign party view (MERGE_PLAN.md Phase 5) — this page is the lookup, the
 * actions that only the owner gets, and the one place the sheet's edits are written.
 */
export function CharacterSheetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCharacter, deleteCharacter, loadCharacterIntoBuilder, updateCharacter } = useCharacterStore();

  const character = id ? getCharacter(id) : undefined;

  if (!character) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Character not found.</p>
        <Button onClick={() => navigate('/characters')} className="mt-4">
          Back to My Characters
        </Button>
      </div>
    );
  }

  const handleEdit = () => {
    if (!loadCharacterIntoBuilder(character.id)) {
      toast.error('Character could not be opened in the builder');
      return;
    }

    navigate('/builder/review');
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${character.name}?`)) {
      deleteCharacter(character.id);
      toast.success('Character deleted');
      navigate('/characters');
    }
  };

  /**
   * The sheet's write path. Every tracker and every equipment or spell edit arrives as a patch,
   * which is applied to the stored document — so `syncMeta` marks it dirty and the sync layer
   * pushes it, exactly as a save from the builder would.
   */
  const handleChange = (patch: Partial<Character>) => {
    updateCharacter({ ...character, ...patch, updatedAt: new Date().toISOString() });
  };

  const handleExportPDF = async () => {
    try {
      await exportCharacterToFillablePdf(character);
      toast.success('PDF exported');
    } catch (error) {
      console.error(error);
      toast.error('PDF export failed');
    }
  };

  return (
    <CharacterSheetView
      character={character}
      onChange={handleChange}
      leading={(
        <Button variant="outline" size="sm" onClick={() => navigate('/characters')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      )}
      actions={(
        <>
          <Button onClick={handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </>
      )}
    />
  );
}
