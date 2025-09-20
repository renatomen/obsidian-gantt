import { Plugin } from 'obsidian';
import { buildGanttViewFactory } from './views/bases-gantt-view';

// Obsidian global API version guard (available in app)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      try { (leaf.view as any)?.refresh?.(); } catch (e) { /* noop */ }
    }
  }

  private registerBasesViewWithRetry(attempt = 0) {
    try {
      if (!requireApiVersion || !requireApiVersion('1.9.12')) return;
      const bases = (this.app as any).internalPlugins?.getEnabledPluginById?.('bases');
      const regs = bases?.registrations;
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
    } catch (e) {
      // continue to retry
    }
    if (attempt < 5) {
      setTimeout(() => this.registerBasesViewWithRetry(attempt + 1), 300);
    } else {
      console.warn('obsidian-gantt: failed to register Bases view after retries');
    }
  }
}

