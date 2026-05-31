const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { searchSchema } = require('../middleware/validationSchemas');
const searchController = require('../controllers/searchController');

router.post('/', requirePermission('search:query'), validate(searchSchema), searchController.search);
router.get('/stats', requirePermission('search:query'), searchController.getStats);
router.post('/index/:sourceType/:sourceId', requirePermission('search:index'), searchController.indexDocument);
router.post('/index-all', requirePermission('search:index'), searchController.indexAll);

module.exports = router;
