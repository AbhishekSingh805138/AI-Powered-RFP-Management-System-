/**
 * Unit tests for authService — JWT authentication, registration, login, and token management.
 */

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mockUser = {
  id: 1,
  email: 'test@test.com',
  passwordHash: '$2a$10$fakehash',
  firstName: 'Test',
  lastName: 'User',
  role: 'viewer',
  status: 'active',
  lastLoginAt: null,
  update: jest.fn(async function (data) { Object.assign(this, data); return this; }),
};

jest.mock('../../src/models', () => ({
  User: {
    findByPk: jest.fn(),
    create: jest.fn(),
    scope: jest.fn(function () { return this; }),
    findOne: jest.fn(),
  },
}));

const { User } = require('../../src/models');
const authService = require('../../src/services/authService');

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset user mock state
    mockUser.status = 'active';
    mockUser.passwordHash = '$2a$10$fakehash';
    // Clear token blacklist between tests
    authService._clearBlacklistForTest();
  });

  describe('register', () => {
    test('creates a new user and returns tokens', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, email: 'new@test.com', firstName: 'New', lastName: 'User', role: 'viewer' });

      const result = await authService.register({
        email: 'new@test.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      });

      expect(result.user.email).toBe('new@test.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@test.com', firstName: 'New' })
      );
    });

    test('throws 409 if email already registered', async () => {
      User.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.register({ email: 'test@test.com', password: 'pass1234', firstName: 'A', lastName: 'B' })
      ).rejects.toThrow('Email already registered');
    });

    test('hashes the password before storing', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 2, email: 'hash@test.com', firstName: 'H', lastName: 'T', role: 'viewer' });

      await authService.register({ email: 'hash@test.com', password: 'mypassword', firstName: 'H', lastName: 'T' });

      const createCall = User.create.mock.calls[0][0];
      expect(createCall.passwordHash).not.toBe('mypassword');
      expect(createCall.passwordHash.startsWith('$2b$') || createCall.passwordHash.startsWith('$2a$')).toBe(true);
    });
  });

  describe('login', () => {
    test('returns user and tokens on valid credentials', async () => {
      const hash = await bcrypt.hash('correctpass', 10);
      const userWithHash = { ...mockUser, passwordHash: hash };
      User.findOne.mockResolvedValue(userWithHash);

      const result = await authService.login({ email: 'test@test.com', password: 'correctpass' });

      expect(result.user.email).toBe('test@test.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    test('throws 401 if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'noone@test.com', password: 'pass' })
      ).rejects.toThrow('Invalid email or password');
    });

    test('throws 401 if password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      User.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        authService.login({ email: 'test@test.com', password: 'wrong' })
      ).rejects.toThrow('Invalid email or password');
    });

    test('throws 403 if account is suspended', async () => {
      User.findOne.mockResolvedValue({ ...mockUser, status: 'suspended' });

      await expect(
        authService.login({ email: 'test@test.com', password: 'any' })
      ).rejects.toThrow('Account is suspended');
    });

    test('updates lastLoginAt on successful login', async () => {
      const hash = await bcrypt.hash('pass', 10);
      const user = { ...mockUser, passwordHash: hash, update: jest.fn() };
      User.findOne.mockResolvedValue(user);

      await authService.login({ email: 'test@test.com', password: 'pass' });

      expect(user.update).toHaveBeenCalledWith(expect.objectContaining({ lastLoginAt: expect.any(Date) }));
    });
  });

  describe('refreshToken', () => {
    test('returns new access token for valid refresh token', async () => {
      const token = jwt.sign({ id: 1 }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
      User.findByPk.mockResolvedValue({ id: 1, email: 'test@test.com', role: 'viewer', status: 'active' });

      const result = await authService.refreshToken(token);

      expect(result.accessToken).toBeDefined();
      const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET);
      expect(decoded.id).toBe(1);
    });

    test('throws for invalid refresh token', async () => {
      await expect(authService.refreshToken('invalid-token')).rejects.toThrow();
    });

    test('throws if user is suspended', async () => {
      const token = jwt.sign({ id: 1 }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
      User.findByPk.mockResolvedValue({ id: 1, status: 'suspended' });

      await expect(authService.refreshToken(token)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('changePassword', () => {
    test('changes password with correct current password', async () => {
      const hash = await bcrypt.hash('oldpass', 10);
      const user = { ...mockUser, passwordHash: hash, update: jest.fn() };
      User.findByPk.mockResolvedValue(user);

      const result = await authService.changePassword(1, { currentPassword: 'oldpass', newPassword: 'newpass123' });

      expect(result.message).toBe('Password changed successfully');
      expect(user.update).toHaveBeenCalled();
    });

    test('throws 401 if current password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      User.findByPk.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        authService.changePassword(1, { currentPassword: 'wrong', newPassword: 'newpass' })
      ).rejects.toThrow('Current password is incorrect');
    });

    test('throws 404 if user not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(
        authService.changePassword(999, { currentPassword: 'a', newPassword: 'b' })
      ).rejects.toThrow('User not found');
    });
  });

  describe('getProfile', () => {
    test('returns user by id', async () => {
      User.findByPk.mockResolvedValue({ id: 1, email: 'test@test.com', role: 'viewer' });

      const user = await authService.getProfile(1);
      expect(user.email).toBe('test@test.com');
    });

    test('throws 404 if not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(authService.getProfile(999)).rejects.toThrow('User not found');
    });
  });
});
