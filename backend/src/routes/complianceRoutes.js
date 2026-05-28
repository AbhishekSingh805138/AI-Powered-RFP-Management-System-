const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const complianceController = require('../controllers/complianceController');

router.post('/check', requireRole('admin', 'manager'), complianceController.checkCompliance);

module.exports = router;
