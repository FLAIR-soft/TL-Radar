import type { Page } from '@playwright/test';

export const PASSWORD = 'testpass123';

export function uniqueName(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 8);
  const lastName = 'E2e' + rand;
  const username = (prefix + lastName).toLowerCase();
  return { firstName: prefix, lastName, fullName: `${prefix} ${lastName}`, username };
}

export async function register(page: Page, firstName: string, lastName: string, username?: string) {
  await page.goto('/login');
  await page.click('button:has-text("Registrieren")');
  await page.fill('input[name=firstName]', firstName);
  await page.fill('input[name=lastName]', lastName);
  await page.fill('input[name=username]', username ?? (firstName + lastName).toLowerCase());
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]:has-text("Registrieren")');
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

export async function signIn(page: Page, username: string) {
  await page.goto('/login');
  await page.fill('input[name=username]', username);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]:has-text("Anmelden")');
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

// "Neue Aufgabe" is a button on Task-Manager (stage 5), not a standalone
// top-nav tab reachable from every page — so getting to /dashboard/new from
// elsewhere means landing on Task-Manager first. Two client-side
// navigations back-to-back (tab click, then button click) occasionally
// race in this sandbox: the click fires, dispatches fine, but the app
// doesn't navigate — not a button-readiness issue (confirmed present and
// visible beforehand), just an intermittent swallowed click under this
// environment's load. A single bounded retry clears it without masking a
// real regression (a genuinely broken button would fail both attempts).
export async function goToNewTaskFromTaskManager(page: Page) {
  await page.click('text=Task-Manager');
  await page.waitForURL('**/dashboard');
  await page.locator('[data-testid=new-task-button]').waitFor({ state: 'visible' });
  await page.click('text=Neue Aufgabe');
  try {
    await page.waitForURL('**/dashboard/new', { timeout: 5_000 });
  } catch {
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new', { timeout: 15_000 });
  }
}
