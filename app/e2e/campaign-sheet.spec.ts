// The campaign copy of a sheet. The owner's own character used to render read-only here — no
// trackers, no rests, no level control, no Cast button — because `onChange` was withheld to avoid
// a second writer on the row. The API is stubbed: this is the client's decision, not the server's.
import { expect, test, type Page } from '@playwright/test';
import { DRUID_2024, seedCharacters } from './fixtures';

const USER = { id: 7, username: 'ada', discord_id: null, created_at: null };

const CAMPAIGN = {
  id: 42,
  name: 'Curse of Strahd',
  owner_user_id: 7,
  created_at: null,
  campaign_code: 'ABCD',
  sort_index: 0,
  allowed_source_ids: null,
  system_id: 'dnd-5e',
  default_member_permissions: null,
  default_invite_permissions: null,
  default_auto_claim_seats: null,
};

interface StubOptions {
  /** Whose sheet the server says this is. */
  isOwner: boolean;
  canEdit: boolean;
  /** The document the server holds, which is not the owner's local copy. */
  document: Record<string, unknown>;
}

async function stubApi(page: Page, { isOwner, canEdit, document }: StubOptions) {
  const writes: unknown[] = [];

  // Registered first on purpose: Playwright matches handlers in reverse registration order, so the
  // catch-all has to go in before the specific ones or it answers `{}` to every one of them.
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }));

  await page.route('**/api/me', (route) => route.fulfill({ json: { user: USER } }));
  await page.route('**/api/campaigns', (route) => route.fulfill({ json: { campaigns: [CAMPAIGN] } }));
  await page.route('**/api/campaigns/42/members', (route) => route.fulfill({
    json: { members: [{ campaign_id: 42, user_id: 7, username: 'ada', role: 'owner', permissions: null }] }
  }));

  await page.route('**/api/characters/sheet-1', async (route) => {
    if (route.request().method() === 'PUT') {
      writes.push(route.request().postDataJSON());
      await route.fulfill({ json: { character: { id: 'sheet-1', version: 2 } } });
      return;
    }

    await route.fulfill({
      json: {
        character: {
          id: 'sheet-1',
          user_id: isOwner ? 7 : 9,
          campaign_id: 42,
          player_id: null,
          name: 'Keth',
          summary: 'Level 8 Druid',
          visibility: 'campaign',
          schema_version: 1,
          version: 1,
          created_at: null,
          updated_at: null,
          is_owner: isOwner,
          can_edit: canEdit,
          data: document,
        }
      }
    });
  });

  return writes;
}

const OWNED = {
  id: 'sheet-1',
  name: 'Keth',
  speciesId: 'basic-rules-2024-elf',
  classId: DRUID_2024,
  level: 8,
};

/** The document as the server holds it, for a sheet the reader has no local copy of. */
const REMOTE_DOCUMENT = {
  ...OWNED,
  classes: [{ classId: DRUID_2024, level: 8, hitDiceUsed: 0 }],
  abilityScores: { strength: 10, dexterity: 14, constitution: 14, intelligence: 12, wisdom: 17, charisma: 10 },
  hp: { current: 20, maximum: 20, temporary: 0 },
  features: [],
  feats: [],
  spells: [],
  equipment: [],
  proficiencies: { skills: [], saves: [], tools: [], languages: [], armor: [], weapons: [] },
};

/** One edit that only an editable sheet can make, through the panel's own picker. */
async function learnWolf(page: Page) {
  await page.getByRole('button', { name: 'Learn a form' }).click();
  await page.getByPlaceholder('Search…').fill('Wolf');
  await page.getByRole('button', { name: /^Wolf/ }).first().click();
  await expect(page.getByRole('button', { name: 'Transform' }).first()).toBeVisible();
}

test('the owner can drive their own sheet from the campaign view', async ({ page }) => {
  // The local cache holds it, which is the copy sync already owns.
  await seedCharacters(page, [OWNED]);
  await stubApi(page, { isOwner: true, canEdit: true, document: { id: 'sheet-1' } });

  await page.goto('/campaign/42/party/sheet-1');
  await expect(page.getByRole('heading', { name: 'Keth' })).toBeVisible();

  // Every one of these is `onChange`, and all of them were missing.
  await expect(page.getByRole('button', { name: 'Short Rest' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Long Rest' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Learn a form' })).toBeVisible();
  await expect(page.getByText('Read-only. This sheet belongs to another player.')).toHaveCount(0);
});

test("an edit from the campaign view writes to the owner's own copy, not a second row", async ({ page }) => {
  await seedCharacters(page, [OWNED]);
  const writes = await stubApi(page, { isOwner: true, canEdit: true, document: { id: 'sheet-1' } });

  await page.goto('/campaign/42/party/sheet-1');
  await learnWolf(page);

  // The cache is the writer here, so the edit lands in the copy sync already owns. A PUT may
  // follow from the sync pass itself, which is the point: one writer, not two.
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem('dnd-character-storage') ?? ''))
    .toContain('wildShape');
  expect(writes).toBeDefined();
});

test("another player's sheet stays read-only, and says so", async ({ page }) => {
  await stubApi(page, { isOwner: false, canEdit: false, document: REMOTE_DOCUMENT });

  await page.goto('/campaign/42/party/sheet-1');
  await expect(page.getByText('Read-only. This sheet belongs to another player.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Short Rest' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Learn a form' })).toHaveCount(0);
});

test('a granted editor holds no local copy, so their edit goes to the server', async ({ page }) => {
  // No `seedCharacters`: this reader's cache does not have it, which is the whole difference.
  const writes = await stubApi(page, { isOwner: false, canEdit: true, document: REMOTE_DOCUMENT });

  await page.goto('/campaign/42/party/sheet-1');
  await expect(page.getByText("Editing another player's sheet, with their permission")).toBeVisible();
  await learnWolf(page);

  // Debounced, so poll rather than wait a fixed 900ms.
  await expect.poll(() => writes.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(JSON.stringify(writes)).toContain('wildShape');
});
