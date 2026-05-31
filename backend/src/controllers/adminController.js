const { User } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

// GET /api/admin/users — List all users
async function listUsers(req, res, next) {
  try {
    const { search, role, status } = req.query;
    const where = {};

    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (role) where.role = role;
    if (status) where.status = status;

    const users = await User.findAll({
      where,
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'lastLoginAt', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/users/:id — Get a single user
async function getUser(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'lastLoginAt', 'createdAt', 'updatedAt'],
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/users/:id/role — Change user role
async function changeRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!role || !['admin', 'manager', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required (admin, manager, viewer)' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    await user.update({ role });
    res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, status: user.status });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/users/:id/status — Suspend or activate user
async function changeStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (active, suspended)' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own status' });
    }

    await user.update({ status });
    res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, status: user.status });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/users — Admin creates a new user with an assigned role
async function createUser(req, res, next) {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'email, password, firstName, and lastName are required' });
    }

    if (role && !['admin', 'manager', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required (admin, manager, viewer)' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      passwordHash,
      firstName,
      lastName,
      role: role || 'viewer',
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  changeRole,
  changeStatus,
};
