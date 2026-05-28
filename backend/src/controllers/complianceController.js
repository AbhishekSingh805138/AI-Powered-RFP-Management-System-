const { RfpDocument, GeneratedProposal } = require('../models');
const complianceService = require('../services/complianceService');

// POST /api/compliance/check — Run compliance check
async function checkCompliance(req, res, next) {
  try {
    const { rfpDocumentId, generatedProposalId, proposalText } = req.body;

    if (!rfpDocumentId) {
      return res.status(400).json({ error: 'rfpDocumentId is required' });
    }

    // Get the RFP document with extracted requirements
    const rfpDoc = await RfpDocument.findByPk(rfpDocumentId);
    if (!rfpDoc) return res.status(404).json({ error: 'RFP Document not found' });
    if (!rfpDoc.extractedData) {
      return res.status(400).json({ error: 'RFP requirements must be extracted first' });
    }

    // Get proposal content — either from generated proposal or raw text
    let proposalContent = null;

    if (generatedProposalId) {
      const genProposal = await GeneratedProposal.findByPk(generatedProposalId);
      if (!genProposal) return res.status(404).json({ error: 'Generated Proposal not found' });
      proposalContent = genProposal.proposalContent;
    } else if (proposalText) {
      proposalContent = proposalText;
    } else {
      return res.status(400).json({ error: 'Either generatedProposalId or proposalText is required' });
    }

    const result = await complianceService.checkCompliance(rfpDoc.extractedData, proposalContent);

    res.json({
      rfpDocumentId,
      rfpTitle: rfpDoc.title || rfpDoc.originalFilename,
      generatedProposalId: generatedProposalId || null,
      checkedAt: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkCompliance,
};
