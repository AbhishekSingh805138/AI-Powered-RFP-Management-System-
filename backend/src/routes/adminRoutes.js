const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// All admin routes require admin role
router.use(requireRole('admin'));

router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id/role', adminController.changeRole);
router.put('/users/:id/status', adminController.changeStatus);

module.exports = router;
