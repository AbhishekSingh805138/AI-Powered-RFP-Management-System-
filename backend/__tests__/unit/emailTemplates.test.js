/**
 * Unit tests for emailTemplates
 */

const templates = require('../../src/services/emailTemplates');

describe('emailTemplates', () => {
  describe('rfpSentToVendor', () => {
    test('generates subject, html, and text', () => {
      const result = templates.rfpSentToVendor({
        vendorName: 'Acme Corp',
        rfpTitle: 'Office Supplies',
        rfpId: 5,
        budget: 50000,
        deadline: '2026-12-31',
        items: [{ name: 'Chairs', quantity: 100, specifications: 'Ergonomic' }],
        appUrl: 'https://app.test.com',
      });

      expect(result.subject).toContain('RFP-0005');
      expect(result.subject).toContain('Office Supplies');
      expect(result.html).toContain('Acme Corp');
      expect(result.html).toContain('50,000');
      expect(result.html).toContain('Chairs');
      expect(result.html).toContain('https://app.test.com/rfps/5');
      expect(result.text).toContain('Acme Corp');
    });

    test('handles missing optional fields', () => {
      const result = templates.rfpSentToVendor({
        vendorName: 'Test Vendor',
        rfpTitle: 'Test RFP',
        rfpId: 1,
      });

      expect(result.subject).toContain('RFP-0001');
      expect(result.html).toContain('Test Vendor');
      expect(result.text).toBeTruthy();
    });
  });

  describe('proposalReceived', () => {
    test('generates notification for RFP owner', () => {
      const result = templates.proposalReceived({
        userName: 'John',
        vendorName: 'Acme',
        vendorCompany: 'Acme Inc',
        rfpTitle: 'IT Equipment',
        rfpId: 10,
        proposalId: 3,
        appUrl: 'https://app.test.com',
      });

      expect(result.subject).toContain('Acme');
      expect(result.subject).toContain('RFP-0010');
      expect(result.html).toContain('John');
      expect(result.html).toContain('Acme Inc');
      expect(result.html).toContain('https://app.test.com/rfps/10');
    });
  });

  describe('rfpStatusChanged', () => {
    test('shows old and new status', () => {
      const result = templates.rfpStatusChanged({
        recipientName: 'Alice',
        rfpTitle: 'Cloud Services',
        rfpId: 7,
        oldStatus: 'draft',
        newStatus: 'sent',
      });

      expect(result.subject).toContain('sent');
      expect(result.html).toContain('draft');
      expect(result.html).toContain('sent');
      expect(result.html).toContain('Alice');
      expect(result.text).toContain('draft');
      expect(result.text).toContain('sent');
    });
  });

  describe('riskAnalysisComplete', () => {
    test('shows risk level and score', () => {
      const result = templates.riskAnalysisComplete({
        userName: 'Bob',
        rfpTitle: 'Security Audit',
        rfpDocumentId: 12,
        riskLevel: 'high',
        riskScore: 78,
        appUrl: 'https://app.test.com',
      });

      expect(result.subject).toContain('high risk');
      expect(result.html).toContain('high');
      expect(result.html).toContain('78/100');
      expect(result.text).toContain('78/100');
    });
  });

  describe('extractionComplete', () => {
    test('shows document title and requirement count', () => {
      const result = templates.extractionComplete({
        userName: 'Carol',
        documentTitle: 'Enterprise RFP',
        documentId: 15,
        requirementCount: 23,
        appUrl: 'https://app.test.com',
      });

      expect(result.subject).toContain('Enterprise RFP');
      expect(result.html).toContain('Carol');
      expect(result.html).toContain('23 extracted');
      expect(result.html).toContain('https://app.test.com/rfp-analyzer/15');
      expect(result.text).toContain('23 requirements');
    });
  });
});
