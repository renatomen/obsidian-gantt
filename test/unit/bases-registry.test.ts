import type { Plugin } from 'obsidian';
import { BasesRegistry, GANTT_VIEW_KEY } from '../../src/bases/registry';

describe('BasesRegistry', () => {
  function makePluginMock(withGetById = true) {
    const basesPlugin: { registrations: Record<string, unknown> } = { registrations: {} };
    const internal: {
      getEnabledPluginById?: (id: string) => unknown;
      plugins: Map<string, unknown>;
    } = {
      getEnabledPluginById: withGetById ? jest.fn().mockImplementation((id: string) => (id === 'bases' ? basesPlugin : undefined)) : undefined,
      plugins: new Map<string, unknown>([["bases-like", basesPlugin]])
    };
    const plugin = {
      app: {
        internalPlugins: internal,
        workspace: { getLeavesOfType: jest.fn().mockReturnValue([]) },
      },
    } as unknown as Plugin;
    return { plugin, basesPlugin };
  }

  it('registers custom view when Bases.registrations exists (getById)', () => {
    const { plugin, basesPlugin } = makePluginMock(true);
    const reg = new BasesRegistry(plugin);
    reg.registerWithRetry(1, 0);
    expect(basesPlugin.registrations[GANTT_VIEW_KEY as keyof typeof basesPlugin.registrations]).toBeDefined();
  });

  it('registers custom view by scanning internalPlugins.plugins when getById not available', () => {
    const { plugin, basesPlugin } = makePluginMock(false);
    const reg = new BasesRegistry(plugin);
    reg.registerWithRetry(1, 0);
    expect(basesPlugin.registrations[GANTT_VIEW_KEY as keyof typeof basesPlugin.registrations]).toBeDefined();
  });

  it('unregister removes the custom view registration', () => {
    const { plugin, basesPlugin } = makePluginMock(true);
    const reg = new BasesRegistry(plugin);
    reg.registerWithRetry(1, 0);
    expect(basesPlugin.registrations[GANTT_VIEW_KEY as keyof typeof basesPlugin.registrations]).toBeDefined();
    reg.unregister();
    expect(basesPlugin.registrations[GANTT_VIEW_KEY as keyof typeof basesPlugin.registrations]).toBeUndefined();
  });
});

