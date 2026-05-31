const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createVendorSchema, updateVendorSchema } = require('../middleware/validationSchemas');
const vendorController = require('../controllers/vendorController');

router.get('/', requirePermission('vendor:read'), vendorController.listVendors);
router.get('/:id', requirePermission('vendor:read'), vendorController.getVendor);
router.post('/', requirePermission('vendor:write'), validate(createVendorSchema), vendorController.createVendor);
router.put('/:id', requirePermission('vendor:write'), validate(updateVendorSchema), vendorController.updateVendor);
router.delete('/:id', requirePermission('vendor:write'), vendorController.deleteVendor);

module.exports = router;
