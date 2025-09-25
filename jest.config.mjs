/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        target: 'es2020'
      },
      module: { type: 'commonjs' }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs'],
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.test.ts']
};

export default config;
