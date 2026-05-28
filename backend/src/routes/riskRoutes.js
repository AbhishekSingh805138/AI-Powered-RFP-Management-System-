const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const riskController = require('../controllers/riskController');

router.get('/', riskController.listRiskAnalyses);
router.get('/:id', riskController.getRiskAnalysis);
router.post('/', requireRole('admin', 'manager'), riskController.analyzeRisks);
router.post('/compare', requireRole('admin', 'manager'), riskController.compareRisks);
router.delete('/:id', requireRole('admin', 'manager'), riskController.deleteRiskAnalysis);

module.exports = router;
