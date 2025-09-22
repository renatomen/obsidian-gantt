import type { Plugin, WorkspaceLeaf } from 'obsidian';

// Structural typing to avoid tight coupling with Bases internals
interface BasesPluginLike {
  registrations?: Record<string, { name: string; icon?: string; factory: (container: BasesContainerLike) => BasesViewLike }>;
}

export interface BasesContainerLike {
  viewContainerEl: HTMLElement;
  results?: Map<any, any>;
  query?: {
    on?: (event: string, cb: (...args: any[]) => void) => void;
    off?: (event: string, cb: (...args: any[]) => void) => void;
    getViewConfig?: (key: string) => any;
    properties?: Record<string, any>;
  };
  controller?: {
    runQuery?: () => void | Promise<void>;
    getViewConfig?: () => any;
  };
}

export interface BasesViewLike {
  load?: () => void | Promise<void>;
  unload?: () => void | Promise<void>;
  destroy?: () => void | Promise<void>;
  refresh?: () => void | Promise<void>;
  onResize?: () => void;
  onDataUpdated?: () => void;
  getEphemeralState?: () => any;
  setEphemeralState?: (state: any) => void;
}

const BASES_PLUGIN_ID = 'bases';
const REGISTRATION_KEY = 'obsidianGantt';

async function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

function getBasesPlugin(app: any): BasesPluginLike | undefined {
  try {
    const bases = (app?.internalPlugins?.getEnabledPluginById?.(BASES_PLUGIN_ID)) as BasesPluginLike | undefined;
    return bases;
  } catch {
    return undefined;
  }
}

function refreshExistingBasesLeaves(plugin: Plugin) {
  const leaves: WorkspaceLeaf[] = [] as any;
  // Iterate leaves and try to refresh bases views without throwing
  plugin.app.workspace.iterateAllLeaves?.((leaf: WorkspaceLeaf) => {
    const view: any = (leaf as any).view;
    if (view?.getViewType?.() === 'bases' && typeof view?.refresh === 'function') {
      try { view.refresh(); } catch {}
    }
  });
}

export async function registerBasesGantt(plugin: Plugin, factory: (container: BasesContainerLike) => BasesViewLike): Promise<() => void> {
  // Retry loop to handle load order
  let bases: BasesPluginLike | undefined;
  for (let i = 0; i < 5; i++) {
    bases = getBasesPlugin((plugin.app as any));
    if (bases?.registrations) break;
    await sleep(300);
  }

  if (!bases?.registrations) {
    console.warn('obsidian-gantt: Bases plugin not available, skipping registration for now.');
    return () => {};
  }

  // Register view
  bases.registrations![REGISTRATION_KEY] = {
    name: 'Gantt (obsidian-gantt)',
    icon: 'calendar-gantt',
    factory,
  };

  // Refresh existing leaves so the new view appears
  refreshExistingBasesLeaves(plugin);

  // Return unregistration function
  return () => {
    try {
      if (bases?.registrations && REGISTRATION_KEY in bases.registrations) {
        delete bases.registrations[REGISTRATION_KEY];
        refreshExistingBasesLeaves(plugin);
      }
    } catch {}
  };
}

