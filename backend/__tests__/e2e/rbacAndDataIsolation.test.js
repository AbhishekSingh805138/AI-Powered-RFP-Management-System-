/**
 * E2E Test: RBAC & Data Isolation
 *
 * Tests the complete role-based access control system and data isolation
 * between users — simulating how different users interact with the same
 * application concurrently:
 *
 *   Admin: full access, sees all data, can manage users
 *   Manager: can create/update/AI ops, sees only own data
 *   Viewer: read-only, sees only own data
 *
 * Also tests:
 *   - Admin user management (create, role change, suspend/activate)
 *   - Data isolation: user A cannot see user B's resources
 *   - Admin can see all users' data
 *   - Self-modification prevention (admin can't change own role/status)
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── In-memory stores ──────────────────────────────────────────────
let users = [];
let rfps = [];
let autoId = 1;

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' }
  );
}

const mockModels = {
  User: {
    create: jest.fn(async (data) => {
      const u = {
        id: autoId++, ...data, status: data.status || 'active',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        update: jest.fn(async function (upd) { Object.assign(this, upd); return this; }),
      };
      users.push(u);
      return u;
    }),
    findByPk: jest.fn(async (id) => users.find((u) => u.id === parseInt(id, 10)) || null),
    findOne: jest.fn(async ({ where }) => users.find((u) => u.email === where.email) || null),
    findAll: jest.fn(async ({ where } = {}) => {
      let filtered = [...users];
      if (where?.role) filtered = filtered.filter((u) => u.role === where.role);
      if (where?.status) filtered = filtered.filter((u) => u.status === where.status);
      return filtered;
    }),
    scope: jest.fn(function () { return this; }),
  },
  Rfp: {
    create: jest.fn(async (data) => {
      const r = {
        id: autoId++, ...data, vendors: [], proposals: [], comparisons: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
        destroy: jest.fn(async function () { rfps = rfps.filter((x) => x.id !== this.id); }),
      };
      rfps.push(r);
      return r;
    }),
    findAndCountAll: jest.fn(async ({ where, limit, offset } = {}) => {
      let filtered = [...rfps];
      if (where?.userId) filtered = filtered.filter((r) => r.userId === where.userId);
      return { count: filtered.length, rows: filtered.slice(offset || 0, (offset || 0) + (limit || 20)) };
    }),
    findByPk: jest.fn(async (id) => rfps.find((r) => r.id === parseInt(id, 10)) || null),
  },
  Vendor: {
    findAll: jest.fn(async () => []),
    findAndCountAll: jest.fn(async () => ({ count: 0, rows: [] })),
  },
  Proposal: {
    findAll: jest.fn(async () => []),
    findAndCountAll: jest.fn(async () => ({ count: 0, rows: [] })),
  },
  Comparison: {},
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() },
};

jest.mock('../../src/models', () => mockModels);
jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/services/aiService', () => ({
  parseRfpFromNaturalLanguage: jest.fn().mockResolvedValue({
    title: 'Test RFP', items: [], budget: { total: 10000 },
  }),
}));
jest.mock('../../src/services/notificationService', () => ({ sendNotification: jest.fn() }));

// NOTE: We do NOT mock auth middleware — we use real JWT validation
const { createApp } = require('../../src/app');

let app;
let adminUser, managerUser, viewerUser;
let adminToken, managerToken, viewerToken;

beforeAll(() => {
  app = createApp();
});

function resetAndSeed() {
  users = [];
  rfps = [];
  autoId = 1;
  jest.clearAllMocks();
  mockModels.User.scope.mockImplementation(function () { return mockModels.User; });

  // Seed three users with different roles
  adminUser = {
    id: autoId++, email: 'admin@corp.com', role: 'admin', status: 'active',
    firstName: 'Admin', lastName: 'User', passwordHash: 'hash',
    update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
  };
  managerUser = {
    id: autoId++, email: 'manager@corp.com', role: 'manager', status: 'active',
    firstName: 'Manager', lastName: 'User', passwordHash: 'hash',
    update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
  };
  viewerUser = {
    id: autoId++, email: 'viewer@corp.com', role: 'viewer', status: 'active',
    firstName: 'Viewer', lastName: 'User', passwordHash: 'hash',
    update: jest.fn(async function (u) { Object.assign(this, u); return this; }),
  };
  users.push(adminUser, managerUser, viewerUser);

  adminToken = makeToken(adminUser);
  managerToken = makeToken(managerUser);
  viewerToken = makeToken(viewerUser);
}

// ─────────────────────────────────────────────────────────────────
describe('E2E: Role-Based Access Control', () => {
  beforeEach(() => { resetAndSeed(); });

  // ── Viewer: read-only access ───────────────────────────────────
  describe('Viewer role — read-only access', () => {
    test('viewer can list RFPs', async () => {
      const res = await request(app)
        .get('/api/rfps')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
    });

    test('viewer CANNOT create an RFP (403)', async () => {
      const res = await request(app)
        .post('/api/rfps')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ rawInput: 'Viewer trying to create RFP' });

      expect(res.status).toBe(403);
    });

    test('viewer CANNOT create a vendor (403)', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Test', email: 'v@t.com', company: 'T' });

      expect(res.status).toBe(403);
    });

    test('viewer CANNOT access admin endpoints (403)', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── Manager: create + read, no admin ───────────────────────────
  describe('Manager role — create and read, no admin', () => {
    test('manager can create an RFP', async () => {
      const res = await request(app)
        .post('/api/rfps')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ rawInput: 'Manager RFP creation test' });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBe(managerUser.id);
    });

    test('manager can list RFPs (sees only own)', async () => {
      // Create RFPs for different users
      rfps.push(
        { id: autoId++, title: 'Admin RFP', userId: adminUser.id, status: 'draft', vendors: [], proposals: [] },
        { id: autoId++, title: 'Manager RFP', userId: managerUser.id, status: 'draft', vendors: [], proposals: [] }
      );

      const res = await request(app)
        .get('/api/rfps')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      // Manager should only see their own RFP
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Manager RFP');
    });

    test('manager CANNOT access admin endpoints (403)', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── Admin: full access ─────────────────────────────────────────
  describe('Admin role — full access, sees all data', () => {
    test('admin can list ALL RFPs (cross-user)', async () => {
      rfps.push(
        { id: autoId++, title: 'Admin RFP', userId: adminUser.id, status: 'draft', vendors: [], proposals: [] },
        { id: autoId++, title: 'Manager RFP', userId: managerUser.id, status: 'draft', vendors: [], proposals: [] },
        { id: autoId++, title: 'Viewer RFP', userId: viewerUser.id, status: 'draft', vendors: [], proposals: [] }
      );

      const res = await request(app)
        .get('/api/rfps')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Admin sees ALL RFPs (no userId filter applied)
      expect(res.body.data.length).toBe(3);
    });

    test('admin can access another user\'s RFP', async () => {
      const managerRfp = {
        id: autoId++, title: 'Manager Private RFP', userId: managerUser.id,
        status: 'draft', structuredData: {}, vendors: [], proposals: [], comparisons: [],
        update: jest.fn(), destroy: jest.fn(),
      };
      rfps.push(managerRfp);

      const res = await request(app)
        .get(`/api/rfps/${managerRfp.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Manager Private RFP');
    });

    test('admin can access admin endpoints', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
describe('E2E: Data Isolation Between Users', () => {
  beforeEach(() => { resetAndSeed(); });

  test('manager CANNOT access another user\'s RFP (403)', async () => {
    const adminRfp = {
      id: autoId++, title: 'Admin Only RFP', userId: adminUser.id,
      status: 'draft', structuredData: {}, vendors: [], proposals: [], comparisons: [],
      update: jest.fn(), destroy: jest.fn(),
    };
    rfps.push(adminRfp);

    const res = await request(app)
      .get(`/api/rfps/${adminRfp.id}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access denied');
  });

  test('manager CANNOT update another user\'s RFP (403)', async () => {
    const otherRfp = {
      id: autoId++, title: 'Other RFP', userId: adminUser.id,
      status: 'draft', update: jest.fn(), destroy: jest.fn(),
    };
    rfps.push(otherRfp);

    const res = await request(app)
      .put(`/api/rfps/${otherRfp.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Hacked Title' });

    expect(res.status).toBe(403);
  });

  test('manager CANNOT delete another user\'s RFP (403)', async () => {
    const otherRfp = {
      id: autoId++, title: 'Protected RFP', userId: adminUser.id,
      status: 'draft', update: jest.fn(), destroy: jest.fn(),
    };
    rfps.push(otherRfp);

    const res = await request(app)
      .delete(`/api/rfps/${otherRfp.id}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
  });

  test('viewer sees only their own RFPs in listing', async () => {
    rfps.push(
      { id: autoId++, title: 'Viewer RFP', userId: viewerUser.id, status: 'draft', vendors: [], proposals: [] },
      { id: autoId++, title: 'Admin RFP', userId: adminUser.id, status: 'draft', vendors: [], proposals: [] }
    );

    const res = await request(app)
      .get('/api/rfps')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe('Viewer RFP');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('E2E: Admin User Management', () => {
  describe('Full admin journey: list → create → change role → suspend → activate', () => {
    let newUserId;

    beforeAll(() => { resetAndSeed(); });

    test('Step 1: Admin lists all users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(3); // admin + manager + viewer
    });

    test('Step 2: Admin creates a new user with manager role', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newmanager@corp.com',
          password: 'StrongP@ss1',
          firstName: 'New',
          lastName: 'Manager',
          role: 'manager',
        });

      expect(res.status).toBe(201);
      expect(res.body.role).toBe('manager');
      expect(res.body.email).toBe('newmanager@corp.com');
      newUserId = res.body.id;
    });

    test('Step 3: Admin changes user role from manager to admin', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${newUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('admin');
    });

    test('Step 4: Admin suspends a user', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${newUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('suspended');
    });

    test('Step 5: Suspended user is blocked from API access', async () => {
      const suspendedToken = makeToken({ id: newUserId, email: 'newmanager@corp.com', role: 'admin' });

      const res = await request(app)
        .get('/api/rfps')
        .set('Authorization', `Bearer ${suspendedToken}`);

      expect(res.status).toBe(401);
    });

    test('Step 6: Admin reactivates the user', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${newUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });

    test('Step 7: Get individual user details', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${newUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('newmanager@corp.com');
    });
  });

  // ── Admin self-modification prevention ─────────────────────────
  describe('Self-modification prevention', () => {
    beforeEach(() => { resetAndSeed(); });

    test('admin CANNOT change their own role', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${adminUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'viewer' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('own role');
    });

    test('admin CANNOT change their own status', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${adminUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('own status');
    });
  });

  // ── Admin edge cases ───────────────────────────────────────────
  describe('Admin edge cases', () => {
    beforeEach(() => { resetAndSeed(); });

    test('duplicate email rejected on admin user creation', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'admin@corp.com', // already exists
          password: 'StrongP@ss1',
          firstName: 'Duplicate',
          lastName: 'User',
        });

      expect(res.status).toBe(409);
    });

    test('invalid role rejected', async () => {
      const targetId = managerUser.id;

      const res = await request(app)
        .put(`/api/admin/users/${targetId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superadmin' });

      expect(res.status).toBe(400);
    });

    test('invalid status rejected', async () => {
      const targetId = managerUser.id;

      const res = await request(app)
        .put(`/api/admin/users/${targetId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'banned' });

      expect(res.status).toBe(400);
    });

    test('404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/admin/users/9999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
