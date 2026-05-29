const { RfpDocument, GeneratedProposal, RiskAnalysis } = require('../models');
const riskService = require('../services/riskService');
const jobQueue = require('../services/jobQueue');

// POST /api/risk-analysis — Run risk analysis on an RFP document
async function analyzeRisks(req, res, next) {
  try {
    const { rfpDocumentId, generatedProposalId } = req.body;

    if (!rfpDocumentId) {
      return res.status(400).json({ error: 'rfpDocumentId is required' });
    }

    const rfpDoc = await RfpDocument.findByPk(rfpDocumentId);
    if (!rfpDoc) return res.status(404).json({ error: 'RFP Document not found' });
    if (!rfpDoc.extractedData) {
      return res.status(400).json({ error: 'RFP requirements must be extracted first' });
    }

    let genProposal = null;
    if (generatedProposalId) {
      genProposal = await GeneratedProposal.findByPk(generatedProposalId);
      if (!genProposal) return res.status(404).json({ error: 'Generated Proposal not found' });
    }

    // Create record in pending state
    const riskAnalysis = await RiskAnalysis.create({
      rfpDocumentId,
      generatedProposalId: generatedProposalId || null,
      status: 'analyzing',
    });

    // Try async job queue first
    const jobId = await jobQueue.enqueue(jobQueue.JOBS.ANALYZE_RISKS, {
      riskAnalysisId: riskAnalysis.id,
      rfpDocumentId,
      generatedProposalId: generatedProposalId || null,
    });

    if (jobId) {
      return res.status(202).json({ jobId, riskAnalysisId: riskAnalysis.id, status: 'analyzing', message: 'Risk analysis queued' });
    }

    // Fallback: synchronous processing
    const result = await riskService.analyzeRisks(rfpDoc, genProposal);

    await riskAnalysis.update({
      analysisData: result,
      overallRiskScore: result.overall_risk_score,
      overallRiskLevel: result.overall_risk_level,
      status: 'completed',
    });

    res.status(201).json(riskAnalysis);
  } catch (err) {
    next(err);
  }
}

// GET /api/risk-analysis/:id — Get a specific risk analysis
async function getRiskAnalysis(req, res, next) {
  try {
    const analysis = await RiskAnalysis.findByPk(req.params.id, {
      include: [
        { model: RfpDocument, as: 'rfpDocument', attributes: ['id', 'title', 'originalFilename'] },
        { model: GeneratedProposal, as: 'generatedProposal', attributes: ['id', 'title', 'version'] },
      ],
    });

    if (!analysis) return res.status(404).json({ error: 'Risk analysis not found' });
    res.json(analysis);
  } catch (err) {
    next(err);
  }
}

// GET /api/risk-analysis — List risk analyses (optional filter by rfpDocumentId)
async function listRiskAnalyses(req, res, next) {
  try {
    const where = {};
    if (req.query.rfpDocumentId) {
      where.rfpDocumentId = req.query.rfpDocumentId;
    }

    const analyses = await RiskAnalysis.findAll({
      where,
      attributes: ['id', 'rfpDocumentId', 'generatedProposalId', 'overallRiskScore', 'overallRiskLevel', 'status', 'createdAt'],
      include: [
        { model: RfpDocument, as: 'rfpDocument', attributes: ['id', 'title', 'originalFilename'] },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json(analyses);
  } catch (err) {
    next(err);
  }
}

// POST /api/risk-analysis/compare — Compare multiple risk analyses
async function compareRisks(req, res, next) {
  try {
    const { analysisIds } = req.body;

    if (!analysisIds || !Array.isArray(analysisIds) || analysisIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 analysisIds are required for comparison' });
    }

    const analyses = await RiskAnalysis.findAll({
      where: { id: analysisIds, status: 'completed' },
    });

    if (analyses.length < 2) {
      return res.status(400).json({ error: 'At least 2 completed analyses are required' });
    }

    const result = await riskService.compareRiskProfiles(analyses);

    res.json({
      analysisIds: analyses.map((a) => a.id),
      comparedAt: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/risk-analysis/:id — Delete a risk analysis
async function deleteRiskAnalysis(req, res, next) {
  try {
    const analysis = await RiskAnalysis.findByPk(req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Risk analysis not found' });

    await analysis.destroy();
    res.json({ message: 'Risk analysis deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  analyzeRisks,
  getRiskAnalysis,
  listRiskAnalyses,
  compareRisks,
  deleteRiskAnalysis,
};
