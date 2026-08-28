import { test, expect } from '@playwright/test';
import { register, uniqueName } from './helpers';

// golden-path.spec.ts already covers mouse-based drag & drop (success and
// invalid-target rejection). Stage 6 added two more interaction paths that
// nothing exercised yet: dragging a card by keyboard (KeyboardSensor), and a
// card refusing to start a second drag while its first status change is
// still in flight (pendingIds).
test.describe('kanban drag & drop — keyboard and pending-lock', () => {
  test('a card can be picked up and moved with the keyboard', async ({ page }) => {
    const owner = uniqueName('K1');
    await register(page, owner.firstName, owner.lastName);

    const rand = Math.random().toString(36).slice(2, 8);
    const title = 'E2E Kbd DnD ' + rand;
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', title);
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    // See the mouse-drag tests in golden-path.spec.ts for why: narrows every
    // column to just this task so it's on-screen with no scrolling,
    // regardless of how much history the suite has piled up.
    await page.goto(`/dashboard?q=${encodeURIComponent(rand)}`);

    const waitingCol = page.locator('.kanban-col').nth(0);
    const inProgressCol = page.locator('.kanban-col').nth(1);
    const card = waitingCol.locator('.draggable-task', { hasText: title });
    await card.waitFor();

    const cardBox = await card.boundingBox();
    const targetBox = await inProgressCol.boundingBox();
    if (!cardBox || !targetBox) throw new Error('could not measure drag source/target');

    await card.focus();
    await expect(card).toBeFocused();

    await page.keyboard.press('Space'); // pick up
    await expect(card).toHaveClass(/task-card-dragging/);

    // dnd-kit's default keyboard coordinate getter moves 25px per arrow
    // press. Aim for the target column's horizontal center rather than a
    // fixed press count: overshooting past it (into a further column) loses
    // the "over" state just as surely as undershooting does.
    const deltaX = targetBox.x + targetBox.width / 2 - (cardBox.x + cardBox.width / 2);
    const presses = Math.round(deltaX / 25);
    for (let i = 0; i < presses; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await expect(inProgressCol).toHaveClass(/kanban-col-over/, { timeout: 8000 });

    await page.keyboard.press('Space'); // drop

    // Deterministic regardless of when the suite runs (same reasoning as the
    // mouse-drag tests): waiting -> in_progress either succeeds, or is
    // rejected outside work hours and the card stays put with an error.
    const landedInProgress = inProgressCol.locator('.task-card', { hasText: title });
    const backInWaiting = waitingCol.locator('.task-card', { hasText: title });
    await expect(landedInProgress.or(backInWaiting)).toBeVisible();

    const succeeded = await landedInProgress.count();
    const rolledBack = await backInWaiting.count();
    expect(succeeded + rolledBack).toBe(1);
    if (rolledBack) {
      await expect(page.locator('[data-testid=toast]')).toBeVisible();
    }
  });

  test('a card cannot start a second drag while its status change is still in flight', async ({ page }) => {
    const owner = uniqueName('K2');
    await register(page, owner.firstName, owner.lastName);

    const rand = Math.random().toString(36).slice(2, 8);
    const title = 'E2E Pending DnD ' + rand;
    await page.click('text=Neue Aufgabe');
    await page.waitForURL('**/dashboard/new');
    await page.fill('input[name=title]', title);
    await page.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
    await page.waitForURL('**/dashboard');

    await page.goto(`/dashboard?q=${encodeURIComponent(rand)}`);

    // Server Actions POST back to the current URL carrying a `next-action`
    // header; delaying only those (not the page's own navigations/assets)
    // holds the setStatus() call in flight long enough to observe the
    // pending-disabled window without racing it.
    await page.route('**/dashboard*', async (route) => {
      const isServerAction = !!route.request().headers()['next-action'];
      if (isServerAction) await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    const waitingCol = page.locator('.kanban-col').nth(0);
    const inProgressCol = page.locator('.kanban-col').nth(1);
    const card = waitingCol.locator('.draggable-task', { hasText: title });
    await card.waitFor();

    const cardBox = await card.boundingBox();
    const targetBox = await inProgressCol.boundingBox();
    if (!cardBox || !targetBox) throw new Error('could not measure drag source/target');

    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cardBox.x + cardBox.width / 2 + 20, cardBox.y + cardBox.height / 2 + 20, { steps: 5 });
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.mouse.up();

    // The optimistic move happens immediately; the confirming (delayed)
    // server response hasn't landed yet, so the card must now be marked
    // disabled — and a fresh drag attempt on it must not activate.
    const movedCard = inProgressCol.locator('.draggable-task', { hasText: title });
    await expect(movedCard).toHaveClass(/draggable-task-disabled/);

    const pendingBox = await movedCard.boundingBox();
    if (!pendingBox) throw new Error('could not measure pending card');
    await page.mouse.move(pendingBox.x + pendingBox.width / 2, pendingBox.y + pendingBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(pendingBox.x + pendingBox.width / 2 + 20, pendingBox.y + pendingBox.height / 2 + 20, {
      steps: 5,
    });
    await expect(movedCard).not.toHaveClass(/task-card-dragging/);
    await page.mouse.up();

    // Once the delayed response resolves, the lock lifts (whether or not the
    // transition itself was accepted server-side).
    await expect
      .poll(async () => (await page.locator('.draggable-task-disabled', { hasText: title }).count()) === 0, {
        timeout: 5000,
      })
      .toBe(true);
  });
});
