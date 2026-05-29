/**
 * Unit tests for jobQueue service.
 */

process.env.NODE_ENV = 'test';

const jobQueue = require('../../src/services/jobQueue');

describe('jobQueue', () => {
  test('start() returns false in test environment', async () => {
    const result = await jobQueue.start();
    expect(result).toBe(false);
  });

  test('isAvailable() returns false in test environment', () => {
    expect(jobQueue.isAvailable()).toBe(false);
  });

  test('enqueue() returns null when queue is not available', async () => {
    const result = await jobQueue.enqueue('test-job', { id: 1 });
    expect(result).toBeNull();
  });

  test('getJobById() returns null when queue is not available', async () => {
    const result = await jobQueue.getJobById('test-id');
    expect(result).toBeNull();
  });

  test('stop() is safe to call when not started', async () => {
    await expect(jobQueue.stop()).resolves.not.toThrow();
  });

  test('JOBS constants are defined', () => {
    expect(jobQueue.JOBS.EXTRACT_REQUIREMENTS).toBe('extract-requirements');
    expect(jobQueue.JOBS.GENERATE_PROPOSAL).toBe('generate-proposal');
    expect(jobQueue.JOBS.ANALYZE_RISKS).toBe('analyze-risks');
  });
});
