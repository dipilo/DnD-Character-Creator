// "Nothing may make the page scroll sideways. The check is `scrollWidth === clientWidth`"
// (docs/rules/ui.md). Runs at 390x844, 844x390 and desktop, because a width breakpoint cannot see
// a landscape phone's 390px of height.
import { expect, test } from '@playwright/test';
import { DRUID_2014, DRUID_2024, pageScrollsSideways, seedCharacters } from './fixtures';

const ROUTES = [
  ['home', '/'],
  ['my characters', '/characters'],
  ['species step', '/builder/species'],
  ['class step', '/builder/class'],
  ['dice roller', '/dice'],
  ['the sheet', '/character/druid-2024'],
  ['the 2014 sheet', '/character/druid-2014'],
] as const;

test.beforeEach(async ({ page }) => {
  await seedCharacters(page, [
    { id: 'druid-2024', name: 'Keth', speciesId: 'basic-rules-2024-elf', classId: DRUID_2024, level: 8 },
    { id: 'druid-2014', name: 'Orla', speciesId: 'basic-rules-2014-elf', classId: DRUID_2014, level: 8 },
  ]);
});

for (const [label, route] of ROUTES) {
  test(`${label} does not scroll the page sideways`, async ({ page }) => {
    await page.goto(route);
    // The rule is about the settled layout: the content library is a lazy chunk, and the builder's
    // step rail is briefly laid out at its full width before its own scroll container clamps it.
    await page.waitForLoadState('networkidle');
    await expect.poll(() => pageScrollsSideways(page)).toBe(false);
  });
}

// A four-column table inside a feature card is the widest thing the sheet renders, and the card
// is an accordion item, so the table only exists once it is open.
test('the Features tab does not scroll sideways once a table is on screen', async ({ page }) => {
  await page.goto('/character/druid-2014');
  await page.getByRole('tab', { name: 'Features' }).click();
  await page.getByRole('button', { name: /Wild Shape/ }).first().click();
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect.poll(() => pageScrollsSideways(page)).toBe(false);
});
