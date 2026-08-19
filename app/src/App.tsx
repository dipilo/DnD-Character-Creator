import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RequireAuth } from '@/components/auth/RequireAuth';
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
// Scheduler screens (MERGE_PLAN.md Phase 4). Lazy like the rest, which also keeps FullCalendar
// out of the builder's bundle — nothing in the character builder needs a calendar.
const CampaignsPage = lazy(() => import('@/pages/campaign/CampaignsPage').then((module) => ({ default: module.CampaignsPage })));
const CampaignLayout = lazy(() => import('@/pages/campaign/CampaignLayout').then((module) => ({ default: module.CampaignLayout })));
const SchedulePage = lazy(() => import('@/pages/campaign/SchedulePage').then((module) => ({ default: module.SchedulePage })));
const RosterPage = lazy(() => import('@/pages/campaign/RosterPage').then((module) => ({ default: module.RosterPage })));
const GroupsPage = lazy(() => import('@/pages/campaign/GroupsPage').then((module) => ({ default: module.GroupsPage })));
const MembersPage = lazy(() => import('@/pages/campaign/MembersPage').then((module) => ({ default: module.MembersPage })));
const InviteLandingPage = lazy(() => import('@/pages/campaign/InviteLandingPage').then((module) => ({ default: module.InviteLandingPage })));
// Kids on Bikes. A second game system, so its screens are lazy for the same reason the campaign
// ones are: nobody building a D&D character should download another game's content.
const KobCharactersPage = lazy(() => import('@/pages/kob/KobCharactersPage').then((module) => ({ default: module.KobCharactersPage })));
const KobBuilderPage = lazy(() => import('@/pages/kob/KobBuilderPage').then((module) => ({ default: module.KobBuilderPage })));
const KobSheetPage = lazy(() => import('@/pages/kob/KobSheetPage').then((module) => ({ default: module.KobSheetPage })));
// Phase 5: the join between the two halves — real builder characters seated at campaign tables.
const PartyPage = lazy(() => import('@/pages/campaign/PartyPage').then((module) => ({ default: module.PartyPage })));
const CampaignCharacterPage = lazy(() => import('@/pages/campaign/CampaignCharacterPage').then((module) => ({ default: module.CampaignCharacterPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Loading page...
    </div>
  );
}

function App() {
  // The `dark` class and every palette token are written by `startThemeWatcher` (main.tsx) before
  // React mounts, so nothing here has to know about the theme.
  return (
    <>
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

              <Route path="/kob" element={<KobCharactersPage />} />
              <Route path="/kob/builder" element={<KobCharactersPage />} />
              <Route path="/kob/builder/:characterId" element={<KobBuilderPage />} />
              <Route path="/kob/character/:characterId" element={<KobSheetPage />} />

              {/* Campaign-scoped routes are the ones Phase 3's guard was written for. The invite
                  landing page is deliberately outside it: an invite reaches someone who has no
                  account yet. */}
              <Route path="/invite/:token" element={<InviteLandingPage />} />
              <Route
                path="/campaigns"
                element={
                  <RequireAuth>
                    <CampaignsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/campaign/:campaignId"
                element={
                  <RequireAuth>
                    <CampaignLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="schedule" replace />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="roster" element={<RosterPage />} />
                <Route path="party" element={<PartyPage />} />
                <Route path="party/:characterId" element={<CampaignCharacterPage />} />
                <Route path="groups" element={<GroupsPage />} />
                <Route path="members" element={<MembersPage />} />
              </Route>

              {/* A branch that matches no child falls through to here, so a wrong link inside a
                  campaign lands on the same page as a wrong link anywhere else. */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
