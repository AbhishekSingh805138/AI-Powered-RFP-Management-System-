const { Proposal, Rfp, Vendor } = require('../models');
const aiService = require('../services/aiService');
const emailService = require('../services/emailService');
const multer = require('multer');
const pdf = require('pdf-parse');

// POST /api/proposals/manual — Manually add a proposal
async function createProposal(req, res, next) {
  try {
    const { rfpId, vendorId, rawContent, sourceType } = req.body;

    const rfp = await Rfp.findByPk(rfpId);
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });

    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const proposal = await Proposal.create({
      rfpId,
      vendorId,
      rawContent,
      sourceType: sourceType || 'manual',
      status: 'received',
    });

    res.status(201).json(proposal);
  } catch (err) {
    next(err);
  }
}

// POST /api/proposals/:id/parse — AI-parse a proposal
async function parseProposal(req, res, next) {
  try {
    const proposal = await Proposal.findByPk(req.params.id, {
      include: [{ model: Rfp, as: 'rfp' }, { model: Vendor, as: 'vendor' }],
    });

    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    await proposal.update({ status: 'parsing' });

    // Combine email body + attachment text for parsing
    let fullText = proposal.rawContent || '';
    if (proposal.attachments) {
      for (const att of proposal.attachments) {
        if (att.extractedText) {
          fullText += '\n\n--- Attachment: ' + att.filename + ' ---\n' + att.extractedText;
        }
      }
    }

    if (!fullText.trim()) {
      await proposal.update({ status: 'error' });
      return res.status(400).json({ error: 'No content to parse' });
    }

    const rfpContext = proposal.rfp.structuredData || { title: proposal.rfp.title };
    const parsedData = await aiService.parseVendorProposal(fullText, rfpContext);

    await proposal.update({
      parsedData,
      totalPrice: parsedData.totalPrice || null,
      status: 'parsed',
    });

    res.json(proposal);
  } catch (err) {
    const proposal = await Proposal.findByPk(req.params.id);
    if (proposal) await proposal.update({ status: 'error' });
    next(err);
  }
}

// POST /api/proposals/upload — Upload a PDF proposal
async function uploadProposal(req, res, next) {
  try {
    const { rfpId, vendorId } = req.body;

    if (!req.file) return res.status(400).json({ error: 'PDF file is required' });
    if (!rfpId || !vendorId) return res.status(400).json({ error: 'rfpId and vendorId are required' });

    const pdfData = await pdf(req.file.buffer);

    const proposal = await Proposal.create({
      rfpId: parseInt(rfpId, 10),
      vendorId: parseInt(vendorId, 10),
      rawContent: pdfData.text,
      sourceType: 'pdf',
      attachments: [{
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        extractedText: pdfData.text,
      }],
      status: 'received',
    });

    res.status(201).json(proposal);
  } catch (err) {
    next(err);
  }
}

// GET /api/proposals?rfpId=X
async function listProposals(req, res, next) {
  try {
    const where = {};
    if (req.query.rfpId) {
      const rfpId = parseInt(req.query.rfpId, 10);
      if (isNaN(rfpId) || rfpId <= 0) {
        return res.status(400).json({ error: 'Invalid rfpId' });
      }
      where.rfpId = rfpId;
    }

    const proposals = await Proposal.findAll({
      where,
      include: [
        { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'email', 'company'] },
        { model: Rfp, as: 'rfp', attributes: ['id', 'title'] },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json(proposals);
  } catch (err) {
    next(err);
  }
}

// GET /api/proposals/:id
async function getProposal(req, res, next) {
  try {
    const proposal = await Proposal.findByPk(req.params.id, {
      include: [
        { model: Vendor, as: 'vendor' },
        { model: Rfp, as: 'rfp' },
      ],
    });

    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json(proposal);
  } catch (err) {
    next(err);
  }
}

// POST /api/proposals/fetch-emails — Fetch and process inbound vendor emails
async function fetchAndProcessEmails(req, res, next) {
  try {
    const emails = await emailService.fetchInboundEmails();

    if (emails.length === 0) {
      return res.json({ message: 'No new emails', processed: 0 });
    }

    const results = [];

    for (const email of emails) {
      // Try to match email to a vendor
      const vendor = await Vendor.findOne({ where: { email: email.from } });
      if (!vendor) {
        results.push({ from: email.from, status: 'skipped', reason: 'Unknown vendor' });
        continue;
      }

      // Try to match to an RFP via subject line (RFP-XXXX pattern)
      const rfpMatch = email.subject.match(/RFP-(\d+)/i);
      let rfp = null;

      if (rfpMatch) {
        rfp = await Rfp.findByPk(parseInt(rfpMatch[1], 10));
      }

      // Fallback: find the most recent RFP sent to this vendor
      if (!rfp) {
        const { RfpVendor } = require('../models');
        const recentLink = await RfpVendor.findOne({
          where: { vendorId: vendor.id, emailStatus: 'sent' },
          order: [['sent_at', 'DESC']],
        });
        if (recentLink) rfp = await Rfp.findByPk(recentLink.rfpId);
      }

      if (!rfp) {
        results.push({ from: email.from, status: 'skipped', reason: 'No matching RFP' });
        continue;
      }

      // Create proposal from email
      const proposal = await Proposal.create({
        rfpId: rfp.id,
        vendorId: vendor.id,
        rawContent: email.text || email.html,
        sourceType: 'email',
        attachments: email.attachments.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          extractedText: a.extractedText,
        })),
        status: 'received',
      });

      results.push({
        from: email.from,
        vendor: vendor.name,
        rfpId: rfp.id,
        proposalId: proposal.id,
        status: 'created',
      });
    }

    res.json({ message: `Processed ${emails.length} emails`, results });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createProposal,
  parseProposal,
  uploadProposal,
  listProposals,
  getProposal,
  fetchAndProcessEmails,
};
