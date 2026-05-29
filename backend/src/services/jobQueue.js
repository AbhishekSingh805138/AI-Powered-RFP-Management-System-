const PgBoss = require('pg-boss');
const logger = require('../utils/logger');

let boss = null;
let isReady = false;

// Job type constants
const JOBS = {
  EXTRACT_REQUIREMENTS: 'extract-requirements',
  GENERATE_PROPOSAL: 'generate-proposal',
  ANALYZE_RISKS: 'analyze-risks',
};

/**
 * Initialize and start pg-boss. Call once at server startup.
 * Returns false if queue cannot start (e.g., no DB connection).
 */
async function start() {
  if (process.env.NODE_ENV === 'test') return false;
  if (isReady) return true;

  try {
    boss = new PgBoss({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME || 'rfp_management',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
      retryLimit: 2,
      retryDelay: 5,
      expireInMinutes: 10,
      archiveCompletedAfterSeconds: 86400, // 24 hours
      deleteAfterDays: 7,
      monitorStateIntervalMinutes: 1,
    });

    boss.on('error', (err) => logger.error('pg-boss error', { error: err.message }));

    await boss.start();
    isReady = true;

    // Register workers
    await registerWorkers();

    logger.info('Job queue started');
    return true;
  } catch (err) {
    logger.warn('Job queue failed to start — falling back to synchronous processing', { error: err.message });
    boss = null;
    isReady = false;
    return false;
  }
}

/**
 * Register job handler functions.
 */
async function registerWorkers() {
  const { RfpDocument, GeneratedProposal, RiskAnalysis, User } = require('../models');
  const aiService = require('./aiService');
  const riskService = require('./riskService');
  const notificationService = require('./notificationService');
  const emailTemplates = require('./emailTemplates');
  const appUrl = process.env.APP_URL || null;

  // Register notification email worker
  await notificationService.registerWorker(boss);

  // Extract Requirements Worker
  await boss.work(JOBS.EXTRACT_REQUIREMENTS, { teamSize: 2, teamConcurrency: 1 }, async (job) => {
    const { documentId } = job.data;
    logger.info('Job started: extract-requirements', { jobId: job.id, documentId });

    const document = await RfpDocument.findByPk(documentId);
    if (!document) throw new Error(`Document ${documentId} not found`);

    try {
      const extractedData = await aiService.extractRequirements(document.rawText);
      await document.update({
        title: extractedData.title || document.originalFilename,
        extractedData,
        status: 'extracted',
      });
      logger.info('Job completed: extract-requirements', { jobId: job.id, documentId });

      // Notify document owner
      if (document.userId) {
        const owner = await User.findByPk(document.userId);
        if (owner?.email) {
          const requirementCount = extractedData.requirements?.length || 0;
          const template = emailTemplates.extractionComplete({
            userName: owner.firstName || owner.email,
            documentTitle: document.title || document.originalFilename,
            documentId: document.id,
            requirementCount,
            appUrl,
          });

          notificationService.sendNotification({
            type: 'extraction-complete',
            recipientEmail: owner.email,
            recipientType: 'user',
            recipientId: owner.id,
            entityType: 'rfp-document',
            entityId: document.id,
            subject: template.subject,
            html: template.html,
            text: template.text,
          }).catch((err) => logger.error('Extraction notification failed', { error: err.message }));
        }
      }
    } catch (err) {
      await document.update({ status: 'error', errorMessage: err.message });
      throw err;
    }
  });

  // Generate Proposal Worker
  await boss.work(JOBS.GENERATE_PROPOSAL, { teamSize: 2, teamConcurrency: 1 }, async (job) => {
    const { documentId, proposalId, companyProfile } = job.data;
    logger.info('Job started: generate-proposal', { jobId: job.id, documentId, proposalId });

    const document = await RfpDocument.findByPk(documentId);
    if (!document) throw new Error(`Document ${documentId} not found`);

    const proposal = await GeneratedProposal.findByPk(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

    try {
      const proposalContent = await aiService.generateProposal(document.extractedData, companyProfile);
      await proposal.update({
        title: proposalContent.title || `Proposal v${proposal.version}`,
        proposalContent,
        status: 'generated',
      });
      logger.info('Job completed: generate-proposal', { jobId: job.id, proposalId });
    } catch (err) {
      await proposal.update({ status: 'generating' }); // keep in generating to signal failure
      throw err;
    }
  });

  // Analyze Risks Worker
  await boss.work(JOBS.ANALYZE_RISKS, { teamSize: 2, teamConcurrency: 1 }, async (job) => {
    const { riskAnalysisId, rfpDocumentId, generatedProposalId } = job.data;
    logger.info('Job started: analyze-risks', { jobId: job.id, riskAnalysisId });

    const rfpDoc = await RfpDocument.findByPk(rfpDocumentId);
    if (!rfpDoc) throw new Error(`RFP Document ${rfpDocumentId} not found`);

    let genProposal = null;
    if (generatedProposalId) {
      genProposal = await GeneratedProposal.findByPk(generatedProposalId);
    }

    const riskAnalysis = await RiskAnalysis.findByPk(riskAnalysisId);
    if (!riskAnalysis) throw new Error(`RiskAnalysis ${riskAnalysisId} not found`);

    try {
      const result = await riskService.analyzeRisks(rfpDoc, genProposal);
      await riskAnalysis.update({
        analysisData: result,
        overallRiskScore: result.overall_risk_score,
        overallRiskLevel: result.overall_risk_level,
        status: 'completed',
      });
      logger.info('Job completed: analyze-risks', { jobId: job.id, riskAnalysisId });

      // Notify document owner
      if (rfpDoc.userId) {
        const owner = await User.findByPk(rfpDoc.userId);
        if (owner?.email) {
          const template = emailTemplates.riskAnalysisComplete({
            userName: owner.firstName || owner.email,
            rfpTitle: rfpDoc.title || rfpDoc.originalFilename,
            rfpDocumentId: rfpDoc.id,
            riskLevel: result.overall_risk_level,
            riskScore: result.overall_risk_score,
            appUrl,
          });

          notificationService.sendNotification({
            type: 'risk-analysis-complete',
            recipientEmail: owner.email,
            recipientType: 'user',
            recipientId: owner.id,
            entityType: 'risk-analysis',
            entityId: riskAnalysis.id,
            subject: template.subject,
            html: template.html,
            text: template.text,
          }).catch((err) => logger.error('Risk analysis notification failed', { error: err.message }));
        }
      }
    } catch (err) {
      await riskAnalysis.update({ status: 'failed' });
      throw err;
    }
  });
}

/**
 * Enqueue a job. Returns the jobId, or null if the queue is not available.
 */
async function enqueue(jobName, data, options = {}) {
  if (!isReady || !boss) return null;

  try {
    const jobId = await boss.send(jobName, data, {
      retryLimit: 2,
      expireInMinutes: 10,
      ...options,
    });
    logger.info('Job enqueued', { jobName, jobId });
    return jobId;
  } catch (err) {
    logger.error('Failed to enqueue job', { jobName, error: err.message });
    return null;
  }
}

/**
 * Get job status by ID.
 */
async function getJobById(jobId) {
  if (!isReady || !boss) return null;

  try {
    return await boss.getJobById(jobId);
  } catch (err) {
    logger.error('Failed to get job status', { jobId, error: err.message });
    return null;
  }
}

/**
 * Stop the queue gracefully.
 */
async function stop() {
  if (boss && isReady) {
    await boss.stop({ graceful: true, timeout: 30000 });
    isReady = false;
    boss = null;
    logger.info('Job queue stopped');
  }
}

/**
 * Check if the queue is available.
 */
function isAvailable() {
  return isReady && boss !== null;
}

module.exports = {
  start,
  stop,
  enqueue,
  getJobById,
  isAvailable,
  JOBS,
};
