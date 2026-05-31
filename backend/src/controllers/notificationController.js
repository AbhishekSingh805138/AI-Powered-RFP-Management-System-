const { Notification } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// GET /api/notifications — List notifications for the current user
async function listNotifications(req, res, next) {
  try {
    const where = { recipientId: req.user.id, recipientType: 'user' };

    // Filter by type
    if (req.query.type) {
      where.type = req.query.type;
    }

    // Filter by status
    if (req.query.status) {
      where.status = req.query.status;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    res.json({
      notifications: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/stats — Notification stats for dashboard
async function getNotificationStats(req, res, next) {
  try {
    const where = { recipientId: req.user.id, recipientType: 'user' };

    const [total, sent, failed, queued] = await Promise.all([
      Notification.count({ where }),
      Notification.count({ where: { ...where, status: 'sent' } }),
      Notification.count({ where: { ...where, status: 'failed' } }),
      Notification.count({ where: { ...where, status: 'queued' } }),
    ]);

    // Count by type
    const byType = await Notification.findAll({
      where,
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['type'],
      raw: true,
    });

    // Recent (last 7 days)
    const recentCount = await Notification.count({
      where: {
        ...where,
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    res.json({
      total,
      sent,
      failed,
      queued,
      recentCount,
      byType: byType.reduce((acc, row) => {
        acc[row.type] = parseInt(row.count, 10);
        return acc;
      }, {}),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listNotifications,
  getNotificationStats,
};
