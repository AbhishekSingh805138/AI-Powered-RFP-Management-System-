const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { changeRoleSchema, changeStatusSchema } = require('../middleware/validationSchemas');
const adminController = require('../controllers/adminController');

// All admin routes require admin role
router.use(requireRole('admin'));

router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id/role', validate(changeRoleSchema), adminController.changeRole);
router.put('/users/:id/status', validate(changeStatusSchema), adminController.changeStatus);

module.exports = router;
