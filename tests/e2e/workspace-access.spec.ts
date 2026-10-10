import { test, expect } from '@playwright/test';

test('server setup failures explain the next action and retry recovers access', async ({ page }) => {
  let configured=false;
  await page.route('**/api/workspace?*', route => configured ? route.continue() : route.fulfill({status:503,json:{error:'Shared workspace setup is incomplete.'}}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/kanban');
  await expect(page.getByRole('heading',{name:'Shared workspace needs setup'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Sign in with Google'})).toHaveCount(0);
  await expect(page.getByText('Google sign-in cannot fix a server setup problem.',{exact:false})).toBeVisible();
  configured=true;
  await page.getByRole('button',{name:'Check again',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Shared boards',exact:true,level:1})).toBeVisible();
});

test('membership denial allows checking access after an administrator adds the account', async ({ page }) => {
  let permitted=false;
  await page.route('**/api/workspace?*', route => permitted ? route.continue() : route.fulfill({status:403,json:{error:'Your Google account is signed in but has not been added to this workspace.'}}));
  await page.goto('/kanban');
  await expect(page.getByRole('button',{name:'Use another Google account'})).toBeVisible();
  permitted=true;
  await page.getByRole('button',{name:'Check access again'}).click();
  await expect(page.getByRole('heading',{name:'Shared boards',exact:true,level:1})).toBeVisible();
});

