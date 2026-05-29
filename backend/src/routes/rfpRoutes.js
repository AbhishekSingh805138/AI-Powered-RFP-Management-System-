const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createRfpSchema, updateRfpSchema, sendRfpSchema } = require('../middleware/validationSchemas');
const rfpController = require('../controllers/rfpController');

router.get('/', rfpController.listRfps);
router.get('/:id', rfpController.getRfp);
router.post('/', requireRole('admin', 'manager'), validate(createRfpSchema), rfpController.createRfp);
router.put('/:id', requireRole('admin', 'manager'), validate(updateRfpSchema), rfpController.updateRfp);
router.delete('/:id', requireRole('admin', 'manager'), rfpController.deleteRfp);
router.post('/:id/send', requireRole('admin', 'manager'), validate(sendRfpSchema), rfpController.sendRfpToVendors);
router.post('/:id/compare', requireRole('admin', 'manager'), rfpController.compareRfpProposals);

module.exports = router;
