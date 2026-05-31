const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { complianceCheckSchema } = require('../middleware/validationSchemas');
const complianceController = require('../controllers/complianceController');

router.post('/check', requirePermission('compliance:check'), validate(complianceCheckSchema), complianceController.checkCompliance);

module.exports = router;
