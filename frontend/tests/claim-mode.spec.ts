/**
 * Playwright verification spec for claim_mode (each/one) chore system.
 *
 * Assumes DB is seeded with:
 *   - Parent (admin, PIN 1234) — avatar[0]
 *   - Elina  (kid,   PIN 1111) — avatar[1]
 *   - Sofia  (kid,   PIN 2222) — avatar[2]
 *   - "Brush Teeth" chore — claim_mode=each
 *   - "Clean Car"   chore — claim_mode=one
 */
import { test, expect, type Page } from '@playwright/test';

async function loginAsKid(page: Page, avatarIndex: number, pin: string) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const tiles = page.locator('.avatar-tile');
  await tiles.nth(avatarIndex).click();
  await page.waitForTimeout(300);
  for (const digit of pin.split('')) {
    await page.locator('.pin-key').getByText(digit, { exact: true }).click();
  }
  await page.waitForURL('/dashboard*', { timeout: 6000 });
}

async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.avatar-tile').first().click();
  await page.waitForTimeout(300);
  for (const digit of '1234'.split('')) {
    await page.locator('.pin-key').getByText(digit, { exact: true }).click();
  }
  await page.waitForURL('/admin*', { timeout: 6000 });
}

async function logout(page: Page) {
  // Navigate home which triggers session check, or use logout nav
  const logoutBtn = page.locator('button, a').filter({ hasText: /logout|έξοδος/i }).first();
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click();
  } else {
    await page.goto('/');
  }
  await page.waitForLoadState('domcontentloaded');
}

test.describe('claim_mode: each — every kid can claim independently', () => {
  test('Elina sees Brush Teeth as available and can claim it', async ({ page }) => {
    await loginAsKid(page, 1, '1111');

    // Navigate to chores
    await page.goto('/dashboard/chores');
    await page.waitForLoadState('networkidle');

    // "Brush Teeth" (each mode) should be visible and available
    const brushTeethCard = page.locator('.chore-card').filter({ hasText: 'Brush Teeth' });
    await expect(brushTeethCard).toBeVisible({ timeout: 5000 });

    // Should have claim button (status=available)
    const claimBtn = brushTeethCard.locator('button').filter({ hasText: /claim|διεκδίκηση/i });
    await expect(claimBtn).toBeVisible();

    await page.screenshot({ path: '/tmp/claim-mode-each-before-claim.png' });
  });

  test('After Elina claims Brush Teeth, card shows pending — Sofia still sees claim button', async ({ browser }) => {
    // Elina claims first
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await loginAsKid(page1, 1, '1111');
    await page1.goto('/dashboard/chores');
    await page1.waitForLoadState('networkidle');

    const elinaCard = page1.locator('.chore-card').filter({ hasText: 'Brush Teeth' });
    await elinaCard.locator('button').filter({ hasText: /claim|διεκδίκηση/i }).click();

    // Elina's card should now show pending badge (not claim button)
    await expect(elinaCard.locator('.chore-status-badge')).toBeVisible({ timeout: 5000 });
    const badgeText = await elinaCard.locator('.chore-status-badge').textContent();
    expect(badgeText).toMatch(/pending|αναμονή/i);
    await page1.screenshot({ path: '/tmp/claim-mode-each-elina-pending.png' });
    await ctx1.close();

    // Sofia logs in — should STILL see Brush Teeth with claim button (each mode = independent)
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await loginAsKid(page2, 2, '2222');
    await page2.goto('/dashboard/chores');
    await page2.waitForLoadState('networkidle');

    const sofiaCard = page2.locator('.chore-card').filter({ hasText: 'Brush Teeth' });
    await expect(sofiaCard).toBeVisible({ timeout: 5000 });

    // Sofia should have a claim button — NOT a "claimed by" badge
    const sofiaClaimBtn = sofiaCard.locator('button').filter({ hasText: /claim|διεκδίκηση/i });
    await expect(sofiaClaimBtn).toBeVisible();
    await expect(sofiaCard.locator('.chore-claimer-badge')).not.toBeVisible();

    await page2.screenshot({ path: '/tmp/claim-mode-each-sofia-still-available.png' });
    await ctx2.close();
  });
});

test.describe('claim_mode: one — first-come-first-served', () => {
  test('Clean Car shows available to both kids initially', async ({ page }) => {
    await loginAsKid(page, 1, '1111');
    await page.goto('/dashboard/chores');
    await page.waitForLoadState('networkidle');

    const cleanCarCard = page.locator('.chore-card').filter({ hasText: 'Clean Car' });
    await expect(cleanCarCard).toBeVisible({ timeout: 5000 });

    // one-mode card has the gold/yellow styling
    await expect(cleanCarCard).toHaveClass(/chore-mode-one/);

    const claimBtn = cleanCarCard.locator('button').filter({ hasText: /claim|διεκδίκηση/i });
    await expect(claimBtn).toBeVisible();

    await page.screenshot({ path: '/tmp/claim-mode-one-before-claim.png' });
  });

  test('After Elina claims Clean Car, Sofia sees it as taken with Elina\'s name', async ({ browser }) => {
    // Elina claims the one-mode chore
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await loginAsKid(page1, 1, '1111');
    await page1.goto('/dashboard/chores');
    await page1.waitForLoadState('networkidle');

    const elinaCarCard = page1.locator('.chore-card').filter({ hasText: 'Clean Car' });
    await elinaCarCard.locator('button').filter({ hasText: /claim|διεκδίκηση/i }).click();

    // Elina sees her own pending badge
    await expect(elinaCarCard.locator('.chore-status-badge')).toBeVisible({ timeout: 5000 });
    const elinaBadge = await elinaCarCard.locator('.chore-status-badge').textContent();
    expect(elinaBadge).toMatch(/pending|αναμονή/i);
    await page1.screenshot({ path: '/tmp/claim-mode-one-elina-claimed.png' });
    await ctx1.close();

    // Sofia logs in — should see Clean Car as TAKEN (with Elina's name, no claim button)
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await loginAsKid(page2, 2, '2222');
    await page2.goto('/dashboard/chores');
    await page2.waitForLoadState('networkidle');

    const sofiaCarCard = page2.locator('.chore-card').filter({ hasText: 'Clean Car' });
    await expect(sofiaCarCard).toBeVisible({ timeout: 5000 });

    // Should be marked as taken
    await expect(sofiaCarCard).toHaveClass(/chore-taken/);

    // No claim button for Sofia
    const sofiaClaimBtn = sofiaCarCard.locator('button').filter({ hasText: /claim|διεκδίκηση/i });
    await expect(sofiaClaimBtn).not.toBeVisible();

    // Should show the claimer badge with Elina's name
    const claimerBadge = sofiaCarCard.locator('.chore-claimer-badge');
    await expect(claimerBadge).toBeVisible();
    await expect(claimerBadge).toContainText('Elina');

    // Status badge shows "Claimed by Elina"
    const statusBadge = sofiaCarCard.locator('.chore-status-badge');
    await expect(statusBadge).toBeVisible();

    await page2.screenshot({ path: '/tmp/claim-mode-one-sofia-sees-taken.png' });
    await ctx2.close();
  });
});

test.describe('Admin chores page shows claim_mode column', () => {
  test('ChoresPage table shows "Each kid" and "One kid" labels', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/chores');
    await page.waitForLoadState('networkidle');

    // Column header should be the new claim mode label
    await expect(page.locator('th').filter({ hasText: /claim mode|τρόπος/i })).toBeVisible({ timeout: 5000 });

    // Row values
    await expect(page.locator('td').filter({ hasText: /each kid|κάθε παιδί/i }).first()).toBeVisible();
    await expect(page.locator('td').filter({ hasText: /one kid|ένα παιδί/i }).first()).toBeVisible();

    await page.screenshot({ path: '/tmp/claim-mode-admin-table.png' });
  });
});
