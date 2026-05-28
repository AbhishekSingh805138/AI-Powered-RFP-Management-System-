const { RfpDocument, GeneratedProposal } = require('../models');
const aiService = require('../services/aiService');
const pdf = require('pdf-parse');

// POST /api/rfp-documents/upload — Upload an RFP PDF for analysis
async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const pdfData = await pdf(req.file.buffer);

    if (!pdfData.text || !pdfData.text.trim()) {
      return res.status(400).json({ error: 'Could not extract text from PDF. The file may be scanned or image-based.' });
    }

    const document = await RfpDocument.create({
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      rawText: pdfData.text,
      status: 'uploaded',
      userId: req.user.id,
    });

    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
}

// POST /api/rfp-documents/:id/extract — AI-extract requirements from uploaded document
async function extractRequirements(req, res, next) {
  try {
    const document = await RfpDocument.findByPk(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (req.user.role !== 'admin' && document.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!document.rawText || !document.rawText.trim()) {
      return res.status(400).json({ error: 'No text content to analyze' });
    }

    await document.update({ status: 'extracting' });

    const extractedData = await aiService.extractRequirements(document.rawText);

    await document.update({
      title: extractedData.title || document.originalFilename,
      extractedData,
      status: 'extracted',
    });

    res.json(document);
  } catch (err) {
    const document = await RfpDocument.findByPk(req.params.id);
    if (document) {
      await document.update({ status: 'error', errorMessage: err.message });
    }
    next(err);
  }
}

// GET /api/rfp-documents — List uploaded documents (scoped to user, admins see all)
async function listDocuments(req, res, next) {
  try {
    const where = {};
    if (req.user.role !== 'admin') {
      where.userId = req.user.id;
    }

    const documents = await RfpDocument.findAll({
      where,
      attributes: ['id', 'title', 'originalFilename', 'fileSize', 'status', 'createdAt', 'updatedAt'],
      include: [{
        model: GeneratedProposal,
        as: 'generatedProposals',
        attributes: ['id', 'status', 'version'],
      }],
      order: [['created_at', 'DESC']],
    });

    res.json(documents);
  } catch (err) {
    next(err);
  }
}

// GET /api/rfp-documents/:id — Get document with extracted data
async function getDocument(req, res, next) {
  try {
    const document = await RfpDocument.findByPk(req.params.id, {
      include: [{
        model: GeneratedProposal,
        as: 'generatedProposals',
        order: [['created_at', 'DESC']],
      }],
    });

    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (req.user.role !== 'admin' && document.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(document);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/rfp-documents/:id — Delete a document and its generated proposals
async function deleteDocument(req, res, next) {
  try {
    const document = await RfpDocument.findByPk(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (req.user.role !== 'admin' && document.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await GeneratedProposal.destroy({ where: { rfpDocumentId: document.id } });
    await document.destroy();

    res.json({ message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
}

// POST /api/rfp-documents/:id/generate — Generate a proposal from extracted requirements
async function generateProposal(req, res, next) {
  try {
    const document = await RfpDocument.findByPk(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (req.user.role !== 'admin' && document.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (document.status !== 'extracted' || !document.extractedData) {
      return res.status(400).json({ error: 'Requirements must be extracted before generating a proposal' });
    }

    const companyProfile = req.body.companyProfile || {};
    if (!companyProfile.company_name) {
      return res.status(400).json({ error: 'Company name is required in companyProfile' });
    }

    // Count existing proposals for versioning
    const existingCount = await GeneratedProposal.count({
      where: { rfpDocumentId: document.id },
    });

    const genProposal = await GeneratedProposal.create({
      rfpDocumentId: document.id,
      companyProfile,
      status: 'generating',
      version: existingCount + 1,
    });

    const proposalContent = await aiService.generateProposal(document.extractedData, companyProfile);

    await genProposal.update({
      title: proposalContent.title || `Proposal v${genProposal.version}`,
      proposalContent,
      status: 'generated',
    });

    res.status(201).json(genProposal);
  } catch (err) {
    next(err);
  }
}

// GET /api/rfp-documents/:docId/proposals — List generated proposals for a document
async function listGeneratedProposals(req, res, next) {
  try {
    const proposals = await GeneratedProposal.findAll({
      where: { rfpDocumentId: req.params.docId },
      order: [['created_at', 'DESC']],
    });

    res.json(proposals);
  } catch (err) {
    next(err);
  }
}

// GET /api/rfp-documents/:docId/proposals/:id — Get a specific generated proposal
async function getGeneratedProposal(req, res, next) {
  try {
    const proposal = await GeneratedProposal.findOne({
      where: { id: req.params.id, rfpDocumentId: req.params.docId },
      include: [{ model: RfpDocument, as: 'rfpDocument' }],
    });

    if (!proposal) return res.status(404).json({ error: 'Generated proposal not found' });
    res.json(proposal);
  } catch (err) {
    next(err);
  }
}

// PUT /api/rfp-documents/:docId/proposals/:id — Update/edit a generated proposal
async function updateGeneratedProposal(req, res, next) {
  try {
    const proposal = await GeneratedProposal.findOne({
      where: { id: req.params.id, rfpDocumentId: req.params.docId },
    });

    if (!proposal) return res.status(404).json({ error: 'Generated proposal not found' });

    const { proposalContent, title, status } = req.body;

    const updates = {};
    if (proposalContent) updates.proposalContent = proposalContent;
    if (title) updates.title = title;
    if (status && ['edited', 'finalized'].includes(status)) updates.status = status;

    await proposal.update(updates);
    res.json(proposal);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadDocument,
  extractRequirements,
  listDocuments,
  getDocument,
  deleteDocument,
  generateProposal,
  listGeneratedProposals,
  getGeneratedProposal,
  updateGeneratedProposal,
};
