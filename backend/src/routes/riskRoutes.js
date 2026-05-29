const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { riskAnalysisSchema, riskCompareSchema } = require('../middleware/validationSchemas');
const riskController = require('../controllers/riskController');

router.get('/', riskController.listRiskAnalyses);
router.get('/:id', riskController.getRiskAnalysis);
router.post('/', requireRole('admin', 'manager'), validate(riskAnalysisSchema), riskController.analyzeRisks);
router.post('/compare', requireRole('admin', 'manager'), validate(riskCompareSchema), riskController.compareRisks);
router.delete('/:id', requireRole('admin', 'manager'), riskController.deleteRiskAnalysis);

module.exports = router;
