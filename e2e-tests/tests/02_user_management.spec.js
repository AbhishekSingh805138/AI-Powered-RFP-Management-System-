const { test, expect } = require('@playwright/test');

test.describe('Admin User Management E2E Tests', () => {
  const managerEmail = `manager_${Date.now()}@company.com`;
  const managerPassword = 'Password123';

  test.beforeEach(async ({ page }) => {
    // Log in as admin before each test
    await page.goto('/login');
    await page.fill('#email', 'admin@company.com');
    await page.fill('#password', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');
    
    // Navigate to User Management
    await page.click('a[href="/admin/users"]');
    await page.waitForURL('**/admin/users');
    await expect(page.locator('.loading')).not.toBeVisible();
  });

  test('Admin User Creation and Validation', async ({ page }) => {
    // 1. Click Create User button to open form
    await page.click('button:has-text("+ Create User")');
    await expect(page.locator('h3:has-text("Create New User")')).toBeVisible();

    // 2. Fill form fields
    // Playwright locates by index inside the form card
    const form = page.locator('form').first();
    await form.locator('input[type="text"]').first().fill('Manager');
    await form.locator('input[type="text"]').last().fill('User');
    await form.locator('input[type="email"]').fill(managerEmail);
    await form.locator('input[type="password"]').fill(managerPassword);
    await form.locator('select').selectOption('manager');

    // 3. Submit form
    await page.click('button[type="submit"]:has-text("Create User")');

    // 4. Verify user was created and is visible in the list
    await expect(page.locator('table')).toContainText(managerEmail);
    await expect(page.locator('table tr:has-text("' + managerEmail + '")')).toContainText('Manager User');
  });

  test('Search and Filter Users', async ({ page }) => {
    // 1. Enter manager email in search box
    await page.fill('input[placeholder="Search users..."]', managerEmail);
    await page.click('button:has-text("Search")');

    // 2. Verify only the matching user is displayed
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await expect(page.locator('table')).toContainText(managerEmail);
  });

  test('Suspend and Reactivate User Account', async ({ page }) => {
    // 1. Find row for manager user
    const row = page.locator('table tr:has-text("' + managerEmail + '")');
    
    // 2. Click Suspend button
    await row.locator('button:has-text("Suspend")').click();

    // 3. Verify status badge changed to suspended and button changed to Activate
    await expect(row.locator('.badge')).toHaveText('suspended');
    await expect(row.locator('button:has-text("Activate")')).toBeVisible();

    // 4. Click Activate button
    await row.locator('button:has-text("Activate")').click();

    // 5. Verify status badge changed to active and button changed to Suspend
    await expect(row.locator('.badge')).toHaveText('active');
    await expect(row.locator('button:has-text("Suspend")')).toBeVisible();
  });

  test('Change User Role via Dropdown', async ({ page }) => {
    // 1. Find row for manager user
    const row = page.locator('table tr:has-text("' + managerEmail + '")');
    
    // 2. Change role from Manager to Admin
    await row.locator('select').selectOption('admin');

    // 3. Verify role change is successful (dropdown value remains admin)
    await expect(row.locator('select')).toHaveValue('admin');

    // 4. Revert role to Manager
    await row.locator('select').selectOption('manager');
    await expect(row.locator('select')).toHaveValue('manager');
  });

  test('Duplicate Email Registration Prevention', async ({ page }) => {
    // 1. Click Create User button
    await page.click('button:has-text("+ Create User")');

    // 2. Fill form with existing managerEmail
    const form = page.locator('form').first();
    await form.locator('input[type="text"]').first().fill('Another');
    await form.locator('input[type="text"]').last().fill('User');
    await form.locator('input[type="email"]').fill(managerEmail);
    await form.locator('input[type="password"]').fill('Password123');
    await form.locator('select').selectOption('viewer');

    // 3. Submit
    await page.click('button[type="submit"]:has-text("Create User")');

    // 4. Verify alert error message shows duplicate email error
    await expect(page.locator('.alert.alert-error')).toContainText('already registered');
  });
});
