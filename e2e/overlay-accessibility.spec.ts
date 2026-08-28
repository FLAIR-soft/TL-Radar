import { test, expect } from '@playwright/test';
import { register, uniqueName } from './helpers';

// Stage 7 gave every overlay (SlideOver, CommandPalette, NotificationBell) a
// shared focus trap + Escape-to-close-with-focus-restore, and scroll lock for
// the two that fully cover the viewport. Nothing in golden-path.spec.ts
// exercised any of that — these tests close that gap.
test.describe('overlay accessibility', () => {
  test('SlideOver traps focus, locks background scroll, and restores focus to its trigger on close', async ({
    page,
  }) => {
    const owner = uniqueName('A1');
    await register(page, owner.firstName, owner.lastName);

    await page.click('text=Projekte');
    await page.waitForURL('**/projects');

    const trigger = page.locator('[data-testid=open-create-project]');
    await trigger.click();

    const panel = page.locator('.slideover-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    const labelledby = await panel.getAttribute('aria-labelledby');
    expect(labelledby).toBeTruthy();
    await expect(page.locator(`#${labelledby}`)).toHaveText(/./);

    // Opening moves focus inside the panel (first focusable element), not
    // left dangling on the page behind it.
    const focusInPanel = await page.evaluate(() => !!document.activeElement?.closest('.slideover-panel'));
    expect(focusInPanel).toBe(true);

    // Background can't be scrolled while the panel covers the viewport.
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');

    // Shift+Tab from the first focusable element wraps to the last one
    // inside the panel instead of escaping onto the page behind it.
    await page.keyboard.press('Shift+Tab');
    const wrappedInsidePanel = await page.evaluate(() => !!document.activeElement?.closest('.slideover-panel'));
    expect(wrappedInsidePanel).toBe(true);

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
    await expect(trigger).toBeFocused();
  });

  test('command palette traps focus and Escape closes it from any focused item inside', async ({ page }) => {
    const owner = uniqueName('A2');
    await register(page, owner.firstName, owner.lastName);

    const trigger = page.locator('[data-testid=command-palette-trigger]');
    await trigger.click();

    const panel = page.locator('[data-testid=command-palette]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    await expect(panel).toHaveAttribute('aria-label', /.+/);
    await expect(page.locator('[data-testid=command-palette-input]')).toBeFocused();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');

    // Move focus off the input onto a list item — arrow-key/Escape handling
    // now lives on the panel container (stage 7), so it must still work from
    // there, not just while the input itself is focused.
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid=command-palette-option]').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
    await expect(trigger).toBeFocused();
  });

  test('notification panel is a non-modal popover: focus trap without locking background scroll', async ({
    page,
  }) => {
    const owner = uniqueName('A3');
    await register(page, owner.firstName, owner.lastName);

    const bell = page.locator('[data-testid=notification-bell]');
    await bell.click();

    const panel = page.locator('.notif-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(panel).not.toHaveAttribute('aria-modal', 'true');

    const focusInPanel = await page.evaluate(() => !!document.activeElement?.closest('.notif-panel'));
    expect(focusInPanel).toBe(true);

    // No backdrop covers the page behind a notification popover, so unlike
    // SlideOver/CommandPalette it must not lock scrolling.
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(overflow).not.toBe('hidden');

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(bell).toBeFocused();
  });
});
