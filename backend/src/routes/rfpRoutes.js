const express = require('express');
const router = express.Router();
const rfpController = require('../controllers/rfpController');

router.post('/', rfpController.createRfp);
router.get('/', rfpController.listRfps);
router.get('/:id', rfpController.getRfp);
router.put('/:id', rfpController.updateRfp);
router.delete('/:id', rfpController.deleteRfp);
router.post('/:id/send', rfpController.sendRfpToVendors);
router.post('/:id/compare', rfpController.compareRfpProposals);

module.exports = router;
