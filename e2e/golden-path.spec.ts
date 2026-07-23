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

    await signIn(page, owner.username);

    const projectName = 'E2E Project ' + Math.random().toString(36).slice(2, 8);
    await page.click('text=Projekte');
    await page.waitForURL('**/projects');
    await page.click('[data-testid=open-create-project]');
    await page.fill('input[name=name]', projectName);
    await page.click('.project-form button:has-text("Projekt hinzufügen")');
    await expect(page.locator('.project-row', { hasText: projectName })).toBeVisible();

    const taskTitle = 'E2E Task ' + Math.random().toString(36).slice(2, 8);
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', taskTitle);
    await page.click('.assignee-select-trigger');
    await page.click(`.assignee-option:has-text("${helper.fullName}")`);
    await expect(page.locator(`.assignee-chip:has-text("${helper.fullName}")`)).toBeVisible();
    // Close via an unrelated field rather than re-clicking the trigger: with
    // two chips now rendered, the trigger's geometric center can land on a
    // chip's own remove button and silently undo the selection.
    await page.click('input[name=title]');
    await expect(page.locator('.assignee-select-panel')).toHaveCount(0);
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
    await expect(page.locator(`.assignee-chip:has-text("${helper.fullName}")`)).toBeVisible();
    await expect(page.locator('select[name=projectId]')).toHaveValue(await page.locator('select[name=projectId] option', { hasText: projectName }).getAttribute('value'));

    // Removing the helper leaves at least the owner — must not error.
    await page.click(`.assignee-chip:has-text("${helper.fullName}") button`);
    await expect(page.locator(`.assignee-chip:has-text("${helper.fullName}")`)).toHaveCount(0);
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
    await page.click(`.assignee-chip:has-text("${owner.fullName}") button`);
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
    await expect(page.locator('.stat-rows')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('task and project detail slide-overs show history', async ({ page }) => {
    const owner = uniqueName('Gp7');
    await register(page, owner.firstName, owner.lastName);

    const projectName = 'E2E Log Project ' + Math.random().toString(36).slice(2, 8);
    await page.click('text=Projekte');
    await page.waitForURL('**/projects');
    await page.click('[data-testid=open-create-project]');
    await page.fill('input[name=name]', projectName);
    await page.click('.project-form button:has-text("Projekt hinzufügen")');
    await expect(page.locator('.project-row', { hasText: projectName })).toBeVisible();

    await page.click('[data-testid=view-project-log]');
    await expect(page.locator('.slideover-title', { hasText: projectName })).toBeVisible();
    await expect(page.locator('.activity-log-row')).toHaveCount(1);
    await page.click('[data-testid=slideover-close]');
    await expect(page.locator('.slideover-backdrop')).toHaveCount(0);

    const taskTitle = 'E2E Log Task ' + Math.random().toString(36).slice(2, 8);
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', taskTitle);
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    const card = page.locator('.task-card', { hasText: taskTitle });
    await card.locator('[data-testid=view-task-log]').click();
    await expect(page.locator('.slideover-title', { hasText: taskTitle })).toBeVisible();
    // Created + assignee_added (self, at creation).
    await expect(page.locator('.activity-log-row')).toHaveCount(2);
    await page.click('[data-testid=slideover-close]');
    await expect(page.locator('.slideover-backdrop')).toHaveCount(0);
  });

  test('overdue tasks are highlighted and sorted before others', async ({ page }) => {
    const owner = uniqueName('Gp8');
    await register(page, owner.firstName, owner.lastName);

    function isoDaysFromNow(days: number): string {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    }

    const rand = Math.random().toString(36).slice(2, 8);
    const overdueTitle = 'E2E Overdue ' + rand;
    const futureTitle = 'E2E Future ' + rand;
    const noDeadlineTitle = 'E2E NoDeadline ' + rand;

    async function createTask(title: string, deadline: string | null) {
      await page.click('text=Neue Aufgabe');
      await page.waitForURL('**/dashboard/new');
      await page.fill('input[name=title]', title);
      if (deadline) await page.fill('input[name=deadline]', deadline);
      await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
      await page.waitForURL('**/dashboard');
    }

    // Created out of urgency order on purpose, so a passing sort assertion
    // proves real reordering rather than accidental created_at order.
    await createTask(noDeadlineTitle, null);
    await createTask(futureTitle, isoDaysFromNow(1));
    await createTask(overdueTitle, isoDaysFromNow(-1));

    const overdueCard = page.locator('.task-card', { hasText: overdueTitle });
    await expect(overdueCard).toHaveClass(/task-card-overdue/);
    await expect(overdueCard.locator('.overdue-badge')).toBeVisible();

    const futureCard = page.locator('.task-card', { hasText: futureTitle });
    await expect(futureCard).not.toHaveClass(/task-card-overdue/);

    const titles = await page.locator('.kanban-col:first-child .task-card .t-title').allTextContents();
    const trimmed = titles.map((t) => t.trim());
    const overdueIdx = trimmed.findIndex((t) => t.includes(overdueTitle));
    const futureIdx = trimmed.findIndex((t) => t.includes(futureTitle));
    const noDeadlineIdx = trimmed.findIndex((t) => t.includes(noDeadlineTitle));
    expect(overdueIdx).toBeLessThan(futureIdx);
    expect(futureIdx).toBeLessThan(noDeadlineIdx);
  });

  test('dashboard search/priority filters narrow results and are shareable via URL', async ({ page }) => {
    const owner = uniqueName('Gp9');
    await register(page, owner.firstName, owner.lastName);

    const rand = Math.random().toString(36).slice(2, 8);
    const highTitle = 'E2E Filt High ' + rand;
    const lowTitle = 'E2E Filt Low ' + rand;
    const uniqueWord = 'zzqxrand' + rand;

    async function createTask(title: string, priority?: string) {
      await page.click('text=Neue Aufgabe');
      await page.waitForURL('**/dashboard/new');
      await page.fill('input[name=title]', title);
      if (priority) await page.selectOption('select[name=priority]', priority);
      await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
      await page.waitForURL('**/dashboard');
    }

    await createTask(highTitle, 'high');
    await createTask(lowTitle, 'low');
    await createTask('E2E Filt Searchable ' + uniqueWord);

    // Text search narrows to the one matching card (URL is the source of
    // truth, so wait on it rather than a fixed timeout).
    await page.fill('.filter-search input', uniqueWord);
    await page.waitForURL(new RegExp('q=' + uniqueWord));
    await expect(page.locator('.task-card')).toHaveCount(1);

    // Reset chip clears the URL and brings every task back (dashboard is
    // team-shared, so assert our own tasks reappear rather than a total count).
    await page.click('[data-testid=reset-filters]');
    await page.waitForFunction(() => !location.search);
    await expect(page.locator('.task-card', { hasText: highTitle })).toBeVisible();
    await expect(page.locator('.task-card', { hasText: lowTitle })).toBeVisible();
    await expect(page.locator('.task-card', { hasText: uniqueWord })).toBeVisible();

    // Filters are shareable: a direct link with ?priority=high applies on load.
    await page.goto('/dashboard?priority=high');
    await expect(page.locator('.task-card', { hasText: highTitle })).toBeVisible();
    await expect(page.locator('.task-card', { hasText: lowTitle })).toHaveCount(0);

    // An impossible filter combination shows the no-results empty state.
    await page.goto('/dashboard?priority=urgent&q=' + uniqueWord);
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.task-card')).toHaveCount(0);
  });

  test('dragging a card between kanban columns changes its status via drag & drop', async ({ page }) => {
    const owner = uniqueName('Gp10');
    await register(page, owner.firstName, owner.lastName);

    const rand = Math.random().toString(36).slice(2, 8);
    const title = 'E2E DnD Task ' + rand;
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', title);
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    // Filter down to just this task via the dashboard search box (Stage 2):
    // other tests sharing this DB leave many tasks behind, and a tall column
    // can extend well past the viewport (all three columns share one grid
    // row, so scrolling to a deep card scrolls every heading off-screen
    // too). Narrowing to a single, freshly-created, randomly-named task
    // keeps every column short and both card and target on-screen with no
    // scrolling needed, regardless of how much history the suite has piled
    // up by this point.
    await page.goto(`/dashboard?q=${encodeURIComponent(rand)}`);

    const waitingCol = page.locator('.kanban-col').nth(0);
    const inProgressCol = page.locator('.kanban-col').nth(1);
    const card = waitingCol.locator('.draggable-task', { hasText: title });
    await card.waitFor();

    let dialogMessage: string | null = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    const cardBox = await card.boundingBox();
    const targetBox = await inProgressCol.boundingBox();
    if (!cardBox || !targetBox) throw new Error('could not measure drag source/target');

    // dnd-kit reacts to raw pointer events, not native HTML5 drag events, so
    // the drag is driven by hand: move past the activation distance, then
    // onto the target column, before releasing. A final small wiggle plus a
    // short settle wait give dnd-kit's own collision-detection pass — which
    // runs off the pointer events, not synchronously with them — a chance to
    // catch up before asserting on it; without this the hover class check is
    // flaky under load (the drop itself is unaffected either way).
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cardBox.x + cardBox.width / 2 + 20, cardBox.y + cardBox.height / 2 + 20, { steps: 5 });
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });
    await page.mouse.move(targetBox.x + targetBox.width / 2 + 1, targetBox.y + targetBox.height / 2 + 1, { steps: 2 });
    await page.waitForTimeout(150);
    await expect(inProgressCol).toHaveClass(/kanban-col-over/, { timeout: 8000 });
    await page.mouse.up();

    // Deterministic regardless of when the suite runs: dropping waiting ->
    // in_progress either succeeds (card lands in the column, timer running)
    // or is rejected outside work hours (card snaps back, error shown) —
    // exactly one of the two, mirroring the button-based gating test above.
    const landedInProgress = inProgressCol.locator('.task-card', { hasText: title });
    const backInWaiting = waitingCol.locator('.task-card', { hasText: title });
    await expect(landedInProgress.or(backInWaiting)).toBeVisible();

    const succeeded = await landedInProgress.count();
    const rolledBack = await backInWaiting.count();
    expect(succeeded + rolledBack).toBe(1);
    if (rolledBack) {
      expect(dialogMessage).toBeTruthy();
    } else {
      await expect(landedInProgress.locator('.t-timer-primary')).toBeVisible();
    }
  });

  test('dragging onto a column that is not a valid next status is a no-op', async ({ page }) => {
    const owner = uniqueName('Gp11');
    await register(page, owner.firstName, owner.lastName);

    const rand = Math.random().toString(36).slice(2, 8);
    const title = 'E2E DnD Invalid ' + rand;
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', title);
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    // See the comment in the previous test: filtering to just this task via
    // the search box keeps every column short and on-screen with no
    // scrolling, regardless of how much history the suite has piled up.
    await page.goto(`/dashboard?q=${encodeURIComponent(rand)}`);

    const waitingCol = page.locator('.kanban-col').nth(0);
    const pausedCol = page.locator('.kanban-col').nth(2); // waiting -> paused is not a real transition
    const card = waitingCol.locator('.draggable-task', { hasText: title });
    await card.waitFor();

    const cardBox = await card.boundingBox();
    const targetBox = await pausedCol.boundingBox();
    if (!cardBox || !targetBox) throw new Error('could not measure drag source/target');

    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cardBox.x + cardBox.width / 2 + 20, cardBox.y + cardBox.height / 2 + 20, { steps: 5 });
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });
    await page.mouse.move(targetBox.x + targetBox.width / 2 + 1, targetBox.y + targetBox.height / 2 + 1, { steps: 2 });
    await page.waitForTimeout(150);
    await expect(pausedCol).toHaveClass(/kanban-col-no-drop/);
    await expect(pausedCol).not.toHaveClass(/kanban-col-over/);
    await page.mouse.up();

    await expect(waitingCol.locator('.task-card', { hasText: title })).toBeVisible();
    await expect(pausedCol.locator('.task-card', { hasText: title })).toHaveCount(0);
  });

  test('adding and deleting a task comment updates the counter and activity log', async ({ page }) => {
    const owner = uniqueName('Gp12');
    await register(page, owner.firstName, owner.lastName);

    const rand = Math.random().toString(36).slice(2, 8);
    const title = 'E2E Comment Task ' + rand;
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', title);
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    // Filter down to just this task (see the drag & drop tests above for why).
    await page.goto(`/dashboard?q=${encodeURIComponent(rand)}`);
    const card = page.locator('.task-card', { hasText: title });
    await expect(card.locator('.comment-count-badge')).toHaveCount(0);

    await card.locator('[data-testid=view-task-log]').click();
    await expect(page.locator('.comment-list .empty-note')).toBeVisible();

    const commentBody = 'E2E comment body ' + rand;
    await page.fill('[data-testid=comment-input]', commentBody);
    await page.click('[data-testid=comment-submit]');
    await expect(page.locator('.comment-row', { hasText: commentBody })).toBeVisible();
    await expect(page.locator('[data-testid=delete-comment]')).toHaveCount(1);
    await expect(page.locator('.activity-log-row', { hasText: 'Kommentar' })).toBeVisible();

    await page.click('[data-testid=slideover-close]');
    await expect(card.locator('.comment-count-badge')).toHaveText('1');

    await card.locator('[data-testid=view-task-log]').click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('[data-testid=delete-comment]');
    await expect(page.locator('.comment-list .empty-note')).toBeVisible();
    await page.click('[data-testid=slideover-close]');
    await expect(card.locator('.comment-count-badge')).toHaveCount(0);
  });

  test('assigning, commenting, and unassigning notify the other person but not the actor', async ({ page }) => {
    const owner = uniqueName('Gp13');
    const helper = uniqueName('Gp14');

    await register(page, owner.firstName, owner.lastName);
    await page.click('text=Abmelden');
    await page.waitForURL('**/login');
    await register(page, helper.firstName, helper.lastName);
    await page.click('text=Abmelden');
    await page.waitForURL('**/login');

    await signIn(page, owner.username);

    const rand = Math.random().toString(36).slice(2, 8);
    const title = 'E2E Notif Task ' + rand;
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', title);
    await page.click('.assignee-select-trigger');
    await page.click(`.assignee-option:has-text("${helper.fullName}")`);
    await expect(page.locator(`.assignee-chip:has-text("${helper.fullName}")`)).toBeVisible();
    await page.click('input[name=title]');
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    // Commenting on the task should notify the assigned helper, not the owner
    // (the actor performing the action never gets their own notification).
    await page.goto(`/dashboard?q=${encodeURIComponent(rand)}`);
    await page.locator('.task-card', { hasText: title }).locator('[data-testid=view-task-log]').click();
    await page.fill('[data-testid=comment-input]', 'Please take a look.');
    await page.click('[data-testid=comment-submit]');
    await expect(page.locator('.comment-row')).toBeVisible();
    await page.click('[data-testid=slideover-close]');
    await expect(page.locator('[data-testid=notification-count]')).toHaveCount(0);

    // Removing the helper as assignee should notify them too.
    await page.locator('.task-card', { hasText: title }).getByTestId('edit-task').click();
    await page.waitForURL('**/dashboard/new?edit=*');
    await page.click(`.assignee-chip:has-text("${helper.fullName}") button`);
    await page.click('button[type=submit]:has-text("Änderungen speichern")');
    await page.waitForURL('**/dashboard');

    await page.click('text=Abmelden');
    await page.waitForURL('**/login');
    await signIn(page, helper.username);

    // Assigned + comment + unassigned = 3 unread notifications for the helper.
    await expect(page.locator('[data-testid=notification-count]')).toHaveText('3');
    await page.click('[data-testid=notification-bell]');
    await expect(page.locator('[data-testid=notification-row]')).toHaveCount(3);
    const panelText = await page.locator('.notif-list').textContent();
    expect(panelText).toContain(title);

    await page.click('[data-testid=notif-mark-all]');
    await expect(page.locator('[data-testid=notification-count]')).toHaveCount(0);
    await expect(page.locator('.notif-row.notif-unread')).toHaveCount(0);
  });

  test('checklist progress updates on the card and toggling done does not change task status', async ({ page }) => {
    const owner = uniqueName('Gp15');
    await register(page, owner.firstName, owner.lastName);

    const rand = Math.random().toString(36).slice(2, 8);
    const title = 'E2E Checklist Task ' + rand;
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', title);
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    await page.goto(`/dashboard?q=${encodeURIComponent(rand)}`);
    const card = page.locator('.task-card', { hasText: title });
    await expect(card.locator('.comment-count-badge')).toHaveCount(0);

    await card.locator('[data-testid=view-task-log]').click();
    await expect(page.locator('.checklist-list .empty-note')).toBeVisible();

    await page.fill('[data-testid=checklist-input]', 'Step one');
    await page.click('[data-testid=checklist-submit]');
    await expect(page.locator('.checklist-row', { hasText: 'Step one' })).toBeVisible();
    await page.fill('[data-testid=checklist-input]', 'Step two');
    await page.click('[data-testid=checklist-submit]');
    await expect(page.locator('.checklist-row', { hasText: 'Step two' })).toBeVisible();

    // Reordering: move "Step two" above "Step one".
    await page.locator('.checklist-row', { hasText: 'Step two' }).locator('[data-testid=checklist-move-up]').click();
    await expect(page.locator('.checklist-checkbox-label span').first()).toHaveText('Step two');

    // Toggling done must not touch task status or start any timer.
    await page.locator('.checklist-row', { hasText: 'Step one' }).locator('input[type=checkbox]').click();
    await expect(page.locator('.checklist-row', { hasText: 'Step one' }).locator('.checklist-item-done')).toBeVisible();

    await page.click('[data-testid=slideover-close]');
    await expect(card.locator('.comment-count-badge')).toHaveText('1/2');
    await expect(card.locator('.pill').first()).toHaveText('Wartend');

    // Deleting an item updates the progress counter.
    await card.locator('[data-testid=view-task-log]').click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.checklist-row', { hasText: 'Step two' }).locator('[data-testid=checklist-delete]').click();
    await expect(page.locator('.checklist-row', { hasText: 'Step two' })).toHaveCount(0);
    await expect(page.locator('.activity-log-row', { hasText: 'Checklist' }).first()).toBeVisible();
    await page.click('[data-testid=slideover-close]');
    await expect(card.locator('.comment-count-badge')).toHaveText('1/1');
  });
});
