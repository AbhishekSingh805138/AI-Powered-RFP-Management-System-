/**
 * Tests for the errorHandler middleware.
 */

const errorHandler = require('../../src/middleware/errorHandler');

describe('errorHandler middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    // Silence console.error in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('handles SequelizeValidationError with 400 status', () => {
    const err = {
      name: 'SequelizeValidationError',
      message: 'Validation error',
      errors: [
        { path: 'email', message: 'email must be a valid email' },
        { path: 'name', message: 'name cannot be null' },
      ],
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation Error',
      details: [
        { field: 'email', message: 'email must be a valid email' },
        { field: 'name', message: 'name cannot be null' },
      ],
    });
  });

  test('handles SequelizeUniqueConstraintError with 409 status', () => {
    const err = {
      name: 'SequelizeUniqueConstraintError',
      message: 'Unique constraint error',
      errors: [
        { path: 'email', message: 'email must be unique' },
      ],
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Duplicate Entry',
      details: [{ field: 'email', message: 'email must be unique' }],
    });
  });

  test('handles generic error with 500 status in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = new Error('Something went wrong');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Something went wrong',
    });

    process.env.NODE_ENV = originalEnv;
  });

  test('hides error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Sensitive database error details');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
    });

    process.env.NODE_ENV = originalEnv;
  });

  test('respects custom status code on error object', () => {
    const err = new Error('Not authorized');
    err.status = 403;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not authorized',
    });
  });

  test('defaults to 500 when no status set', () => {
    const err = new Error('Unknown error');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('logs error message to console.error', () => {
    const err = new Error('Test error');
    errorHandler(err, req, res, next);

    expect(console.error).toHaveBeenCalledWith('Error:', 'Test error');
  });

  test('logs stack trace in non-production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const err = new Error('Test error');
    errorHandler(err, req, res, next);

    // Second call should include the stack
    expect(console.error).toHaveBeenCalledTimes(2);

    process.env.NODE_ENV = originalEnv;
  });
});
