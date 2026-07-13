import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Layout } from '@/components/Layout';
import { HomePage } from '@/pages/HomePage';
import { Toaster } from '@/components/ui/sonner';

const ImportContentPage = lazy(() => import('@/pages/ImportContentPage').then((module) => ({ default: module.ImportContentPage })));
const MyCharactersPage = lazy(() => import('@/pages/MyCharactersPage').then((module) => ({ default: module.MyCharactersPage })));
const HomebrewHubPage = lazy(() => import('@/pages/HomebrewHubPage').then((module) => ({ default: module.HomebrewHubPage })));
const CharacterBuilderPage = lazy(() => import('@/pages/CharacterBuilderPage').then((module) => ({ default: module.CharacterBuilderPage })));
const CharacterSheetPage = lazy(() => import('@/pages/CharacterSheetPage').then((module) => ({ default: module.CharacterSheetPage })));
const SpeciesSelection = lazy(() => import('@/pages/builder/SpeciesSelection').then((module) => ({ default: module.SpeciesSelection })));
const SpeciesDetails = lazy(() => import('@/pages/builder/SpeciesDetails').then((module) => ({ default: module.SpeciesDetails })));
const ClassSelection = lazy(() => import('@/pages/builder/ClassSelection').then((module) => ({ default: module.ClassSelection })));
const ClassDetails = lazy(() => import('@/pages/builder/ClassDetails').then((module) => ({ default: module.ClassDetails })));
const SubclassSelection = lazy(() => import('@/pages/builder/SubclassSelection').then((module) => ({ default: module.SubclassSelection })));
const SubclassDetails = lazy(() => import('@/pages/builder/SubclassDetails').then((module) => ({ default: module.SubclassDetails })));
const BackgroundSelection = lazy(() => import('@/pages/builder/BackgroundSelection').then((module) => ({ default: module.BackgroundSelection })));
const BackgroundDetails = lazy(() => import('@/pages/builder/BackgroundDetails').then((module) => ({ default: module.BackgroundDetails })));
const AbilityScoresPage = lazy(() => import('@/pages/builder/AbilityScoresPage').then((module) => ({ default: module.AbilityScoresPage })));
const SpellsSelectionPage = lazy(() => import('@/pages/builder/SpellsSelectionPage').then((module) => ({ default: module.SpellsSelectionPage })));
const FeatsSelectionPage = lazy(() => import('@/pages/builder/FeatsSelectionPage').then((module) => ({ default: module.FeatsSelectionPage })));
const EquipmentSelectionPage = lazy(() => import('@/pages/builder/EquipmentSelectionPage').then((module) => ({ default: module.EquipmentSelectionPage })));
const ReviewPage = lazy(() => import('@/pages/builder/ReviewPage').then((module) => ({ default: module.ReviewPage })));
const DiceRollerPage = lazy(() => import('@/pages/DiceRollerPage').then((module) => ({ default: module.DiceRollerPage })));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Loading page...
    </div>
  );
}

function App() {
  const { darkMode } = useCharacterStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <ThemeProvider defaultTheme={darkMode ? 'dark' : 'light'}>
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/content/import" element={<ImportContentPage />} />
              <Route path="/homebrew" element={<HomebrewHubPage />} />
              <Route path="/characters" element={<MyCharactersPage />} />
              <Route path="/dice" element={<DiceRollerPage />} />
              <Route path="/builder" element={<CharacterBuilderPage />}>
                <Route index element={<Navigate to="species" replace />} />
                <Route path="species" element={<SpeciesSelection />} />
                <Route path="species/:speciesId" element={<SpeciesDetails />} />
                <Route path="class" element={<ClassSelection />} />
                <Route path="class/:classId" element={<ClassDetails />} />
                <Route path="subclass" element={<SubclassSelection />} />
                <Route path="subclass/:classId/:subclassId" element={<SubclassDetails />} />
                <Route path="background" element={<BackgroundSelection />} />
                <Route path="background/:backgroundId" element={<BackgroundDetails />} />
                <Route path="ability-scores" element={<AbilityScoresPage />} />
                <Route path="advancements" element={<FeatsSelectionPage />} />
                <Route path="spells" element={<SpellsSelectionPage />} />
                <Route path="feats" element={<Navigate to="/builder/advancements" replace />} />
                <Route path="equipment" element={<EquipmentSelectionPage />} />
                <Route path="review" element={<ReviewPage />} />
              </Route>
              <Route path="/character/:id" element={<CharacterSheetPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
