const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createVendorSchema, updateVendorSchema } = require('../middleware/validationSchemas');
const vendorController = require('../controllers/vendorController');

router.get('/', vendorController.listVendors);
router.get('/:id', vendorController.getVendor);
router.post('/', requireRole('admin', 'manager'), validate(createVendorSchema), vendorController.createVendor);
router.put('/:id', requireRole('admin', 'manager'), validate(updateVendorSchema), vendorController.updateVendor);
router.delete('/:id', requireRole('admin', 'manager'), vendorController.deleteVendor);

module.exports = router;
