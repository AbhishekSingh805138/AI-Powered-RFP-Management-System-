const { Rfp, Vendor, RfpVendor, Proposal, Comparison } = require('../models');
const aiService = require('../services/aiService');
const emailService = require('../services/emailService');

// POST /api/rfps — Create RFP from natural language
async function createRfp(req, res, next) {
  try {
    const { rawInput } = req.body;
    if (!rawInput || !rawInput.trim()) {
      return res.status(400).json({ error: 'rawInput is required' });
    }

    // AI: parse natural language into structured data
    const structuredData = await aiService.parseRfpFromNaturalLanguage(rawInput);

    const rfp = await Rfp.create({
      title: structuredData.title || 'Untitled RFP',
      rawInput,
      structuredData,
      budget: structuredData.budget?.total || null,
      currency: structuredData.budget?.currency || 'USD',
      deliveryDays: structuredData.timeline?.deliveryDays || null,
      deadline: structuredData.timeline?.deadline || null,
      status: 'draft',
    });

    res.status(201).json(rfp);
  } catch (err) {
    next(err);
  }
}

// GET /api/rfps — List all RFPs
async function listRfps(req, res, next) {
  try {
    const rfps = await Rfp.findAll({
      order: [['created_at', 'DESC']],
      include: [
        { model: Vendor, as: 'vendors', through: { attributes: ['email_status', 'sent_at'] } },
        { model: Proposal, as: 'proposals', attributes: ['id', 'vendor_id', 'status', 'total_price', 'score'] },
      ],
    });
    res.json(rfps);
  } catch (err) {
    next(err);
  }
}

// GET /api/rfps/:id — Get single RFP with all related data
async function getRfp(req, res, next) {
  try {
    const rfp = await Rfp.findByPk(req.params.id, {
      include: [
        { model: Vendor, as: 'vendors', through: { attributes: ['email_status', 'sent_at'] } },
        {
          model: Proposal,
          as: 'proposals',
          include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'email', 'company'] }],
        },
        { model: Comparison, as: 'comparisons', order: [['created_at', 'DESC']], limit: 1 },
      ],
    });

    if (!rfp) return res.status(404).json({ error: 'RFP not found' });
    res.json(rfp);
  } catch (err) {
    next(err);
  }
}

// PUT /api/rfps/:id — Update RFP
async function updateRfp(req, res, next) {
  try {
    const rfp = await Rfp.findByPk(req.params.id);
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });

    const allowed = ['title', 'structuredData', 'budget', 'currency', 'deadline', 'deliveryDays', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await rfp.update(updates);
    res.json(rfp);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/rfps/:id
async function deleteRfp(req, res, next) {
  try {
    const rfp = await Rfp.findByPk(req.params.id);
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });
    await rfp.destroy();
    res.json({ message: 'RFP deleted' });
  } catch (err) {
    next(err);
  }
}

// POST /api/rfps/:id/send — Send RFP to selected vendors
async function sendRfpToVendors(req, res, next) {
  try {
    const rfp = await Rfp.findByPk(req.params.id);
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });

    const { vendorIds } = req.body;
    if (!vendorIds || !vendorIds.length) {
      return res.status(400).json({ error: 'vendorIds array is required' });
    }

    const vendors = await Vendor.findAll({ where: { id: vendorIds } });
    const results = [];

    for (const vendor of vendors) {
      // Create or find the rfp-vendor link
      const [rfpVendor] = await RfpVendor.findOrCreate({
        where: { rfpId: rfp.id, vendorId: vendor.id },
        defaults: { emailStatus: 'pending' },
      });

      try {
        await emailService.sendRfpEmail(vendor.email, vendor.name, rfp);
        await rfpVendor.update({ emailStatus: 'sent', sentAt: new Date() });
        results.push({ vendorId: vendor.id, name: vendor.name, status: 'sent' });
      } catch (emailErr) {
        await rfpVendor.update({ emailStatus: 'failed', emailError: emailErr.message });
        results.push({ vendorId: vendor.id, name: vendor.name, status: 'failed', error: emailErr.message });
      }
    }

    await rfp.update({ status: 'sent' });
    res.json({ message: 'RFP sent', results });
  } catch (err) {
    next(err);
  }
}

// POST /api/rfps/:id/compare — AI comparison of proposals
async function compareRfpProposals(req, res, next) {
  try {
    const rfp = await Rfp.findByPk(req.params.id, {
      include: [
        {
          model: Proposal,
          as: 'proposals',
          where: { status: 'parsed' },
          include: [{ model: Vendor, as: 'vendor' }],
          required: false,
        },
      ],
    });

    if (!rfp) return res.status(404).json({ error: 'RFP not found' });

    const parsedProposals = rfp.proposals || [];
    if (parsedProposals.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 parsed proposals to compare' });
    }

    const proposalsForAI = parsedProposals.map((p) => ({
      vendorId: p.vendorId,
      vendorName: p.vendor?.name || `Vendor ${p.vendorId}`,
      parsedData: p.parsedData,
      totalPrice: p.totalPrice,
    }));

    const comparisonResult = await aiService.compareProposals(rfp.structuredData, proposalsForAI);

    const comparison = await Comparison.create({
      rfpId: rfp.id,
      comparisonData: comparisonResult.vendorScores,
      recommendation: comparisonResult.recommendation,
      summary: comparisonResult.summary,
    });

    // Update individual proposal scores
    for (const vs of comparisonResult.vendorScores || []) {
      await Proposal.update(
        { score: vs.totalScore },
        { where: { rfpId: rfp.id, vendorId: vs.vendorId } }
      );
    }

    await rfp.update({ status: 'evaluating' });

    res.json({
      comparison,
      fullResult: comparisonResult,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRfp,
  listRfps,
  getRfp,
  updateRfp,
  deleteRfp,
  sendRfpToVendors,
  compareRfpProposals,
};
