const { test, expect } = require('@playwright/test');

test.describe('Proposal Generator E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    // Log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@company.com');
    await page.fill('#password', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');
  });

  test('Navigate, Generate Proposal from RFP, Export PDF/DOCX, and Finalize', async ({ page }) => {
    test.setTimeout(90000); // 1.5 minutes timeout for proposal AI generation + exports

    // 1. Visit RFP Analyzer
    await page.click('a[href="/rfp-analyzer"]');
    await page.waitForURL('**/rfp-analyzer');
    await expect(page.locator('.loading')).not.toBeVisible();

    // 2. Click the first extracted document row's View button
    // It navigates to /rfp-analyzer/:id
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow.locator('.badge')).toHaveText('extracted');
    
    // Click the row or find the View button
    // Let's check how the Actions column is rendered in RfpAnalyzerUpload.js
    // line 198: <button className="btn btn-primary btn-sm" onClick={() => navigate(`/rfp-analyzer/${doc.id}`)}>View</button>
    await firstRow.locator('button:has-text("View")').click();
    await page.waitForURL(/\/rfp-analyzer\/\d+/);
    await expect(page.locator('.loading')).not.toBeVisible();

    // 3. Click "Generate Proposal" button in the header
    await page.click('button:has-text("Generate Proposal")');
    await page.waitForURL(/\/rfp-analyzer\/\d+\/generate/);
    await expect(page.locator('.loading')).not.toBeVisible();

    // 4. Verify Company Profile form is displayed
    await expect(page.locator('h2:has-text("Company Profile")')).toBeVisible();

    // 5. Fill out company details
    const form = page.locator('form');
    await form.locator('input').nth(0).fill('Acme Corp');
    await form.locator('input').nth(1).fill('Technology & Equipment');
    await form.locator('input').nth(2).fill('Office Furniture and Tech Solutions');
    await form.locator('input').nth(3).fill('15');
    await form.locator('input').nth(4).fill('250 employees');
    await form.locator('input').nth(5).fill('ISO 9001, AWS Certified');
    await form.locator('textarea').fill('Acme Corp is a leading distributor with 24/7 support and guaranteed lowest pricing.');

    // 6. Click "Generate Proposal with AI"
    await page.click('button[type="submit"]:has-text("Generate Proposal with AI")');

    // 7. Wait for AI generation (polls background job)
    // Verify proposal display becomes visible (executive summary card should appear)
    await expect(page.locator('h2:has-text("Executive Summary")')).toBeVisible({ timeout: 60000 });
    const statusBadge = page.locator('.card.flex-between .badge').first();
    await expect(statusBadge).toHaveText(/generating|generated/);
    await expect(statusBadge).toHaveText('generated', { timeout: 10000 });

    // 8. Test Export PDF
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export PDF")')
    ]);
    expect(pdfDownload.suggestedFilename()).toContain('.pdf');

    // 9. Test Export DOCX
    const [docxDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export DOCX")')
    ]);
    expect(docxDownload.suggestedFilename()).toContain('.docx');

    // 10. Test Finalize Proposal
    await page.click('button:has-text("Finalize Proposal")');
    await expect(page.locator('.card.flex-between .badge').first()).toHaveText('finalized');

    // Edit button should disappear
    await expect(page.locator('button:has-text("Edit")').first()).not.toBeVisible();
  });
});
