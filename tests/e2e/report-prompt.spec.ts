import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import PizZip from 'pizzip';

test.beforeEach(async ({ page }) => {
  await page.route('**/report-prompt-harness', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>t=>t;window.__vite_plugin_react_preamble_installed__=true;import("/tests/e2e/report-prompt.harness.tsx");</script></body></html>',
  }));
  await page.addInitScript(() => {
    localStorage.setItem('sample_logger_settings', JSON.stringify({ spreadsheetId: 'fixture-workbook' }));
  });
  await page.route('**/api/supabase-data?*', route => route.fulfill({ json: [{
    'CONTROL #': '26-1358', TYPE: 'ROH', SAMPLE: 'Glycerin', 'ANALYZED BY': 'JUEN/CODINERA', RFAF: 'Ana Reyes',
  }] }));
  await page.route('**/api/sheet-data?*', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('schemaOnly') === 'true') return route.fulfill({ json: { headers: [] } });
    expect(url.searchParams.get('tab')).toBe('MIC');
    expect(url.searchParams.get('rawValues')).toBe('true');
    return route.fulfill({ json: { values: [['NAME', 'MIC #'], ['Karen M. Juen', 'MIC-001'], ['Roy Vincent Codiñera', 'MIC-002']] } });
  });
});

for (const width of [1440, 390]) {
  test(`report asks for page number and requester before generating at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/report-prompt-harness');
    await page.getByTitle('Generate Report').click();

    const dialog = page.getByRole('dialog', { name: 'Report Details' });
    await expect(dialog).toBeVisible();
    const pageNumber = dialog.getByLabel('Page Number (Logbook)');
    await expect(pageNumber).toBeFocused();
    await expect(dialog.getByLabel('Requested By (from RFAF)')).toHaveValue('Ana Reyes');
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);

    // Required: an empty page number keeps the dialog open and downloads nothing.
    await dialog.getByRole('button', { name: 'Generate' }).click();
    await expect(dialog).toBeVisible();

    await pageNumber.fill('42');
    await dialog.getByLabel('Requested By (from RFAF)').fill('Juan Dela Cruz');
    const download = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    const file = await (await download).path();
    await expect(dialog).toHaveCount(0);

    const zip = new PizZip(fs.readFileSync(file));
    const text = ['word/header1.xml', 'word/footer1.xml'].map(name => zip.file(name)!.asText().replace(/<[^>]+>/g, '')).join(' ');
    for (const expected of ['26-1358', 'MIC-001 / MIC-002', '42', 'Juan Dela Cruz', 'Karen M. Juen / Roy Vincent Codiñera']) {
      expect(text).toContain(expected);
    }

    await page.getByTitle('Generate Report').click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}
