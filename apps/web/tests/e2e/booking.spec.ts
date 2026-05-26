import { test, expect } from '@playwright/test';

/**
 * E2E journey: Student browses classes, selects a session, and completes checkout.
 *
 * Prerequisites (handled by test setup or a running seeded environment):
 * - A class with at least one upcoming session exists
 * - Stripe is in test mode; card 4242 4242 4242 4242 always succeeds
 */

const STUDENT_EMAIL = process.env['E2E_STUDENT_EMAIL'] ?? 'student@example.com';
const STUDENT_PASSWORD = process.env['E2E_STUDENT_PASSWORD'] ?? 'Test1234!';

test.describe('Booking journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(STUDENT_EMAIL);
    await page.getByLabel('Password').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/classes|\/dashboard/);
  });

  test('student can view class list', async ({ page }) => {
    await page.goto('/classes');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const classCards = page.locator('[data-testid="class-card"]');
    await expect(classCards.first()).toBeVisible();
  });

  test('student can view class detail and see sessions', async ({ page }) => {
    await page.goto('/classes');
    await page.locator('[data-testid="class-card"]').first().click();
    await expect(page.getByText(/upcoming sessions/i)).toBeVisible();
    const sessionRows = page.locator('[data-testid="session-row"]');
    await expect(sessionRows.first()).toBeVisible();
  });

  test('student can initiate checkout for a session', async ({ page }) => {
    await page.goto('/classes');
    await page.locator('[data-testid="class-card"]').first().click();
    await page.locator('[data-testid="session-row"]').first().getByRole('button', { name: /book/i }).click();
    await expect(page).toHaveURL(/\/bookings\/checkout/);
    await expect(page.getByText(/order summary/i)).toBeVisible();
  });

  test('checkout page shows session details and price', async ({ page }) => {
    await page.goto('/classes');
    await page.locator('[data-testid="class-card"]').first().click();
    await page.locator('[data-testid="session-row"]').first().getByRole('button', { name: /book/i }).click();
    await expect(page).toHaveURL(/\/bookings\/checkout/);
    await expect(page.getByTestId('checkout-price')).toBeVisible();
    await expect(page.getByTestId('checkout-session-info')).toBeVisible();
  });
});
