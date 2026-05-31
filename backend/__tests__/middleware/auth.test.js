/**
 * Unit tests for the auth middleware — authenticate and requireRole.
 */

process.env.JWT_SECRET = 'test-jwt-secret';

const jwt = require('jsonwebtoken');

jest.mock('../../src/models', () => ({
  User: {
    findByPk: jest.fn(),
  },
}));

const { User } = require('../../src/models');
const { authenticate, requireRole, requirePermission } = require('../../src/middleware/auth');

function mockReqResNext(headers = {}) {
  const req = { headers };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('authenticate middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 401 if no Authorization header', async () => {
    const { req, res, next } = mockReqResNext();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 if Authorization header is not Bearer', async () => {
    const { req, res, next } = mockReqResNext({ authorization: 'Basic abc123' });
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 if token is invalid', async () => {
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer invalidtoken' });
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 if token is expired', async () => {
    const token = jwt.sign({ id: 1, email: 'a@b.com', role: 'viewer' }, process.env.JWT_SECRET, { expiresIn: '0s' });
    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${token}` });

    // Small delay to ensure expiry
    await new Promise((r) => setTimeout(r, 10));
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 if user not found in DB', async () => {
    const token = jwt.sign({ id: 999, email: 'a@b.com', role: 'viewer' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    User.findByPk.mockResolvedValue(null);

    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${token}` });
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 if user is suspended', async () => {
    const token = jwt.sign({ id: 1, email: 'a@b.com', role: 'viewer' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    User.findByPk.mockResolvedValue({ id: 1, status: 'suspended' });

    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${token}` });
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('sets req.user and calls next() on valid token', async () => {
    const token = jwt.sign({ id: 1, email: 'a@b.com', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const user = { id: 1, email: 'a@b.com', role: 'admin', status: 'active' };
    User.findByPk.mockResolvedValue(user);

    const { req, res, next } = mockReqResNext({ authorization: `Bearer ${token}` });
    await authenticate(req, res, next);

    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireRole middleware', () => {
  test('returns 401 if req.user is not set', () => {
    const middleware = requireRole('admin');
    const { req, res, next } = mockReqResNext();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 403 if user role is not in allowed roles', () => {
    const middleware = requireRole('admin', 'manager');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'viewer' };
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('calls next() if user role is allowed', () => {
    const middleware = requireRole('admin', 'manager');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'manager' };
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('works with single role', () => {
    const middleware = requireRole('admin');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'admin' };
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requirePermission middleware', () => {
  test('returns 401 if req.user is not set', () => {
    const middleware = requirePermission('rfp:read');
    const { req, res, next } = mockReqResNext();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 403 if user does not have permission', () => {
    const middleware = requirePermission('rfp:write');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'viewer', status: 'active' }; // viewer only has rfp:read
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 403 if user is suspended', () => {
    const middleware = requirePermission('rfp:read');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'viewer', status: 'suspended' };
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('calls next() if user has permission', () => {
    const middleware = requirePermission('rfp:read');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'viewer', status: 'active' };
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('calls next() for admin role on any permission', () => {
    const middleware = requirePermission('some:wildcard:permission');
    const { req, res, next } = mockReqResNext();
    req.user = { role: 'admin', status: 'active' };
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
