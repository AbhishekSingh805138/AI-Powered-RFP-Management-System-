const { test, expect } = require('@playwright/test');

test.describe('RFP Lifecycle and Proposal E2E Tests', () => {
  const timestamp = Date.now();
  const dellName = `Dell_${timestamp}`;
  const dellEmail = `dell_${timestamp}@enterprise.com`;
  const hpName = `HP_${timestamp}`;
  const hpEmail = `hp_${timestamp}@solutions.com`;

  test('Complete RFP Lifecycle: Vendor -> RFP -> Dispatch -> Proposal -> AI Parse -> AI Compare', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes timeout because it calls OpenAI API multiple times

    // 1. Log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@company.com');
    await page.fill('#password', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');

    // 2. Go to Vendors and Add Dell Vendor
    await page.click('a[href="/vendors"]');
    await page.waitForURL('**/vendors');
    await expect(page.locator('.loading')).not.toBeVisible();
    await page.click('button:has-text("Add Vendor")');
    
    let vendorForm = page.locator('form');
    await vendorForm.locator('input').nth(0).fill(dellName);
    await vendorForm.locator('input').nth(1).fill(dellEmail);
    await vendorForm.locator('input').nth(2).fill('Dell Enterprise');
    await vendorForm.locator('input').nth(3).fill('1-800-DELL');
    await vendorForm.locator('input').nth(4).fill('IT');
    await vendorForm.locator('input').nth(5).fill('123 Dell Way');
    await vendorForm.locator('textarea').fill('Reliable hardware vendor');
    await page.click('button[type="submit"]:has-text("Add Vendor")');

    // Verify Dell added
    await expect(page.locator('table')).toContainText(dellEmail);

    // Add HP Vendor
    await page.click('button:has-text("Add Vendor")');
    vendorForm = page.locator('form');
    await vendorForm.locator('input').nth(0).fill(hpName);
    await vendorForm.locator('input').nth(1).fill(hpEmail);
    await vendorForm.locator('input').nth(2).fill('HP Solutions');
    await vendorForm.locator('input').nth(3).fill('1-800-HP');
    await vendorForm.locator('input').nth(4).fill('IT');
    await vendorForm.locator('input').nth(5).fill('456 HP Drive');
    await vendorForm.locator('textarea').fill('Alternative hardware vendor');
    await page.click('button[type="submit"]:has-text("Add Vendor")');

    // Verify HP added
    await expect(page.locator('table')).toContainText(hpEmail);

    // 3. Create a new RFP using AI
    await page.click('a[href="/rfps/new"]');
    await page.waitForURL('**/rfps/new');
    
    const rfpPrompt = `We need to procure 15 developer laptops and 5 wireless keyboards. The budget is $25,000 USD. We require delivery in 20 days. Payment terms must be Net 30. Laptops should have 32GB RAM and 1TB SSD. We require a 3-year warranty.`;
    await page.fill('textarea', rfpPrompt);
    await page.click('button[type="submit"]:has-text("Create RFP with AI")');

    // 4. Wait for the AI requirements extraction and redirect to RFP detail
    await page.waitForURL(/\/rfps\/\d+/);
    await expect(page.locator('.loading')).not.toBeVisible();
    await expect(page.locator('.page-header h1')).toContainText('RFP-');
    await expect(page.locator('span.badge')).toHaveText('draft');

    // Verify details extracted
    await expect(page.locator('.card:has-text("RFP Details")')).toContainText('$25,000 USD');
    await expect(page.locator('.card:has-text("RFP Details")')).toContainText('20 days');
    await expect(page.locator('table')).toContainText('Laptop', { ignoreCase: true });

    // 5. Send RFP to both vendors
    // Select checkboxes for both vendors
    await page.locator(`input[type="checkbox"] + label:has-text("${dellName}")`).click();
    await page.locator(`input[type="checkbox"] + label:has-text("${hpName}")`).click();
    await page.click('button:has-text("Send to 2 vendor")');
    await expect(page.locator('.success-msg')).toContainText('Sent to', { timeout: 15000 });

    // 6. Add Proposals manually
    // Dell Proposal
    await page.click('button:has-text("+ Add Manually")');
    const dellPropText = `Dell Proposal. We offer 15 developer laptops with 32GB RAM, 1TB SSD for $20,000. 5 wireless keyboards for $500. Total price is $20,500. Delivery in 14 days. 3-year warranty included. Payment terms: Net 30.`;
    await page.locator('form select').selectOption({ label: dellName });
    await page.locator('form textarea').fill(dellPropText);
    await page.click('button[type="submit"]:has-text("Add Proposal")');
    await expect(page.locator('.success-msg')).toContainText('Proposal added');

    // HP Proposal
    await page.click('button:has-text("+ Add Manually")');
    const hpPropText = `HP Proposal. We offer 15 developer laptops with 32GB RAM, 1TB SSD for $22,000. 5 wireless keyboards for $600. Total price is $22,600. Delivery in 18 days. 2-year warranty included. Payment terms: Net 30.`;
    await page.locator('form select').selectOption({ label: hpName });
    await page.locator('form textarea').fill(hpPropText);
    await page.click('button[type="submit"]:has-text("Add Proposal")');
    await expect(page.locator('.success-msg')).toContainText('Proposal added');

    // 7. Parse Proposals with AI
    // Get rows in proposal table
    const dellRow = page.locator(`table:has-text("Total Price") tr:has-text("${dellName}")`);
    await dellRow.locator('button:has-text("Parse with AI")').click();
    // Wait for badge to turn into "parsed" or "error"
    await expect(dellRow.locator('.badge')).toHaveText('parsed', { timeout: 30000 });

    const hpRow = page.locator(`table:has-text("Total Price") tr:has-text("${hpName}")`);
    await hpRow.locator('button:has-text("Parse with AI")').click();
    await expect(hpRow.locator('.badge')).toHaveText('parsed', { timeout: 30000 });

    // 8. Compare proposals
    await page.click('button:has-text("Compare 2 Proposals")');
    await expect(page.locator('h3:has-text("Recommended:")')).toBeVisible({ timeout: 45000 });
    
    // Dell should be recommended because it has lower price and longer warranty
    await expect(page.locator('h3:has-text("Recommended:")')).toContainText('Recommended: ' + dellName);
    
    // Verify comparison breakdown table is displayed
    await expect(page.locator('.comparison-table')).toBeVisible();
    await expect(page.locator('.comparison-table')).toContainText(dellName);
    await expect(page.locator('.comparison-table')).toContainText(hpName);
  });
});
