const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');

router.post('/', vendorController.createVendor);
router.get('/', vendorController.listVendors);
router.get('/:id', vendorController.getVendor);
router.put('/:id', vendorController.updateVendor);
router.delete('/:id', vendorController.deleteVendor);

module.exports = router;
