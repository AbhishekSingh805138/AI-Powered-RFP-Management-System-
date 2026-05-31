const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createRfpSchema, updateRfpSchema, sendRfpSchema } = require('../middleware/validationSchemas');
const rfpController = require('../controllers/rfpController');

router.get('/', requirePermission('rfp:read'), rfpController.listRfps);
router.get('/:id', requirePermission('rfp:read'), rfpController.getRfp);
router.post('/', requirePermission('rfp:write'), validate(createRfpSchema), rfpController.createRfp);
router.put('/:id', requirePermission('rfp:write'), validate(updateRfpSchema), rfpController.updateRfp);
router.delete('/:id', requirePermission('rfp:delete'), rfpController.deleteRfp);
router.post('/:id/send', requirePermission('rfp:write'), validate(sendRfpSchema), rfpController.sendRfpToVendors);
router.post('/:id/compare', requirePermission('proposal:compare'), rfpController.compareRfpProposals);

module.exports = router;
