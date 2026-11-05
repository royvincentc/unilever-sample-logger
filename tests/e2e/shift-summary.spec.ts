import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  // Mount the production modal through Vite, without unrelated authentication.
  await page.route('**/tools/collaboration/preview.tsx', route => route.fulfill({
    contentType: 'application/javascript', body: "import '/src/main.tsx';",
  }));
  await page.route('**/src/App.tsx', route => route.fulfill({
    contentType: 'application/javascript', body: "export { default } from '/src/components/ui/ShiftSummaryModal.tsx';",
  }));
  await page.addInitScript(() => {
    localStorage.setItem('sample_logger_settings', JSON.stringify({ spreadsheetId: 'fixture-workbook' }));
  });
  await page.clock.install({ time: new Date('2026-11-05T17:00:00+08:00') });
});

for (const width of [1440, 390]) {
  test(`review, edit and send a shift at ${width}px with keyboard focus and no overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const sends: string[] = [];
    await page.route('**/api/sheet-data?*', route => {
      const tab = new URL(route.request().url()).searchParams.get('tab');
      return route.fulfill({ json: tab?.startsWith('SWAB') ? [
        { SAMPLE: 'ST3', 'DATE SWABBED': '11/5/2026', 'TIME SWABBED': '17:10', 'ANALYZED BY': 'ROY', 'SWABBED BY': 'SWABBER' },
        { SAMPLE: 'ST4', 'DATE SWABBED': '11/5/2026', 'TIME SWABBED': '18:10', 'ANALYZED BY': 'DCN', 'SWABBED BY': 'SWABBER' },
      ] : [] });
    });
    await page.route('**/api/telegram', route => {
      sends.push(route.request().postDataJSON().text);
      return route.fulfill({ json: { success: true } });
    });
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Shift summary', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Shift activity summary' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close shift summary' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Shift start date', exact: true }).click();
    const calendar = page.getByRole('dialog', { name: 'Select Shift start date' });
    await expect(calendar).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(calendar).not.toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send to Telegram', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Generate preview', exact: true }).click();
    const preview = page.getByRole('textbox', { name: 'Message preview' });
    await expect(preview).toHaveValue(/ST3 @ 5:10 PM/);
    await expect(preview).toHaveValue(/Endorse to Night Shift\nENVI\nST3 @ 5:10 PM\n\u2014 ROY \u2014/);
    await expect(preview).not.toHaveValue(/SWABBER/);
    await expect(preview).not.toHaveValue(/ST4/);
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
    await preview.fill((await preview.inputValue()) + '\nReviewed by shift lead');
    await page.getByRole('button', { name: 'Send to Telegram', exact: true }).click();
    await expect(page.getByText('Summary sent to Telegram.', { exact: true })).toBeVisible();
    expect(sends).toHaveLength(1);
    expect(sends[0]).toContain('Reviewed by shift lead');
    await expect(page.getByRole('button', { name: 'Sent to Telegram', exact: true })).toBeDisabled();
    await page.screenshot({ path: `output/playwright/shift-summary-${width}.png`, fullPage: true });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByLabel('Shift', { exact: true }).selectOption('PM');
    await page.getByRole('button', { name: 'Generate preview', exact: true }).click();
    await expect(preview).toHaveValue(/ST4 @ 6:10 PM/);
    await expect(preview).toHaveValue(/ST3 @ 5:10 PM \(Endorsed by Dayshift\)\n\u2014 ROY \u2014/);
    await expect(preview).toHaveValue(/ST4 @ 6:10 PM\n\u2014 DCN \u2014/);
    await expect(preview).not.toHaveValue(/SWABBER|Endorse to Night Shift/);
    await page.getByLabel('Shift', { exact: true }).selectOption('AM');
    await expect(preview).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Send to Telegram', exact: true })).toBeDisabled();
  });
}

test('failed sheet reads show an error and cannot send a partial summary', async ({ page }) => {
  let sends = 0;
  await page.route('**/api/sheet-data?*', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.route('**/api/telegram', route => { sends++; return route.fulfill({ json: { success: true } }); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Shift summary', exact: true }).click();
  await page.getByRole('button', { name: 'Generate preview', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not read valid shift summary rows');
  await expect(page.getByRole('button', { name: 'Send to Telegram', exact: true })).toBeDisabled();
  expect(sends).toBe(0);
});

test('a failed send requires explicit regeneration before another attempt', async ({ page }) => {
  let sends = 0;
  await page.route('**/api/sheet-data?*', route => route.fulfill({ json: [] }));
  await page.route('**/api/telegram', route => {
    sends++;
    return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Shift summary', exact: true }).click();
  await page.getByRole('button', { name: 'Generate preview', exact: true }).click();
  await page.getByRole('button', { name: 'Send to Telegram', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('0 messages already sent');
  await expect(page.getByRole('button', { name: 'Send to Telegram', exact: true })).toBeDisabled();
  expect(sends).toBe(1);
  await page.getByRole('button', { name: 'Regenerate preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send to Telegram', exact: true })).toBeEnabled();
  expect(sends).toBe(1);
});
