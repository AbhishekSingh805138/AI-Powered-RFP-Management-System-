/**
 * Unit tests for notificationService
 */

process.env.NODE_ENV = 'test';

const mockNotificationInstance = {
  id: 1,
  update: jest.fn(async function(data) { Object.assign(this, data); return this; }),
  metadata: null,
};

const mockNotification = {
  create: jest.fn().mockResolvedValue(mockNotificationInstance),
  findByPk: jest.fn().mockResolvedValue(mockNotificationInstance),
};

jest.mock('../../src/models', () => ({
  Notification: mockNotification,
}));

const mockEmailService = {
  sendEmail: jest.fn(),
};
jest.mock('../../src/services/emailService', () => mockEmailService);

const mockJobQueue = {
  enqueue: jest.fn(),
};
jest.mock('../../src/services/jobQueue', () => mockJobQueue);

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const notificationService = require('../../src/services/notificationService');

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationInstance.id = 1;
    mockNotificationInstance.metadata = null;
    mockNotificationInstance.update = jest.fn(async function(data) { Object.assign(this, data); return this; });
  });

  const baseOpts = {
    type: 'rfp-sent',
    recipientEmail: 'vendor@test.com',
    recipientType: 'vendor',
    recipientId: 42,
    entityType: 'rfp',
    entityId: 1,
    subject: 'Test Subject',
    html: '<p>Test</p>',
    text: 'Test',
  };

  describe('sendNotification', () => {
    test('creates notification record and queues when queue available', async () => {
      mockJobQueue.enqueue.mockResolvedValue('job-123');

      const result = await notificationService.sendNotification(baseOpts);

      expect(mockNotification.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'rfp-sent',
        recipientEmail: 'vendor@test.com',
        status: 'queued',
      }));
      expect(mockJobQueue.enqueue).toHaveBeenCalled();
      expect(result.status).toBe('queued');
      expect(result.jobId).toBe('job-123');
    });

    test('falls back to sync send when queue unavailable', async () => {
      mockJobQueue.enqueue.mockResolvedValue(null);
      mockEmailService.sendEmail.mockResolvedValue({ messageId: 'msg-456' });

      const result = await notificationService.sendNotification(baseOpts);

      expect(result.status).toBe('sent');
      expect(result.messageId).toBe('msg-456');
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        'vendor@test.com', 'Test Subject', '<p>Test</p>', 'Test'
      );
    });

    test('handles notification creation failure gracefully', async () => {
      mockNotification.create.mockRejectedValueOnce(new Error('DB error'));
      mockJobQueue.enqueue.mockResolvedValue(null);
      mockEmailService.sendEmail.mockResolvedValue({ messageId: 'msg-789' });

      const result = await notificationService.sendNotification(baseOpts);

      // Should still try to send the email
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
      expect(result.status).toBe('sent');
    });
  });

  describe('deliverEmail', () => {
    test('sends email and updates notification to sent', async () => {
      mockEmailService.sendEmail.mockResolvedValue({ messageId: 'msg-111' });

      const result = await notificationService.deliverEmail(mockNotificationInstance, {
        recipientEmail: 'test@test.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
      });

      expect(result.status).toBe('sent');
      expect(mockNotificationInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'sent' })
      );
    });

    test('marks notification as failed on email error', async () => {
      mockEmailService.sendEmail.mockRejectedValue(new Error('SMTP failed'));

      const result = await notificationService.deliverEmail(mockNotificationInstance, {
        recipientEmail: 'test@test.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('SMTP failed');
      expect(mockNotificationInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' })
      );
    });

    test('handles null notification gracefully', async () => {
      mockEmailService.sendEmail.mockResolvedValue({ messageId: 'msg-222' });

      const result = await notificationService.deliverEmail(null, {
        recipientEmail: 'test@test.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
      });

      // Should not throw
      expect(result.status).toBe('sent');
    });
  });
});
