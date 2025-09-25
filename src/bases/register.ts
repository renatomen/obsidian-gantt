import type { Plugin } from 'obsidian';

// Structural typing to avoid coupling to Bases internals
export interface BasesContainerLike {
  viewContainerEl: HTMLElement;
  results?: Map<any, any>;
  query?: { on?: (ev: string, cb: () => void) => void; off?: (ev: string, cb: () => void) => void; getViewConfig?: (k: string) => any };
  controller?: { runQuery?: () => void; getViewConfig?: () => any };
}

export interface BasesViewLike {
  load?: () => void | Promise<void>;
  unload?: () => void | Promise<void>;
  destroy?: () => void | Promise<void>;
  refresh?: () => void | Promise<void>;
  onDataUpdated?: () => void | Promise<void>;
  onResize?: () => void | Promise<void>;
  getEphemeralState?: () => Record<string, unknown>;
  setEphemeralState?: (s: Record<string, unknown>) => void;
}

const BASES_PLUGIN_ID = 'bases';
const VIEW_KEY = 'obsidianGantt';
const VIEW_NAME = 'Gantt (OG)';
const VIEW_ICON = 'calendar-gantt';

export function registerBasesGantt(plugin: Plugin): () => void {
  // Guard API version (from learnings)
  try {
    if (typeof (window as any).requireApiVersion === 'function') {
      const ok = (window as any).requireApiVersion?.('1.9.12');
      if (!ok) {
        console.warn('[Gantt] Skipping Bases registration: API < 1.9.12');
        return () => {};
      }
    }
  } catch (e) {
    // If guard not available, continue optimistically
  }

  let unregistered = false;
  let attempts = 0;
  const maxAttempts = 5;
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const tryRegister = async (): Promise<boolean> => {
    const anyApp = plugin.app as any;
    const bases = anyApp?.internalPlugins?.getEnabledPluginById?.(BASES_PLUGIN_ID);
    const registry = bases?.registrations;

    if (!registry) return false;

    if (registry[VIEW_KEY]) {
      // Already registered by us or another session, overwrite defensively
      delete registry[VIEW_KEY];
    }

    registry[VIEW_KEY] = {
      name: VIEW_NAME,
      icon: VIEW_ICON,
      factory: (container: BasesContainerLike): BasesViewLike => {
        const root = container.viewContainerEl;
        let component: any = null;

        return {
          load() {
            try { container.controller?.runQuery?.(); } catch {}
            try {
              // Dynamically import to avoid hard coupling
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const Mod = require('./GanttContainer.svelte');
              const GanttContainer = Mod?.default ?? Mod;
              component = new GanttContainer({ target: root, props: {} });
            } catch (e) {
              const fallback = root.createDiv({ cls: 'og-bases-gantt-fallback' });
              fallback.setText('Gantt (OG): failed to render chart. See console.');
              console.warn('[Gantt] Failed to mount GanttContainer', e);
            }
          },
          refresh() {},
          onDataUpdated() { /* For OG-23 dummy data remains static */ },
          onResize() {},
          getEphemeralState() { return {}; },
          setEphemeralState() {},
          unload() {},
          destroy() {
            try { component?.$destroy?.(); } catch {}
            try { while (root.firstChild) root.removeChild(root.firstChild); } catch {}
          },
        };
      },
    };

    // Refresh existing Bases leaves if possible
    try {
      const leaves = plugin.app.workspace.getLeavesOfType?.('bases') ?? [];
      for (const leaf of leaves) {
        const view: any = leaf.view;
        if (view?.refresh) {
          try { view.refresh(); } catch {}
        }
      }
    } catch {}

    console.info('[Gantt] Registered Bases view:', VIEW_NAME);
    return true;
  };

  // Kickoff retry loop without blocking plugin onload
  (async () => {
    while (!unregistered && attempts < maxAttempts) {
      if (await tryRegister()) break;
      attempts++;
      await delay(500);
    }
    if (attempts >= maxAttempts) {
      console.warn('[Gantt] Bases plugin not available – registration skipped');
    }
  })();

  // Unregister function for onunload
  return () => {
    unregistered = true;
    try {
      const anyApp = plugin.app as any;
      const bases = anyApp?.internalPlugins?.getEnabledPluginById?.(BASES_PLUGIN_ID);
      const registry = bases?.registrations;
      if (registry && registry[VIEW_KEY]) {
        delete registry[VIEW_KEY];
        // Attempt to refresh leaves to remove option
        const leaves = plugin.app.workspace.getLeavesOfType?.('bases') ?? [];
        for (const leaf of leaves) {
          const view: any = leaf.view;
          if (view?.refresh) {
            try { view.refresh(); } catch {}
          }
        }
      }
    } catch {}
  };
}

