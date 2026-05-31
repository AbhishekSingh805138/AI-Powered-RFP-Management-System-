const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { riskAnalysisSchema, riskCompareSchema } = require('../middleware/validationSchemas');
const riskController = require('../controllers/riskController');

router.get('/', requirePermission('rfp:read'), riskController.listRiskAnalyses);
router.get('/:id', requirePermission('rfp:read'), riskController.getRiskAnalysis);
router.post('/', requirePermission('risk:manage'), validate(riskAnalysisSchema), riskController.analyzeRisks);
router.post('/compare', requirePermission('risk:manage'), validate(riskCompareSchema), riskController.compareRisks);
router.delete('/:id', requirePermission('risk:manage'), riskController.deleteRiskAnalysis);

module.exports = router;
