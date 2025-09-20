'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const DEFAULT_VAULT = 'C:\\Users\\renato\\obsidian-test-vaults\\obsidian-gantt-test-vault';
const vaultPath = process.env.OBSIDIAN_TEST_VAULT || DEFAULT_VAULT;
const pluginId = 'obsidian-gantt';
const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', pluginId);

(async () => {
  try {
    await fsp.mkdir(pluginDir, { recursive: true });

    const files = ['manifest.json', 'main.js', 'styles.css'];
    for (const file of files) {
      const src = path.join('dist', file);
      const dest = path.join(pluginDir, file);
      if (fs.existsSync(src)) {
        await fsp.copyFile(src, dest);
        console.log(`[install] Copied ${src} -> ${dest}`);
      } else {
        console.warn(`[install] Missing ${src}, skipped`);
      }
    }
    // Copy vendor directory recursively if present
    const srcVendor = path.join('dist', 'vendor');
    const destVendor = path.join(pluginDir, 'vendor');
    if (fs.existsSync(srcVendor)) {
      if (fs.existsSync(destVendor)) {
        await fsp.rm(destVendor, { recursive: true, force: true });
      }
      if (typeof fsp.cp === 'function') {
        await fsp.cp(srcVendor, destVendor, { recursive: true });
      } else {
        // Fallback copy
        const copyDir = async (src, dest) => {
          await fsp.mkdir(dest, { recursive: true });
          for (const entry of await fsp.readdir(src, { withFileTypes: true })) {
            const s = path.join(src, entry.name);
            const d = path.join(dest, entry.name);
            if (entry.isDirectory()) await copyDir(s, d);
            else await fsp.copyFile(s, d);
          }
        };
        await copyDir(srcVendor, destVendor);
      }
      console.log(`[install] Copied vendor assets -> ${destVendor}`);
    } else {
      console.log('[install] No dist/vendor found; skipping vendor copy');
    }


    // Ensure data.json exists; do not overwrite if present
    const dataPath = path.join(pluginDir, 'data.json');
    if (!fs.existsSync(dataPath)) {
      await fsp.writeFile(dataPath, '{}', 'utf8');
      console.log(`[install] Created ${dataPath}`);
    } else {
      console.log('[install] data.json already exists; not overwriting');
    }

    console.log(`[install] Installed plugin to ${pluginDir}`);
  } catch (err) {
    console.error('[install] Failed:', err);
    process.exit(1);
  }
})();

