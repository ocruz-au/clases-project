import { test, expect } from '@playwright/test';

/**
 * E2E journey: Student cancels an existing confirmed booking.
 *
 * Prerequisites:
 * - Student has at least one CONFIRMED upcoming booking
 */

const STUDENT_EMAIL = process.env['E2E_STUDENT_EMAIL'] ?? 'student@example.com';
const STUDENT_PASSWORD = process.env['E2E_STUDENT_PASSWORD'] ?? 'Test1234!';

test.describe('Cancellation journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(STUDENT_EMAIL);
    await page.getByLabel('Password').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/classes|\/dashboard/);
  });

  test('student can view their upcoming bookings', async ({ page }) => {
    await page.goto('/bookings');
    await expect(page.getByRole('heading', { name: /bookings/i })).toBeVisible();
  });

  test('confirmed booking shows cancel button', async ({ page }) => {
    await page.goto('/bookings');
    const confirmedBooking = page.locator('[data-testid="booking-card"][data-status="CONFIRMED"]').first();
    if (await confirmedBooking.isVisible()) {
      await expect(confirmedBooking.getByRole('button', { name: /cancel/i })).toBeVisible();
    }
  });

  test('student can cancel a booking and sees confirmation', async ({ page }) => {
    await page.goto('/bookings');
    const confirmedBooking = page.locator('[data-testid="booking-card"][data-status="CONFIRMED"]').first();
    if (!(await confirmedBooking.isVisible())) {
      test.skip();
      return;
    }
    await confirmedBooking.getByRole('button', { name: /cancel/i }).click();
    // Confirmation dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /confirm cancellation/i }).click();
    await expect(page.getByText(/booking cancelled/i)).toBeVisible();
  });

  test('cancelled booking no longer appears in upcoming bookings', async ({ page }) => {
    await page.goto('/bookings');
    const cancelledBookings = page.locator('[data-testid="booking-card"][data-status="CANCELLED"]');
    // Cancelled bookings should not appear in the default upcoming view
    await expect(cancelledBookings).toHaveCount(0);
  });
});
