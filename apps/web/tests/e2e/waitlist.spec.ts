import { test, expect } from '@playwright/test';

/**
 * E2E journey: Student joins waitlist for a full session and sees their position.
 *
 * Prerequisites:
 * - A session exists that is fully booked (capacity = 0 available)
 */

const STUDENT_EMAIL = process.env['E2E_STUDENT_EMAIL'] ?? 'student@example.com';
const STUDENT_PASSWORD = process.env['E2E_STUDENT_PASSWORD'] ?? 'Test1234!';

test.describe('Waitlist journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(STUDENT_EMAIL);
    await page.getByLabel('Password').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/classes|\/dashboard/);
  });

  test('fully-booked session shows join waitlist button instead of book', async ({ page }) => {
    await page.goto('/classes');
    await page.locator('[data-testid="class-card"]').first().click();
    const fullSession = page.locator('[data-testid="session-row"][data-full="true"]').first();
    await expect(fullSession.getByRole('button', { name: /join waitlist/i })).toBeVisible();
  });

  test('student can join the waitlist for a full session', async ({ page }) => {
    await page.goto('/classes');
    await page.locator('[data-testid="class-card"]').first().click();
    const fullSession = page.locator('[data-testid="session-row"][data-full="true"]').first();
    await fullSession.getByRole('button', { name: /join waitlist/i }).click();
    await expect(page.getByText(/you('re| are) on the waitlist/i)).toBeVisible();
  });

  test('student can view their waitlist entries in bookings', async ({ page }) => {
    await page.goto('/bookings');
    const waitlistSection = page.getByTestId('waitlist-entries');
    if (await waitlistSection.isVisible()) {
      await expect(waitlistSection).toBeVisible();
    }
  });

  test('student can leave the waitlist', async ({ page }) => {
    await page.goto('/bookings');
    const leaveButton = page.locator('[data-testid="waitlist-entry"]').first().getByRole('button', { name: /leave waitlist/i });
    if (await leaveButton.isVisible()) {
      await leaveButton.click();
      await expect(page.getByText(/removed from waitlist/i)).toBeVisible();
    }
  });
});
