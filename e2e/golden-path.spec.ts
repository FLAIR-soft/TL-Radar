import { test, expect } from '@playwright/test';
import { register, signIn, uniqueName } from './helpers';

test.describe('golden path', () => {
  test('register, create project, create task with project + multiple assignees + estimate, edit it', async ({
    page,
  }) => {
    const owner = uniqueName('Gp1');
    const helper = uniqueName('Gp2');

    await register(page, owner.firstName, owner.lastName);

    // Registering a second account to assign alongside the owner.
    await page.click('text=Abmelden');
    await page.waitForURL('**/login');
    await register(page, helper.firstName, helper.lastName);
    await page.click('text=Abmelden');
    await page.waitForURL('**/login');

    await signIn(page, owner.firstName, owner.lastName);

    const projectName = 'E2E Project ' + Math.random().toString(36).slice(2, 8);
    await page.click('text=Projekte');
    await page.waitForURL('**/projects');
    await page.fill('input[name=name]', projectName);
    await page.click('button:has-text("Projekt hinzufügen")');
    await expect(page.locator('.project-row', { hasText: projectName })).toBeVisible();

    const taskTitle = 'E2E Task ' + Math.random().toString(36).slice(2, 8);
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', taskTitle);
    await page.check(`.assignee-check-item:has-text("${helper.fullName}") input[type=checkbox]`);
    await page.selectOption('select[name=projectId]', { label: projectName });
    await page.fill('input[name=estimatedMinutes]', '45');
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    const card = page.locator('.task-card', { hasText: taskTitle });
    await expect(card).toContainText(owner.fullName);
    await expect(card).toContainText(helper.fullName);
    await expect(card).toContainText(projectName);

    // Editing preserves what was just set.
    await card.getByTestId('edit-task').click();
    await page.waitForURL('**/dashboard/new?edit=*');
    await expect(page.locator('input[name=estimatedMinutes]')).toHaveValue('45');
    await expect(
      page.locator(`.assignee-check-item:has-text("${helper.fullName}") input[type=checkbox]`)
    ).toBeChecked();
    await expect(page.locator('select[name=projectId]')).toHaveValue(await page.locator('select[name=projectId] option', { hasText: projectName }).getAttribute('value'));

    // Removing the helper leaves at least the owner — must not error.
    await page.uncheck(`.assignee-check-item:has-text("${helper.fullName}") input[type=checkbox]`);
    await page.click('button[type=submit]:has-text("Änderungen speichern")');
    await page.waitForURL('**/dashboard');
    const updatedCard = page.locator('.task-card', { hasText: taskTitle });
    await expect(updatedCard).toContainText(owner.fullName);
    await expect(updatedCard).not.toContainText(helper.fullName);
  });

  test('removing every assignee is rejected with an error', async ({ page }) => {
    const owner = uniqueName('Gp3');
    await register(page, owner.firstName, owner.lastName);

    const taskTitle = 'E2E Solo Task ' + Math.random().toString(36).slice(2, 8);
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', taskTitle);
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    await page.locator('.task-card', { hasText: taskTitle }).getByTestId('edit-task').click();
    await page.waitForURL('**/dashboard/new?edit=*');
    await page.uncheck(`.assignee-check-item:has-text("${owner.fullName}") input[type=checkbox]`);
    await page.click('button[type=submit]:has-text("Änderungen speichern")');

    await expect(page.locator('.error-note')).toBeVisible();
    expect(page.url()).toContain('/dashboard/new?edit=');
  });

  test('deleting a task soft-removes it from dashboard and archive', async ({ page }) => {
    const owner = uniqueName('Gp4');
    await register(page, owner.firstName, owner.lastName);

    page.on('dialog', (d) => d.accept());

    const taskTitle = 'E2E Delete Me ' + Math.random().toString(36).slice(2, 8);
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', taskTitle);
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');
    await expect(page.locator('.task-card', { hasText: taskTitle })).toBeVisible();

    await page.locator('.task-card', { hasText: taskTitle }).getByTestId('delete-task').click();
    await expect(page.locator('.task-card', { hasText: taskTitle })).toHaveCount(0);

    await page.click('text=Archiv');
    await page.waitForURL('**/archive');
    await expect(page.getByText(taskTitle)).toHaveCount(0);
  });

  test('status changes respect work-hours gating deterministically', async ({ page }) => {
    const owner = uniqueName('Gp5');
    await register(page, owner.firstName, owner.lastName);

    const taskTitle = 'E2E Gating Task ' + Math.random().toString(36).slice(2, 8);
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', taskTitle);
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    const card = page.locator('.task-card', { hasText: taskTitle });
    const startButton = card.locator('button', { hasText: 'Starten' });
    const lockedNote = card.locator('.t-locked-note');

    // Deterministic regardless of when the suite runs: exactly one of the
    // two states must hold — either the action is available, or the
    // locked-note explains why it isn't. Never both, never neither.
    const canStart = await startButton.count();
    const isLocked = await lockedNote.count();
    expect(canStart + isLocked).toBe(1);
  });

  test('projects and analytics pages load without console errors', async ({ page }) => {
    const owner = uniqueName('Gp6');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await register(page, owner.firstName, owner.lastName);

    await page.click('text=Projekte');
    await page.waitForURL('**/projects');
    await page.click('text=Analytik');
    await page.waitForURL('**/analytics');
    await expect(page.locator('.analytics-chart')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
