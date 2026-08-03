import { Link, useNavigate } from 'react-router-dom';
import { useCharacterStore, useCharacterSummaries } from '@/store/characterStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, MoreVertical, Copy, Eye, Pencil, Trash2, User, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { exportCharacterToFillablePdf } from '@/lib/characterPdf';

export function MyCharactersPage() {
  const navigate = useNavigate();
  const characters = useCharacterSummaries();
  const {
    builderState,
    deleteCharacter,
    duplicateCharacter,
    getCharacter,
    loadCharacterIntoBuilder,
    resetBuilder
  } = useCharacterStore();

  const handleEdit = (id: string) => {
    if (!loadCharacterIntoBuilder(id)) {
      toast.error('Character could not be opened in the builder');
      return;
    }

    navigate('/builder/review');
  };

  // An edit session owns the builder draft, so starting a new character must leave it behind
  // instead of saving the next set of choices over the character being edited.
  const handleStartNewCharacter = () => {
    if (builderState.editingCharacterId) {
      resetBuilder();
    }
  };

  const handleDuplicate = (id: string) => {
    const newChar = duplicateCharacter(id);
    if (newChar) {
      toast.success(`Duplicated character: ${newChar.name}`);
    }
  };

  const handleDelete = (id: string, name: string) => {
    deleteCharacter(id);
    toast.success(`Deleted character: ${name}`);
  };

  const handleExport = async (id: string) => {
    const character = getCharacter(id);
    if (!character) {
      toast.error('Character not found');
      return;
    }

    try {
      await exportCharacterToFillablePdf(character);
      toast.success('PDF exported');
    } catch (error) {
      console.error(error);
      toast.error('PDF export failed');
    }
  };

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="text-center space-y-2">
          <User className="h-16 w-16 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">No Characters Yet</h2>
          <p className="text-muted-foreground">
            You haven't created any characters.
          </p>
        </div>
        <Link to="/builder" onClick={handleStartNewCharacter}>
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Create Your First Character
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Characters</h1>
          <p className="text-muted-foreground">
            {characters.length} character{characters.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link to="/builder" onClick={handleStartNewCharacter}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Character
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map((character) => (
          <Card key={character.id} className="group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{character.name}</CardTitle>
                    <CardDescription>Level {character.level}</CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <Link to={`/character/${character.id}`}>
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View Sheet
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem onClick={() => handleEdit(character.id)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit in Builder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(character.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport(character.id)}>
                      <FileDown className="h-4 w-4 mr-2" />
                      Export PDF
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Character</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete <strong>{character.name}</strong>? 
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(character.id, character.name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <Link to={`/character/${character.id}`}>
                <div className="space-y-2 cursor-pointer">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Species</span>
                    <span className="font-medium">{character.speciesName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Class</span>
                    <span className="font-medium">{character.classSummary}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span className="font-medium">
                      {new Date(character.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
