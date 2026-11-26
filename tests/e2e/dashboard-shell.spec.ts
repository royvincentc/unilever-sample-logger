import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Runs against the synthetic design preview (tools/design-preview), which renders the real Layout and Dashboard.
test.use({ baseURL: 'http://127.0.0.1:5190' });

const dashboard = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('main').getByText('Surface swab A', { exact: true })).toBeVisible();
};

test.describe('desktop', () => {
  test('dashboard links, sync and theme keep working', async ({ page }) => {
    await dashboard(page);
    const metrics = page.getByRole('region', { name: 'Lab overview' }).getByRole('link');
    await expect(metrics).toHaveCount(4);
    for (const [index, href] of ['/history', '/queue', '/incubation', '/results'].entries()) await expect(metrics.nth(index)).toHaveAttribute('href', href);
    for (const type of ['ENVI', 'WATER', 'RawMats', 'AIR']) await expect(page.locator(`a[href="/new?type=${type}"]`)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Workspace shortcuts' }).getByRole('link')).toHaveCount(4);
    await expect(page.getByRole('main').getByRole('link', { name: /pending sync/ })).toHaveAttribute('href', '/queue');

    const sync = page.getByRole('button', { name: /Sync records/ });
    await expect(sync).toBeEnabled();
    await page.getByRole('button', { name: 'Simulate offline' }).click();
    await expect(sync).toBeDisabled();
    await page.getByRole('button', { name: 'Simulate online' }).click();
    await expect(sync).toBeEnabled();

    await page.getByRole('button', { name: 'Use dark theme' }).click();
    await expect(page.getByRole('button', { name: 'Use dark theme' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await metrics.nth(1).click();
    await expect(page).toHaveURL(/\/queue$/);
  });

  test('sidebar navigates, marks the active route and collapses', async ({ page }) => {
    await dashboard(page);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link')).toHaveCount(12);
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'History' }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(nav.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
  });

  test('dashboard has no serious accessibility violations', async ({ page }) => {
    await dashboard(page);
    // Entrance fades blend text colours, so audit only once finite animations have settled.
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
    await page.waitForTimeout(300); // JS-driven (non-WAAPI) motion values have no Animation object.
    const { violations } = await new AxeBuilder({ page }).exclude('.preview-controls').analyze();
    expect(violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id)).toEqual([]);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('bottom nav and drawer keep navigation and focus behaviour', async ({ page }) => {
    await dashboard(page);
    const bottom = page.getByRole('navigation', { name: 'Mobile navigation' });
    for (const name of ['Home', 'History', 'New sample', 'Queue']) await expect(bottom.getByRole('link', { name: new RegExp(name) })).toBeVisible();
    await expect(bottom.getByLabel(/pending sync/)).toBeVisible();
    await bottom.getByRole('link', { name: /History/ }).click();
    await expect(page).toHaveURL(/\/history$/);

    const menu = bottom.getByRole('button', { name: 'Menu' });
    await menu.click();
    const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toHaveCount(0);
    await expect(menu).toBeFocused();

    await menu.click();
    await drawer.getByRole('link', { name: 'Logbook' }).click();
    await expect(page).toHaveURL(/\/logbook$/);
    await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toHaveCount(0);
  });
});
