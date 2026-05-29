/**
 * Unit tests for exportService — PDF and DOCX generation.
 */

const { generatePdf, generateDocx } = require('../../src/services/exportService');
const { createMockGeneratedProposal, createMockProposalContent } = require('../helpers/mockFactories');

describe('exportService', () => {
  describe('generatePdf', () => {
    test('generates a valid PDF buffer from a full proposal', async () => {
      const proposal = createMockGeneratedProposal();
      const buffer = await generatePdf(proposal);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      // PDF files start with %PDF-
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    test('generates PDF with minimal proposal content', async () => {
      const proposal = createMockGeneratedProposal({
        proposalContent: {
          title: 'Minimal Proposal',
          executive_summary: 'A brief summary.',
        },
      });
      const buffer = await generatePdf(proposal);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    test('handles proposal with empty proposalContent', async () => {
      const proposal = createMockGeneratedProposal({ proposalContent: {} });
      const buffer = await generatePdf(proposal);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    test('handles proposal with null companyProfile', async () => {
      const proposal = createMockGeneratedProposal({ companyProfile: null });
      const buffer = await generatePdf(proposal);

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    test('renders all proposal sections', async () => {
      const proposal = createMockGeneratedProposal();
      const buffer = await generatePdf(proposal);

      // A full proposal should produce a substantial PDF
      expect(buffer.length).toBeGreaterThan(1000);
    });

    test('handles technical approach with missing optional fields', async () => {
      const proposal = createMockGeneratedProposal({
        proposalContent: {
          ...createMockProposalContent(),
          technical_approach: {
            overview: 'Basic overview',
            // no methodology, solution_components, or innovation
          },
        },
      });
      const buffer = await generatePdf(proposal);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    test('handles scope_of_work without activities/deliverables', async () => {
      const proposal = createMockGeneratedProposal({
        proposalContent: {
          ...createMockProposalContent(),
          scope_of_work: [
            { phase: 'Phase 1', description: 'First phase' },
          ],
        },
      });
      const buffer = await generatePdf(proposal);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    test('handles cost_breakdown without line_items', async () => {
      const proposal = createMockGeneratedProposal({
        proposalContent: {
          ...createMockProposalContent(),
          cost_breakdown: {
            summary: 'Budget overview',
            total_estimated_cost: '$100,000',
          },
        },
      });
      const buffer = await generatePdf(proposal);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('generateDocx', () => {
    test('generates a valid DOCX buffer from a full proposal', async () => {
      const proposal = createMockGeneratedProposal();
      const buffer = await generateDocx(proposal);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      // DOCX files are ZIP archives starting with PK
      expect(buffer.slice(0, 2).toString()).toBe('PK');
    });

    test('generates DOCX with minimal proposal content', async () => {
      const proposal = createMockGeneratedProposal({
        proposalContent: {
          title: 'Minimal Proposal',
          executive_summary: 'A brief summary.',
        },
      });
      const buffer = await generateDocx(proposal);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.slice(0, 2).toString()).toBe('PK');
    });

    test('handles proposal with empty proposalContent', async () => {
      const proposal = createMockGeneratedProposal({ proposalContent: {} });
      const buffer = await generateDocx(proposal);

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    test('handles proposal with null companyProfile', async () => {
      const proposal = createMockGeneratedProposal({ companyProfile: null });
      const buffer = await generateDocx(proposal);

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    test('renders all proposal sections', async () => {
      const proposal = createMockGeneratedProposal();
      const buffer = await generateDocx(proposal);

      // Full proposal should produce a substantial DOCX
      expect(buffer.length).toBeGreaterThan(1000);
    });

    test('handles timeline without milestones', async () => {
      const proposal = createMockGeneratedProposal({
        proposalContent: {
          ...createMockProposalContent(),
          timeline: { total_duration: '3 months' },
        },
      });
      const buffer = await generateDocx(proposal);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    test('handles team_composition as non-array', async () => {
      const proposal = createMockGeneratedProposal({
        proposalContent: {
          ...createMockProposalContent(),
          team_composition: 'Small team of 5',
        },
      });
      const buffer = await generateDocx(proposal);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    test('handles risk_mitigation as non-array', async () => {
      const proposal = createMockGeneratedProposal({
        proposalContent: {
          ...createMockProposalContent(),
          risk_mitigation: 'Low risk project',
        },
      });
      const buffer = await generateDocx(proposal);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    test('handles differentiators as non-array', async () => {
      const proposal = createMockGeneratedProposal({
        proposalContent: {
          ...createMockProposalContent(),
          differentiators: 'We are the best',
        },
      });
      const buffer = await generateDocx(proposal);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });
});
