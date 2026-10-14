module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/env.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
};
