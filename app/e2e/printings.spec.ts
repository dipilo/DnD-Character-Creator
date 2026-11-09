// Two defects that only show once several books are enabled at once, which is why neither was
// visible to a unit test: a reprint's renamed traits, and one action printed by two books.
import { expect, test } from '@playwright/test';
import { DRUID_2024, seedCharacters } from './fixtures';

/** The group a row falls under is the heading above its own Actions in Combat strip. */
const group = (page: import('@playwright/test').Page, heading: string) =>
  page.getByRole('heading', { name: heading, exact: true }).locator('..');

test('a Kenku shows one printing of its traits, not both names for the same trait', async ({ page }) => {
  await page.goto('/builder/species');
  await page.getByPlaceholder(/search/i).first().fill('Kenku');

  await page.getByRole('button', { name: /^Details/ }).first().click();
  await expect(page.getByRole('heading', { name: /Kenku/ }).first()).toBeVisible();

  const body = page.locator('body');
  const forgery = await body.getByText('Expert Forgery', { exact: false }).count();
  const duplication = await body.getByText('Expert Duplication', { exact: false }).count();

  // Volo's names it Expert Forgery and Monsters of the Multiverse names it Expert Duplication.
  // One of them is the printing on screen; both at once is the same trait granted twice.
  expect(forgery + duplication).toBeGreaterThan(0);
  expect(Math.min(forgery, duplication)).toBe(0);

  // The same pair under its other name.
  const training = await body.getByText('Kenku Training', { exact: false }).count();
  const recall = await body.getByText('Kenku Recall', { exact: false }).count();
  expect(Math.min(training, recall)).toBe(0);
});

// The thirteen hand-written Volo's-era species were retired once the pack supplied them, so a
// character saved before that holds an id nothing mints any more.
test('a character holding a retired species id still names its species', async ({ page }) => {
  await seedCharacters(page, [
    { id: 'old-kenku', name: 'Vash', speciesId: 'kenku', classId: DRUID_2024, level: 3 },
    { id: 'old-tabaxi', name: 'Rrit', speciesId: 'tabaxi', classId: DRUID_2024, level: 3 },
  ]);

  // The Features tab names the species in a card title. The header's subtitle would do too, but it
  // is `short:hidden` — in landscape there are 390px of height and it is deliberately dropped.
  for (const [id, species] of [['old-kenku', 'Kenku'], ['old-tabaxi', 'Tabaxi']]) {
    await page.goto(`/character/${id}`);
    await page.getByRole('tab', { name: 'Features' }).click();
    await expect(page.getByText(`Species Features: ${species}`)).toBeVisible();
    await expect(page.getByText('Unknown Species')).toHaveCount(0);
  }
});

test('an action two books both print is listed once', async ({ page }) => {
  await seedCharacters(page, [
    { id: 'druid-2024', name: 'Keth', speciesId: 'basic-rules-2024-elf', classId: DRUID_2024, level: 8 },
  ]);
  await page.goto('/character/druid-2024');

  // Basic Rules (2024) and the Player's Handbook (2024) both state these, and both packs are on.
  // Scoped to the strip: "Attack" is also one of the filter chips above the table.
  for (const name of ['Attack', 'Dash', 'Disengage', 'Dodge', 'Help', 'Hide', 'Study', 'Utilize']) {
    await expect(group(page, 'Actions').getByRole('button', { name, exact: true })).toHaveCount(1);
  }
});

test('an action is grouped by the timing its own book states, not under Attack', async ({ page }) => {
  await seedCharacters(page, [
    { id: 'druid-2024', name: 'Keth', speciesId: 'basic-rules-2024-elf', classId: DRUID_2024, level: 8 },
  ]);
  await page.goto('/character/druid-2024');

  // D&D Beyond files both of these under Attack. Their own books do not.
  await expect(group(page, 'Reactions').getByRole('button', { name: 'Opportunity Attack', exact: true })).toHaveCount(1);
  await expect(group(page, 'Other').getByRole('button', { name: 'Improvising an Action', exact: true })).toHaveCount(1);
  await expect(group(page, 'Other').getByRole('button', { name: 'End Concentration', exact: true })).toHaveCount(1);
  await expect(group(page, 'Bonus Actions').getByRole('button', { name: 'Two-Weapon Fighting', exact: true })).toHaveCount(1);

  // And the twelve the Actions table states are still Actions.
  await expect(group(page, 'Actions').getByRole('button', { name: 'Attack', exact: true })).toHaveCount(1);
});
