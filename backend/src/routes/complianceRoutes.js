const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { complianceCheckSchema } = require('../middleware/validationSchemas');
const complianceController = require('../controllers/complianceController');

router.post('/check', requireRole('admin', 'manager'), validate(complianceCheckSchema), complianceController.checkCompliance);

module.exports = router;
