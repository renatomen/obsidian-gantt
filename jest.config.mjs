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
  moduleNameMapper: {
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@mapping/(.*)$': '<rootDir>/src/mapping/$1',
    '^@gantt/(.*)$': '<rootDir>/src/gantt/$1',
    '^@bases/(.*)$': '<rootDir>/src/bases/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^obsidian$': '<rootDir>/test/__mocks__/obsidian.ts'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs'],
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.test.ts']
};

export default config;

