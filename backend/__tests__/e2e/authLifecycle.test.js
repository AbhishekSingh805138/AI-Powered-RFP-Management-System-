/**
 * E2E Test: Authentication Lifecycle
 *
 * Simulates a real user journey through the full auth system:
 *   Register → Login → Access protected resource → Refresh token →
 *   Change password → Login with new password → Logout →
 *   Verify old token rejected → Suspended user blocked
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ── In-memory user store ──────────────────────────────────────────
let users = [];
let userAutoId = 1;

const mockModels = {
  User: {
    create: jest.fn(async (data) => {
      const user = {
        id: userAutoId++,
        ...data,
        status: data.status || 'active',
        role: data.role || 'viewer',
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        update: jest.fn(async function (updates) { Object.assign(this, updates); return this; }),
        destroy: jest.fn(),
      };
      users.push(user);
      return user;
    }),
    findOne: jest.fn(async ({ where }) => {
      return users.find((u) => u.email === where.email) || null;
    }),
    findByPk: jest.fn(async (id) => {
      return users.find((u) => u.id === id) || null;
    }),
    scope: jest.fn(function () { return this; }),
    findAll: jest.fn(async () => users),
  },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};

jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/notificationService', () => ({
  sendNotification: jest.fn(),
}));

const { createApp } = require('../../src/app');
const authService = require('../../src/services/authService');

let app;

beforeAll(() => {
  app = createApp();
});

function resetAll() {
  users = [];
  userAutoId = 1;
  authService._clearBlacklistForTest();
  jest.clearAllMocks();
  // Re-bind scope so it always returns the mock with methods
  mockModels.User.scope.mockImplementation(function () { return mockModels.User; });
}

// ─────────────────────────────────────────────────────────────────
describe('E2E: Authentication Lifecycle', () => {
  // ── 1. Full happy-path journey ─────────────────────────────────
  describe('Complete user journey: Register → Login → Use → Refresh → Change Password → Logout', () => {
    let accessToken, refreshToken, userId;

    beforeAll(() => { resetAll(); });

    test('Step 1: Register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'alice@example.com',
          password: 'SecureP@ss1',
          firstName: 'Alice',
          lastName: 'Johnson',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.user.role).toBe('viewer');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      // Password hash should NOT be exposed
      expect(res.body.user.passwordHash).toBeUndefined();

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
      userId = res.body.user.id;
    });

    test('Step 2: Access protected route with token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(userId);
      expect(res.body.email).toBe('alice@example.com');
    });

    test('Step 3: Refresh the token pair', async () => {
      const oldRefreshToken = refreshToken;

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      // Update tokens FIRST before further assertions
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;

      // Old refresh token is now blacklisted — reuse is rejected
      const reuse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldRefreshToken });
      expect(reuse.status).toBe(401);
    });

    test('Step 4: Change password', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'SecureP@ss1',
          newPassword: 'NewSecureP@ss2',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Password changed');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      // Old access token should be blacklisted after password change
      const oldTokenRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(oldTokenRes.status).toBe(401);

      // Use new tokens
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    test('Step 5: Login with new password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: 'NewSecureP@ss2' });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('alice@example.com');
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    test('Step 6: Logout invalidates tokens', async () => {
      const tokenBeforeLogout = accessToken;

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Logged out');

      // Access token is now rejected
      const afterLogout = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenBeforeLogout}`);
      expect(afterLogout.status).toBe(401);
    });
  });

  // ── 2. Duplicate registration ──────────────────────────────────
  describe('Duplicate registration prevention', () => {
    beforeEach(() => { resetAll(); });
    test('rejects registration with an already-used email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'bob@example.com', password: 'StrongP@ss1', firstName: 'Bob', lastName: 'Smith' });

      // Duplicate
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'bob@example.com', password: 'OtherP@ss1', firstName: 'Robert', lastName: 'Smith' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already registered');
    });
  });

  // ── 3. Invalid login attempts ──────────────────────────────────
  describe('Invalid login attempts', () => {
    beforeEach(async () => {
      resetAll();
      // Seed a user with a known hash
      const hash = await bcrypt.hash('CorrectP@ss1', 12);
      users.push({
        id: userAutoId++,
        email: 'charlie@example.com',
        passwordHash: hash,
        firstName: 'Charlie',
        lastName: 'Brown',
        role: 'viewer',
        status: 'active',
        lastLoginAt: null,
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
      });
    });

    test('rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'charlie@example.com', password: 'WrongPassword1' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });

    test('rejects non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'SomeP@ss1' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });
  });

  // ── 4. Suspended user is blocked ───────────────────────────────
  describe('Suspended user flow', () => {
    let suspendedUserToken;

    beforeEach(async () => {
      resetAll();
      const hash = await bcrypt.hash('ValidP@ss1', 12);
      users.push({
        id: userAutoId++,
        email: 'suspended@example.com',
        passwordHash: hash,
        firstName: 'Suspended',
        lastName: 'User',
        role: 'viewer',
        status: 'suspended',
        lastLoginAt: null,
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
      });

      // Generate a token that would have been valid before suspension
      suspendedUserToken = jwt.sign(
        { id: users[users.length - 1].id, email: 'suspended@example.com', role: 'viewer' },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' }
      );
    });

    test('suspended user cannot login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'suspended@example.com', password: 'ValidP@ss1' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('suspended');
    });

    test('suspended user token is rejected on protected routes', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${suspendedUserToken}`);

      expect(res.status).toBe(401);
    });
  });

  // ── 5. Unauthenticated access ──────────────────────────────────
  describe('Unauthenticated access to protected routes', () => {
    beforeEach(() => { resetAll(); });
    test('returns 401 without any token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    test('returns 401 with malformed token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt');
      expect(res.status).toBe(401);
    });

    test('returns 401 with expired token', async () => {
      const expiredToken = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'admin' },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '0s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });
  });

  // ── 6. Self-registration toggle ────────────────────────────────
  describe('Self-registration can be disabled', () => {
    beforeEach(() => { resetAll(); });
    const originalEnv = process.env.ALLOW_SELF_REGISTRATION;

    afterEach(() => {
      process.env.ALLOW_SELF_REGISTRATION = originalEnv;
    });

    test('rejects registration when ALLOW_SELF_REGISTRATION=false', async () => {
      process.env.ALLOW_SELF_REGISTRATION = 'false';

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'blocked@example.com', password: 'StrongP@ss1', firstName: 'Blocked', lastName: 'User' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('disabled');
    });
  });

  // ── 7. Input validation ────────────────────────────────────────
  describe('Input validation on auth endpoints', () => {
    beforeEach(() => { resetAll(); });
    test('rejects registration with weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'weak@example.com', password: 'short', firstName: 'Test', lastName: 'User' });

      expect(res.status).toBe(400);
    });

    test('rejects registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'StrongP@ss1', firstName: 'Test', lastName: 'User' });

      expect(res.status).toBe(400);
    });

    test('rejects login with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });

    test('rejects change-password with weak new password', async () => {
      // Register first
      const reg = await request(app)
        .post('/api/auth/register')
        .send({ email: 'pwtest@example.com', password: 'StrongP@ss1', firstName: 'PW', lastName: 'Test' });

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ currentPassword: 'StrongP@ss1', newPassword: 'weak' });

      expect(res.status).toBe(400);
    });
  });
});
