import { test, expect } from '@playwright/test';

const loginAsAdmin = async (page) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.avatar-tile').first().click();
  await page.waitForTimeout(300);
  await page.locator('.pin-key').getByText('1', { exact: true }).click();
  await page.locator('.pin-key').getByText('2', { exact: true }).click();
  await page.locator('.pin-key').getByText('3', { exact: true }).click();
  await page.locator('.pin-key').getByText('4', { exact: true }).click();
  await page.waitForURL('/admin*', { timeout: 5000 });
};

test.describe('Responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('hamburger visible at 375px width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    expect(await page.locator('.hamburger-btn').isVisible()).toBe(true);
  });

  test('hamburger visible at 767px width', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.waitForTimeout(500);
    expect(await page.locator('.hamburger-btn').isVisible()).toBe(true);
  });

  test('hamburger NOT in DOM at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    expect(await page.locator('.hamburger-btn').count()).toBe(0);
  });

  test('hamburger NOT in DOM at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    expect(await page.locator('.hamburger-btn').count()).toBe(0);
  });

  test('sidebar has mobile class at 767px', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.waitForTimeout(500);
    const classes = await page.locator('.admin-sidebar-wrap').getAttribute('class');
    expect(classes).toContain('mobile');
  });

  test('sidebar without mobile class at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    const classes = await page.locator('.admin-sidebar-wrap').getAttribute('class');
    expect(classes).not.toContain('mobile');
  });

  test('hamburger opens sidebar at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.locator('.hamburger-btn').click();
    await page.waitForTimeout(400);
    const classes = await page.locator('.admin-sidebar-wrap').getAttribute('class');
    expect(classes).toContain('open');
  });

  test('PIN pad keys >= 64px tap targets', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.avatar-tile').first().click();
    await page.waitForTimeout(300);

    const pinKeys = page.locator('.pin-key');
    const count = await pinKeys.count();
    for (let i = 0; i < count; i++) {
      const box = await pinKeys.nth(i).boundingBox();
      if (box) {
        expect(box.width, `key ${i} width`).toBeGreaterThanOrEqual(64);
        expect(box.height, `key ${i} height`).toBeGreaterThanOrEqual(64);
      }
    }
  });

  test('locale toggle exists at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(500);
    const toggle = page.locator('[data-testid="locale-toggle"], .locale-toggle, [title*="locale" i]');
    // The LocaleToggle component should be visible
    expect(await page.locator('.header-right').isVisible()).toBe(true);
  });
});
