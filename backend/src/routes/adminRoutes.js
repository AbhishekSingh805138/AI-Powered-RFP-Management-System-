const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { changeRoleSchema, changeStatusSchema } = require('../middleware/validationSchemas');
const adminController = require('../controllers/adminController');

// All admin routes require users:manage permission
router.use(requirePermission('users:manage'));

router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id/role', validate(changeRoleSchema), adminController.changeRole);
router.put('/users/:id/status', validate(changeStatusSchema), adminController.changeStatus);

module.exports = router;
