const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Compliance Checker and Risk Analyzer E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@company.com');
    await page.fill('#password', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');
  });

  test('Document Upload, Compliance Check, and Risk Analysis', async ({ page }) => {
    test.setTimeout(90000); // 1.5 minutes timeout for document analysis + compliance + risk AI calls

    // 1. Navigate to RFP Analyzer and upload sample_rfp.pdf
    await page.click('a[href="/rfp-analyzer"]');
    await page.waitForURL('**/rfp-analyzer');
    await expect(page.locator('.loading')).not.toBeVisible();

    const pdfPath = path.join(__dirname, '../sample_rfp.pdf');
    // Upload file using Playwright
    await page.setInputFiles('input[type="file"]', pdfPath);

    // 2. Wait for PDF upload and extraction to succeed
    // Verify status changes to extracted
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow.locator('.badge')).toHaveText('extracted', { timeout: 45000 });

    // 3. Navigate to Compliance Checker
    await page.click('a[href="/compliance"]');
    await page.waitForURL('**/compliance');
    await expect(page.locator('.loading')).not.toBeVisible();

    // 4. Select the newly uploaded RFP document (it should be selected by its text or value)
    await page.selectOption('select', { index: 1 }); // selects first option after placeholder

    // 5. Choose "Paste Proposal Text"
    await page.click('button:has-text("Paste Proposal Text")');

    // 6. Fill proposal text
    const sampleProposalText = `We are pleased to submit our proposal for Project Alpha:
- 20 Developer Laptops (32GB RAM, 512GB SSD, Intel Core i7) - $18,000 USD
- 15 4K 27-inch IPS Monitors - $6,000 USD
- 10 Standing Desks - $5,000 USD
- Delivery: Complete delivery in 14 days.
- Warranty: 3-year warranty included.
- Payment Terms: Net 30 days.`;

    await page.fill('textarea', sampleProposalText);

    // 7. Click Run Compliance Check
    await page.click('button:has-text("Run Compliance Check")');

    // 8. Verify Compliance Report is displayed
    await expect(page.locator('h2:has-text("Compliance Report")')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.compliance-score-circle')).toBeVisible();

    // 9. Navigate to Risk Analyzer
    await page.click('a[href="/risk-analyzer"]');
    await page.waitForURL('**/risk-analyzer');
    await expect(page.locator('.loading')).not.toBeVisible();

    // 10. Select the RFP document
    await page.selectOption('select', { index: 1 });

    // 11. Click Run Risk Analysis
    await page.click('button:has-text("Run Risk Analysis")');

    // 12. Verify Risk analysis report is shown
    await expect(page.locator('h2:has-text("Risk Assessment Report")')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.risk-score-circle')).toBeVisible();
    await expect(page.locator('h2:has-text("Risk Matrix")')).toBeVisible();
    await expect(page.locator('table:has-text("Severity")')).toBeVisible();
  });
});
