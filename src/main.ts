import { Plugin } from 'obsidian';
import { buildGanttViewFactory } from './views/bases-gantt-view';

// Obsidian global API version guard (available in app)
declare const requireApiVersion: ((v: string) => boolean) | undefined;

export default class ObsidianGanttPlugin extends Plugin {
  async onload() {
    console.log('obsidian-gantt: onload');
    this.registerBasesViewWithRetry();
  }

  onunload() {
    console.log('obsidian-gantt: onunload');
    // Nothing to explicitly unregister; Bases reads registrations dynamically.
  }

  private refreshBasesLeaves() {
    // Refresh existing Bases leaves so new registrations are available immediately
    const leaves = this.app.workspace.getLeavesOfType?.('bases') ?? [];
    for (const leaf of leaves) {
      const v = (leaf as unknown as { view?: unknown }).view;
      const maybeRefresh = (v as { refresh?: unknown })?.refresh;
      if (typeof maybeRefresh === 'function') {
        try { (maybeRefresh as () => void)(); } catch { /* noop */ }
      }
    }
  }

  private registerBasesViewWithRetry(attempt = 0) {
    try {
      if (!requireApiVersion || !requireApiVersion('1.9.12')) return;
      type InternalPluginsLike = { getEnabledPluginById?: (id: string) => unknown };
      const internal = (this.app as unknown as { internalPlugins?: InternalPluginsLike }).internalPlugins;
      const bases = internal?.getEnabledPluginById?.('bases');
      type BasesRegistration = { name: string; icon: string; factory: ReturnType<typeof buildGanttViewFactory> };
      type BasesPluginLike = { registrations?: Record<string, BasesRegistration> };
      const regs = (bases as BasesPluginLike | undefined)?.registrations;
      if (regs && typeof regs === 'object') {
        regs['ObsidianGantt'] = {
          name: 'Gantt (obsidian-gantt)',
          icon: 'calendar',
          factory: buildGanttViewFactory(this),
        };
        this.refreshBasesLeaves();
        console.log('obsidian-gantt: Bases view "ObsidianGantt" registered');
        return;
      }
    } catch {
      // continue to retry
    }
    if (attempt < 5) {
      setTimeout(() => this.registerBasesViewWithRetry(attempt + 1), 300);
    } else {
      console.warn('obsidian-gantt: failed to register Bases view after retries');
    }
  }
}

