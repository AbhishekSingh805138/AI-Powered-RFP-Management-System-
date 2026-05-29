const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { searchSchema } = require('../middleware/validationSchemas');
const searchController = require('../controllers/searchController');

router.post('/', validate(searchSchema), searchController.search);
router.get('/stats', searchController.getStats);
router.post('/index/:sourceType/:sourceId', requireRole('admin', 'manager'), searchController.indexDocument);
router.post('/index-all', requireRole('admin', 'manager'), searchController.indexAll);

module.exports = router;
