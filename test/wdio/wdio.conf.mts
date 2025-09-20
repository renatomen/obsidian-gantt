import { type Options } from '@wdio/types';

export const config: Options.Testrunner = {
  runner: 'local',
  framework: 'mocha',
  specs: ['./test/specs/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: [{
    browserName: 'obsidian',
    browserVersion: 'latest',
    'wdio:obsidianOptions': {
      plugins: ['.'],
      vault: process.env.OBSIDIAN_TEST_VAULT || 'C:/Users/renato/obsidian-test-vaults/obsidian-gantt-test-vault'
    }
  }],
  services: ['obsidian'],
  reporters: ['obsidian'],
  mochaOpts: { ui: 'bdd', timeout: 120000 }
};

