import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';

const files = [
  { url: 'https://cdn.jsdelivr.net/npm/dhtmlx-gantt@latest/codebase/dhtmlxgantt.min.js', out: 'vendor/dhtmlx/dhtmlxgantt.min.js' },
  { url: 'https://cdn.jsdelivr.net/npm/dhtmlx-gantt@latest/codebase/dhtmlxgantt.min.css', out: 'vendor/dhtmlx/dhtmlxgantt.min.css' }
];

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    console.log(`[vendor] Fetching ${url}`);
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // handle redirect
        return resolve(download(res.headers.location, outPath));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', async () => {
        try {
          const buf = Buffer.concat(chunks);
          await fs.mkdir(path.dirname(outPath), { recursive: true });
          await fs.writeFile(outPath, buf);
          console.log(`[vendor] Wrote ${outPath} (${buf.length} bytes)`);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    for (const f of files) {
      await download(f.url, f.out);
    }
    console.log('[vendor] Done.');
  } catch (e) {
    console.error('[vendor] Failed:', e);
    process.exit(1);
  }
})();

