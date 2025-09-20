import { browser } from '@wdio/globals';

describe('Bases registration', () => {
  it('registers obsidianGantt with Bases', async () => {
    await browser.reloadObsidian?.({
      vault: process.env.OBSIDIAN_TEST_VAULT || 'C:/Users/renato/obsidian-test-vaults/obsidian-gantt-test-vault'
    });

    let keys: string[] = [];
    let ok = false;

    for (let i = 0; i < 50; i++) {
      keys = await browser.execute(() => {
        // @ts-ignore - executed in Obsidian renderer context
        const ip = app.internalPlugins;
        const bases = ip?.getEnabledPluginById?.('bases');
        const regs = bases?.registrations || {};
        return Object.keys(regs);
      });
      if (keys.includes('obsidianGantt')) { ok = true; break; }
      await browser.pause(200);
    }

    if (!ok) {
      const diag = await browser.execute(() => {
        // @ts-ignore - executed in Obsidian renderer context
        const ip = app.internalPlugins;
        const bases = ip?.getEnabledPluginById?.('bases');
        const ids = Array.from(ip?.plugins?.keys?.() ?? []);
        const regs = Object.keys(bases?.registrations ?? {});
        return { ids, regs, hasBases: Boolean(bases) };
      });
      // Print diagnostics to WDIO logs for troubleshooting
      // eslint-disable-next-line no-console
      console.log('[bases-reg diag]', JSON.stringify(diag));
    }

    expect(keys).toContain('obsidianGantt');
  });
});

