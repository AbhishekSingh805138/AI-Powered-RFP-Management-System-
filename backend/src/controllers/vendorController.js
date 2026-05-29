const { Vendor } = require('../models');
const { Op } = require('sequelize');

// POST /api/vendors
async function createVendor(req, res, next) {
  try {
    const { name, email, company, phone, category, address, notes } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const vendor = await Vendor.create({ name, email, company, phone, category, address, notes, userId: req.user.id });
    res.status(201).json(vendor);
  } catch (err) {
    next(err);
  }
}

// GET /api/vendors (scoped to user, admins see all)
async function listVendors(req, res, next) {
  try {
    const { search, category } = req.query;
    const where = {};

    if (req.user.role !== 'admin') {
      where.userId = req.user.id;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { company: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await Vendor.findAndCountAll({ where, order: [['name', 'ASC']], limit, offset });
    res.json({ data: rows, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

// GET /api/vendors/:id
async function getVendor(req, res, next) {
  try {
    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    if (req.user.role !== 'admin' && vendor.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(vendor);
  } catch (err) {
    next(err);
  }
}

// PUT /api/vendors/:id
async function updateVendor(req, res, next) {
  try {
    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    if (req.user.role !== 'admin' && vendor.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const allowed = ['name', 'email', 'company', 'phone', 'category', 'address', 'notes'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await vendor.update(updates);
    res.json(vendor);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/vendors/:id
async function deleteVendor(req, res, next) {
  try {
    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    if (req.user.role !== 'admin' && vendor.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await vendor.destroy();
    res.json({ message: 'Vendor deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createVendor,
  listVendors,
  getVendor,
  updateVendor,
  deleteVendor,
};
