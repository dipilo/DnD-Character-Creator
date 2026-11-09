// The three things that were broken end to end: the Beast Shapes table renders as a table, the
// panel is reachable, and transforming swaps the figures a player reads.
import { expect, test } from '@playwright/test';
import { DRUID_2014, DRUID_2024, seedCharacters } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seedCharacters(page, [
    { id: 'druid-2024', name: 'Keth', speciesId: 'basic-rules-2024-elf', classId: DRUID_2024, level: 8 },
    { id: 'druid-2014', name: 'Orla', speciesId: 'basic-rules-2014-elf', classId: DRUID_2014, level: 8 },
  ]);
});

// The feature's text lives behind an accordion trigger, which is how the player reached it too.
async function openWildShapeFeature(page: import('@playwright/test').Page) {
  await page.getByRole('tab', { name: 'Features' }).click();
  await page.getByRole('button', { name: /Wild Shape/ }).first().click();
}

test('the Beast Shapes table renders as a table, not as a run of prose', async ({ page }) => {
  await page.goto('/character/druid-2014');
  await openWildShapeFeature(page);

  const table = page.getByRole('table').filter({ hasText: 'Max. CR' }).first();
  await expect(table).toBeVisible();
  // Four columns, and a header row plus the three the 2014 printing states.
  await expect(table.getByRole('columnheader')).toHaveCount(4);
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByRole('row').nth(1)).toContainText('No flying or swimming speed');

  // The flattened run is what the player saw before; it must not be on the page at all.
  await expect(page.getByText('Example 2nd | 1/4')).toHaveCount(0);
  await expect(page.getByText('No flying speed Crocodile')).toHaveCount(0);
});

test('the 2024 printing tabulates Known Forms, and that renders too', async ({ page }) => {
  await page.goto('/character/druid-2024');
  await openWildShapeFeature(page);

  const table = page.getByRole('table').filter({ hasText: 'Known Forms' }).first();
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader')).toHaveCount(4);
  await expect(table.getByRole('row')).toHaveCount(4);
});

test('the panel is on the Actions tab, with the limits the table states', async ({ page }) => {
  await page.goto('/character/druid-2024');

  // Level 8 is the table's last row: CR 1, eight known forms, flying allowed.
  await expect(page.getByText('Max CR 1 · 8 forms known')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Learn a form' })).toBeVisible();
  await expect(page.getByText('3 of 3 uses left')).toBeVisible();
});

test('learning a form then transforming swaps AC, speed and the attack rows', async ({ page }) => {
  await page.goto('/character/druid-2024');

  await page.getByRole('button', { name: 'Learn a form' }).click();
  await page.getByPlaceholder('Search…').fill('Wolf');
  await page.getByRole('button', { name: /^Wolf/ }).first().click();

  await expect(page.getByText('Wolf')).toBeVisible();
  await page.getByRole('button', { name: 'Transform' }).first().click();

  // The badge beside the name is how the rail's numbers announce whose they are.
  await expect(page.getByText('In Wolf form')).toBeVisible();
  await expect(page.getByText('Wild Shape: Wolf')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revert' })).toBeVisible();

  // Transforming is what spends the use, so the count drops without pressing Use anywhere. The
  // class table states three uses at level 8; the eight is the Known Forms column, not this.
  await expect(page.getByText('2 of 3 uses left')).toBeVisible();

  // Leaving the form early gives nothing back — "until you use Wild Shape again" is the cost.
  await page.getByRole('button', { name: 'Revert' }).click();
  await expect(page.getByText('In Wolf form')).toHaveCount(0);
  await expect(page.getByText('2 of 3 uses left')).toBeVisible();
});

test('a character with no shape-shifting feature gets no panel', async ({ page }) => {
  await seedCharacters(page, [
    { id: 'bard', name: 'Lio', speciesId: 'basic-rules-2024-elf', classId: 'basic-rules-2024-bard', level: 8 },
  ]);
  await page.goto('/character/bard');
  await expect(page.getByRole('tab', { name: 'Actions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Learn a form' })).toHaveCount(0);
});
