import { type Options } from '@wdio/types';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = process.env.PLUGIN_DIR || path.resolve(__dirname, '../../');
const defaultVault = path.resolve(__dirname, '../../.wdio-vault');
const vaultPath = process.env.OBSIDIAN_TEST_VAULT || defaultVault;

export const config: Options.Testrunner = {
  runner: 'local',
  framework: 'mocha',
  specs: ['../specs/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: [{
    browserName: 'obsidian',
    browserVersion: 'latest',
    'wdio:obsidianOptions': {
      plugins: [path.resolve(pluginRoot, 'dist')],
      vault: vaultPath
    }
  }],
  services: ['obsidian'],
  reporters: ['obsidian'],
  mochaOpts: { ui: 'bdd', timeout: 180000 }
};

