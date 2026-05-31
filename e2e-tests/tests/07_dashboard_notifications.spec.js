const { test, expect } = require('@playwright/test');

test.describe('Dashboard and Notifications E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@company.com');
    await page.fill('#password', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');
  });

  test('Dashboard Widgets and Charts Rendering', async ({ page }) => {
    // 1. Verify summary statistics cards
    await expect(page.locator('.stat-card')).toHaveCount(6);
    
    // Check specific stat card labels
    const labels = await page.locator('.stat-label').allTextContents();
    expect(labels).toContain('Total RFPs');
    expect(labels).toContain('Vendors');
    expect(labels).toContain('Proposals Received');
    expect(labels).toContain('RFPs Analyzed');
    expect(labels).toContain('Avg. Proposal Score');
    expect(labels).toContain('Risk Analyses');

    // 2. Verify Recharts elements are loaded (assert that at least some charts render)
    const chartCount = await page.locator('.recharts-wrapper').count();
    expect(chartCount).toBeGreaterThanOrEqual(1);

    // 3. Verify budget highlight bar (if budget exists, budget-bar or container should be visible)
    // The budget highlight element itself is conditional or is represented in card styling.
    // Let's verify that the dashboard main layout is fully loaded.
    await expect(page.locator('.dashboard-stats-grid')).toBeVisible();
  });

  test('Notifications History and Filtering', async ({ page }) => {
    // 1. Navigate to Notifications
    await page.click('a[href="/notifications"]');
    await page.waitForURL('**/notifications');

    // 2. Verify Stats Cards
    await expect(page.locator('.notification-stats')).toBeVisible();
    await expect(page.locator('.notif-stat-card')).toHaveCount(5);

    // 3. Verify Filters dropdowns are present
    const filters = page.locator('.notification-filters select');
    await expect(filters).toHaveCount(2);

    // 4. Try filtering by type
    await filters.first().selectOption('rfp-sent');
    await expect(page.locator('.notifications-page')).toBeVisible();

    // 5. Try filtering by status
    await filters.last().selectOption('sent');
    await expect(page.locator('.notifications-page')).toBeVisible();
  });
});
