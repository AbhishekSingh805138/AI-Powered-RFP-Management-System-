const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');
const { notificationListQuery } = require('../middleware/validationSchemas');
const { listNotifications, getNotificationStats } = require('../controllers/notificationController');

router.use(authenticate);

router.get('/stats', getNotificationStats);
router.get('/', validateQuery(notificationListQuery), listNotifications);

module.exports = router;
