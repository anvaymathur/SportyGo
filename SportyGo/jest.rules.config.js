// Firestore security rules tests: run against the emulator via `npm run test:rules`
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/rules-tests/**/*.test.ts'],
  testTimeout: 30000,
};
