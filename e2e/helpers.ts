import type { Page } from '@playwright/test';

export const PASSWORD = 'testpass123';

export function uniqueName(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 8);
  return { firstName: prefix, lastName: 'E2e' + rand, fullName: `${prefix} E2e${rand}` };
}

export async function register(page: Page, firstName: string, lastName: string) {
  await page.goto('/login');
  await page.click('button:has-text("Registrieren")');
  await page.fill('input[name=firstName]', firstName);
  await page.fill('input[name=lastName]', lastName);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]:has-text("Registrieren")');
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

export async function signIn(page: Page, firstName: string, lastName: string) {
  await page.goto('/login');
  await page.fill('input[name=firstName]', firstName);
  await page.fill('input[name=lastName]', lastName);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]:has-text("Anmelden")');
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}
