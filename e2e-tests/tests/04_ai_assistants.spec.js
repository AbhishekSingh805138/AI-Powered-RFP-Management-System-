const { test, expect } = require('@playwright/test');

test.describe('AI Assistants E2E Tests (Search & Chatbot)', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@company.com');
    await page.fill('#password', 'SecurePass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');
  });

  test('Semantic Search: Indexing and Performing Queries', async ({ page }) => {
    test.setTimeout(120000);

    // 1. Navigate to Semantic Search
    await page.click('a[href="/search"]');
    await page.waitForURL('**/search');
    await expect(page.locator('.loading')).not.toBeVisible();

    // 2. Index all documents in database
    await page.click('button:has-text("Index All Documents")');
    // Wait for the success alert to show indicating indexing is done
    await expect(page.locator('.success-msg')).toContainText('Indexed', { timeout: 90000 });

    // 3. Search for "laptops"
    await page.fill('input.search-input', 'developer laptops');
    await page.click('button[type="submit"]:has-text("Search")');

    // 4. Verify search results are returned
    await expect(page.locator('.rag-answer')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.source-item').first()).toBeVisible();

    // 5. Test filtering by "Vendor Proposals"
    await page.selectOption('select.search-filter', 'proposal');
    await page.click('button[type="submit"]:has-text("Search")');
    await expect(page.locator('.rag-answer')).toBeVisible();
    
    // Search result tags should only contain 'Vendor Proposal'
    const sourceBadges = await page.locator('.source-item .badge').allTextContents();
    for (const badge of sourceBadges) {
      expect(badge).toBe('Vendor Proposal');
    }
  });

  test('AI Chatbot: Interactive Dialogue and Citation Check', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Navigate to Chatbot
    await page.click('a[href="/chatbot"]');
    await page.waitForURL('**/chatbot');
    await expect(page.locator('.loading')).not.toBeVisible();

    // 2. Click "+ New" to start a clean session
    await page.click('button:has-text("+ New")');
    await expect(page.locator('h2')).toContainText('New Conversation');

    // 3. Ask about Dell warranty
    const query = 'What is the warranty period offered by Dell?';
    await page.fill('textarea.chat-input', query);
    await page.click('button.chat-send-btn');

    // 4. Wait for AI typing indicator to disappear and response to load
    await expect(page.locator('.chat-typing-indicator')).not.toBeVisible({ timeout: 25000 });
    
    // 5. Verify chatbot replied and cited sources
    const lastMsg = page.locator('.chat-message-assistant').last();
    await expect(lastMsg).toBeVisible();
    await expect(lastMsg.locator('.chat-message-content')).toContainText('Dell');
    await expect(lastMsg.locator('.chat-message-content')).toContainText(/3[- ]?years?/); // from Dell's proposal we submitted
    await expect(lastMsg.locator('.chat-source-chip').first()).toBeVisible();
    await expect(lastMsg.locator('.chat-source-chip').first()).toContainText('Vendor Proposal');

    // 6. Test clicking a suggestion chip
    const suggestionBtn = page.locator('.suggestion-chip').first();
    const suggestionText = await suggestionBtn.textContent();
    await suggestionBtn.click();
    
    // Verify it sent the message and received response
    await expect(page.locator('.chat-typing-indicator')).not.toBeVisible({ timeout: 25000 });
    await expect(page.locator('.chat-message-user').last()).toContainText(suggestionText);
  });
});
