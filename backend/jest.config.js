module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/__tests__/setup.js'],
  moduleNameMapper: {
    'pg-boss': '<rootDir>/__tests__/helpers/pgBossMock.js',
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/**',
    '!src/models/index.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary'],
  verbose: true,
  testTimeout: 10000,
  // Prevent tests from hanging
  forceExit: true,
  detectOpenHandles: true,
};
