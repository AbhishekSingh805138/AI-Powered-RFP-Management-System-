const { Vendor } = require('../models');
const { Op } = require('sequelize');

// POST /api/vendors
async function createVendor(req, res, next) {
  try {
    const { name, email, company, phone, category, address, notes } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const vendor = await Vendor.create({ name, email, company, phone, category, address, notes });
    res.status(201).json(vendor);
  } catch (err) {
    next(err);
  }
}

// GET /api/vendors
async function listVendors(req, res, next) {
  try {
    const { search, category } = req.query;
    const where = {};

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

    const vendors = await Vendor.findAll({ where, order: [['name', 'ASC']] });
    res.json(vendors);
  } catch (err) {
    next(err);
  }
}

// GET /api/vendors/:id
async function getVendor(req, res, next) {
  try {
    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
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
