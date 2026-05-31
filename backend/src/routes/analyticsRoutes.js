const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { getAnalytics } = require('../controllers/analyticsController');

router.get('/', requirePermission('analytics:read'), getAnalytics);

module.exports = router;
