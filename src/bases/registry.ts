import type { Plugin, WorkspaceLeaf } from 'obsidian';
import { buildGanttViewFactory } from '@bases/views/gantt-view';

/** Key used to register our custom view inside Bases */
export const GANTT_VIEW_KEY = 'obsidianGantt';

/** Minimal structural type for Bases plugin surface we use */
export type BasesRegistration = { name: string; icon: string; factory: ReturnType<typeof buildGanttViewFactory> };
export type BasesPluginLike = { registrations?: Record<string, BasesRegistration> };

export class BasesRegistry {
  private readonly plugin: Plugin;
  private retryTimer: number | null = null;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /** Find the Bases internal plugin instance using resilient strategies. */
  findBasesPlugin(): unknown {
    type Internal = { plugins?: Map<string, unknown>; getEnabledPluginById?: (id: string) => unknown };
    const internal = (this.plugin.app as unknown as { internalPlugins?: Internal }).internalPlugins;
    const byId = internal?.getEnabledPluginById?.('bases');
    if (byId) return byId;
    const map = (internal as { plugins?: Map<string, unknown> } | undefined)?.plugins;
    if (map && typeof (map as unknown as { forEach: unknown }).forEach === 'function') {
      let candidate: unknown;
      (map as Map<string, unknown>).forEach((val) => {
        const regs = (val as { registrations?: unknown } | undefined)?.registrations;
        if (!candidate && regs && typeof regs === 'object') candidate = val;
      });
      if (candidate) return candidate;
    }
    return undefined;
  }

  /** Refresh existing Bases leaves so new registrations become available without restart. */
  refreshLeaves(): void {
    try {
      this.plugin.app.workspace.iterateAllLeaves?.((leaf: WorkspaceLeaf) => {
        const v = (leaf.view as unknown) as { getViewType?: () => string; refresh?: () => void };
        const viewType = v?.getViewType?.();
        if (viewType === 'bases' && typeof v.refresh === 'function') {
          try { v.refresh(); } catch { /* noop */ }
        }
      });
    } catch {
      // Fallback: older approach
      const leaves = this.plugin.app.workspace.getLeavesOfType?.('bases') ?? [];
      for (const leaf of leaves) {
        const v = (leaf as unknown as { view?: unknown }).view;
        const maybeRefresh = (v as { refresh?: unknown })?.refresh;
        if (typeof maybeRefresh === 'function') {
          try { (maybeRefresh as () => void)(); } catch { /* noop */ }
        }
      }
    }
  }

  /** Attempt a single registration pass. Returns true if it succeeded. */
  private tryRegisterOnce(): boolean {
    try {
      const bases = this.findBasesPlugin();
      const regs = (bases as BasesPluginLike | undefined)?.registrations;
      if (!regs || typeof regs !== 'object') return false;
      regs[GANTT_VIEW_KEY] = {
        name: 'Gantt (obsidian-gantt)',
        icon: 'calendar',
        factory: buildGanttViewFactory(this.plugin),
      };
      this.refreshLeaves();
      console.log('obsidian-gantt: Bases view registered:', GANTT_VIEW_KEY);
      return true;
    } catch {
      return false;
    }
  }

  /** Register with retries; resolves when success or retries exhausted. */
  registerWithRetry(maxAttempts = 20, delayMs = 300): void {
    let attempt = 0;
    const tick = () => {
      if (this.tryRegisterOnce()) return;
      attempt += 1;
      if (attempt >= maxAttempts) {
        console.warn('obsidian-gantt: failed to register Bases view after retries');
        this.retryTimer = null;
        return;
      }
      this.retryTimer = window.setTimeout(tick, delayMs);
      if (attempt % 5 === 0) {
        try {
          const internal = (this.plugin.app as unknown as { internalPlugins?: { plugins?: Map<string, unknown> } }).internalPlugins;
          const keysIter = internal?.plugins?.keys?.();
          const ids = keysIter ? Array.from(keysIter) : [];
          console.warn('obsidian-gantt: Bases not ready; internal plugin IDs:', ids);
        } catch { /* noop */ }
      }
    };
    tick();
  }

  /** Remove our registration safely if present. */
  unregister(): void {
    try {
      if (this.retryTimer !== null) {
        window.clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
      const bases = this.findBasesPlugin();
      const regs = (bases as BasesPluginLike | undefined)?.registrations;
      if (regs && typeof regs === 'object' && GANTT_VIEW_KEY in regs) {
        delete (regs as Record<string, unknown>)[GANTT_VIEW_KEY];
      }
    } catch { /* noop */ }
  }
}

