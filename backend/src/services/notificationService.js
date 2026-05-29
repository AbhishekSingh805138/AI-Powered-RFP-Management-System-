const { Notification } = require('../models');
const emailService = require('./emailService');
const jobQueue = require('./jobQueue');
const logger = require('../utils/logger');

const JOB_NAME = 'send-notification';

/**
 * Send a notification email. Queues via pg-boss if available, otherwise sends synchronously.
 *
 * @param {Object} opts
 * @param {string} opts.type - Notification type (e.g. 'rfp-sent', 'proposal-received')
 * @param {string} opts.recipientEmail - Email address
 * @param {string} opts.recipientType - 'user' or 'vendor'
 * @param {number} [opts.recipientId] - User or Vendor ID
 * @param {string} [opts.entityType] - Related entity type
 * @param {number} [opts.entityId] - Related entity ID
 * @param {string} opts.subject - Email subject
 * @param {string} opts.html - HTML email body
 * @param {string} [opts.text] - Plain text fallback
 * @param {Object} [opts.metadata] - Extra context
 */
async function sendNotification(opts) {
  const { type, recipientEmail, recipientType, recipientId, entityType, entityId, subject, html, text, metadata } = opts;

  // Create notification record
  let notification;
  try {
    notification = await Notification.create({
      type,
      recipientEmail,
      recipientType,
      recipientId: recipientId || null,
      entityType: entityType || null,
      entityId: entityId || null,
      subject,
      status: 'queued',
      metadata: metadata || null,
    });
  } catch (err) {
    logger.error('Failed to create notification record', { error: err.message, type, recipientEmail });
    // Don't block — still try to send
  }

  // Try queue first
  const jobId = await jobQueue.enqueue(JOB_NAME, {
    notificationId: notification?.id,
    recipientEmail,
    subject,
    html,
    text,
  });

  if (jobId) {
    logger.info('Notification queued', { type, recipientEmail, jobId });
    return { notificationId: notification?.id, jobId, status: 'queued' };
  }

  // Fallback: send synchronously
  return deliverEmail(notification, { recipientEmail, subject, html, text });
}

/**
 * Actually send the email and update the notification record.
 */
async function deliverEmail(notification, { recipientEmail, subject, html, text }) {
  try {
    const result = await emailService.sendEmail(recipientEmail, subject, html, text);

    if (notification) {
      await notification.update({
        status: 'sent',
        sentAt: new Date(),
        metadata: { ...(notification.metadata || {}), messageId: result.messageId },
      });
    }

    logger.info('Notification sent', { recipientEmail, subject, messageId: result.messageId });
    return { notificationId: notification?.id, status: 'sent', messageId: result.messageId };
  } catch (err) {
    if (notification) {
      await notification.update({ status: 'failed', error: err.message });
    }

    logger.error('Notification send failed', { recipientEmail, subject, error: err.message });
    // Don't throw — notifications should not block main operations
    return { notificationId: notification?.id, status: 'failed', error: err.message };
  }
}

/**
 * Register the notification worker with pg-boss.
 * Called from jobQueue.registerWorkers().
 */
async function registerWorker(boss) {
  await boss.work(JOB_NAME, { teamSize: 3, teamConcurrency: 1 }, async (job) => {
    const { notificationId, recipientEmail, subject, html, text } = job.data;
    logger.info('Job started: send-notification', { jobId: job.id, recipientEmail });

    let notification = null;
    if (notificationId) {
      notification = await Notification.findByPk(notificationId);
    }

    await deliverEmail(notification, { recipientEmail, subject, html, text });
  });
}

module.exports = {
  sendNotification,
  deliverEmail,
  registerWorker,
  JOB_NAME,
};
