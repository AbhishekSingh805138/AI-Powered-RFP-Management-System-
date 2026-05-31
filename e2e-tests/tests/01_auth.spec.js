const { test, expect } = require('@playwright/test');

test.describe('Authentication and RBAC E2E Tests', () => {
  const viewerEmail = `viewer_${Date.now()}@company.com`;
  const viewerPassword = 'Password123';

  test('Public Self-Registration and Login', async ({ page }) => {
    // 1. Visit registration page
    await page.goto('/register');
    await expect(page.locator('h2')).toHaveText('Create Account');

    // 2. Fill registration form
    await page.fill('#firstName', 'Viewer');
    await page.fill('#lastName', 'User');
    await page.fill('#email', viewerEmail);
    await page.fill('#password', viewerPassword);
    await page.fill('#confirmPassword', viewerPassword);

    // 3. Submit registration
    await page.click('button[type="submit"]');

    // 4. Verify redirected to dashboard and logged in as viewer
    await page.waitForURL('**/');
    await expect(page.locator('.sidebar-user-name')).toHaveText('Viewer User');
    await expect(page.locator('.sidebar-user-role')).toHaveText('viewer');
  });

  test('Viewer RBAC Limits (Navigation Sidebar and Direct URLs)', async ({ page }) => {
    // 1. Log in as the viewer user
    await page.goto('/login');
    await page.fill('#email', viewerEmail);
    await page.fill('#password', viewerPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');

    // 2. Verify sidebar links (restricted links should NOT be visible)
    const sidebarLinks = page.locator('nav a');
    await expect(sidebarLinks).toContainText(['Dashboard', 'RFPs', 'Vendors', 'Proposals', 'RFP Analyzer', 'Semantic Search', 'AI Chatbot', 'Notifications']);
    
    // Restricted links:
    await expect(page.locator('nav')).not.toContainText('Create RFP');
    await expect(page.locator('nav')).not.toContainText('Compliance Checker');
    await expect(page.locator('nav')).not.toContainText('Risk Analyzer');
    await expect(page.locator('nav')).not.toContainText('User Management');

    // 3. Attempt to access restricted pages directly via URL (should be blocked with permission error page)
    // Go to Create RFP (should show permission error)
    await page.goto('/rfps/new');
    await expect(page.locator('.error-page')).toContainText('You do not have permission to view this page.');
    
    // Go to User Management (should show permission error)
    await page.goto('/admin/users');
    await expect(page.locator('.error-page')).toContainText('You do not have permission to view this page.');
  });

  test('Admin Account Login and Sidebar Visibility', async ({ page }) => {
    // 1. Log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@company.com');
    await page.fill('#password', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');

    // 2. Verify admin sidebar user details
    await expect(page.locator('.sidebar-user-name')).toHaveText('Admin User');
    await expect(page.locator('.sidebar-user-role')).toHaveText('admin');

    // 3. Verify admin sees ALL links in the sidebar
    const sidebar = page.locator('nav');
    await expect(sidebar).toContainText('Dashboard');
    await expect(sidebar).toContainText('RFPs');
    await expect(sidebar).toContainText('Create RFP');
    await expect(sidebar).toContainText('Vendors');
    await expect(sidebar).toContainText('Proposals');
    await expect(sidebar).toContainText('RFP Analyzer');
    await expect(sidebar).toContainText('Semantic Search');
    await expect(sidebar).toContainText('Compliance Checker');
    await expect(sidebar).toContainText('Risk Analyzer');
    await expect(sidebar).toContainText('AI Chatbot');
    await expect(sidebar).toContainText('Notifications');
    await expect(sidebar).toContainText('User Management');
  });

  test('Logout Functionality', async ({ page }) => {
    // 1. Log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@company.com');
    await page.fill('#password', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');

    // 2. Click logout
    await page.click('.btn-logout');

    // 3. Verify redirected to login page
    await page.waitForURL('**/login');
    await expect(page.locator('h2')).toHaveText('Sign In');
  });
});
