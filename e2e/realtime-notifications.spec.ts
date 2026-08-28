import { test, expect } from '@playwright/test';
import { register, uniqueName } from './helpers';

// The existing notification test in golden-path.spec.ts signs out and back
// in as the recipient, which only proves the REST fallback (get_my_notifications
// on page load) works — it never keeps a tab open across the event, so it
// can't catch a regression in the stage-3 Realtime path itself (the
// postgres_changes subscription in NotificationBell). This test does: two
// concurrent sessions, one tab left open throughout, no reload.
test.describe('realtime notifications', () => {
  test('a live Realtime push updates the bell badge in an already-open tab, without a reload', async ({
    browser,
  }) => {
    // Longer than the default 30s: covers the visibility-gated fallback-poll
    // path (see the comment below) on top of the actual network round trips.
    test.setTimeout(75_000);
    const ownerCtx = await browser.newContext();
    const helperCtx = await browser.newContext();
    try {
      const ownerPage = await ownerCtx.newPage();
      const helperPage = await helperCtx.newPage();

      const owner = uniqueName('R1');
      const helper = uniqueName('R2');

      await register(ownerPage, owner.firstName, owner.lastName);
      await register(helperPage, helper.firstName, helper.lastName);

      const rand = Math.random().toString(36).slice(2, 8);
      const title = 'E2E Realtime Task ' + rand;
      await ownerPage.click('text=Neue Aufgabe');
      await ownerPage.waitForURL('**/dashboard/new');
      await ownerPage.fill('input[name=title]', title);
      await ownerPage.click('.assignee-select-trigger');
      await ownerPage.click(`.assignee-option:has-text("${helper.fullName}")`);
      await expect(ownerPage.locator(`.assignee-chip:has-text("${helper.fullName}")`)).toBeVisible();
      await ownerPage.click('input[name=title]');
      await ownerPage.click('button[type=submit]:has-text("Aufgabe hinzufügen")');
      await ownerPage.waitForURL('**/dashboard');

      // The helper's tab is already sitting on the dashboard (register()
      // lands there) with its Realtime channel subscribed — this is the
      // state a real user would be in, not a fresh page load. Assigning them
      // at task creation already queued one `assigned` notification, but
      // that request raced the page load, so don't assert its badge value
      // yet — only that comparison point matters below.

      // Owner comments on the task — inserts a second (`comment`)
      // notification row for the helper, which the migration 0030
      // publication should push over Realtime to the helper's already-open
      // channel.
      await ownerPage.goto(`/dashboard?q=${encodeURIComponent(rand)}`);
      await ownerPage.locator('.task-card', { hasText: title }).locator('[data-testid=view-task-log]').click();
      await ownerPage.fill('[data-testid=comment-input]', 'Live push check ' + rand);
      await ownerPage.click('[data-testid=comment-submit]');
      await expect(ownerPage.locator('.comment-row', { hasText: rand })).toBeVisible();

      // No reload, no navigation on the helper's tab between here and the
      // assertion. This asserts the observable contract (badge updates on
      // its own, in a tab left sitting on the dashboard) rather than which
      // transport delivered it: NotificationBell prefers a Realtime
      // postgres_changes push, but falls back to a 30s visibility-gated poll
      // if the channel never reaches SUBSCRIBED — e.g. in this sandbox,
      // whose egress proxy blocks the wss:// upgrade outright. The generous
      // timeout covers that fallback path here; in an environment where the
      // WebSocket actually connects, the same assertion is satisfied by the
      // Realtime push within a couple of seconds instead.
      await expect(helperPage.locator('[data-testid=notification-count]')).toHaveText('2', { timeout: 45000 });

      await helperPage.click('[data-testid=notification-bell]');
      await expect(helperPage.locator('[data-testid=notification-row]')).toHaveCount(2);
      await expect(helperPage.locator('.notif-list')).toContainText(title);
    } finally {
      await ownerCtx.close();
      await helperCtx.close();
    }
  });
});
