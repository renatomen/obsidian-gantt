import { Plugin, requireApiVersion } from 'obsidian';
import { registerBasesGantt } from './views/registerBasesGantt';
import { buildBasesGanttViewFactory } from './views/basesGanttViewFactory';

export default class ObsidianGanttPlugin extends Plugin {
  private unregisterBases?: () => void;

  async onload() {
    console.log('obsidian-gantt: onload');

    // Try to register Bases custom view (type: obsidianGantt)
    try {
      if (requireApiVersion?.('1.9.12')) {
        const factory = buildBasesGanttViewFactory(this);
        this.unregisterBases = await registerBasesGantt(this, factory);
        console.log('obsidian-gantt: Bases view registered (obsidianGantt)');
      } else {
        console.warn('obsidian-gantt: Obsidian API version too low for Bases integration');
      }
    } catch (e) {
      console.warn('obsidian-gantt: Failed to register Bases view', e);
    }
  }

  onunload() {
    console.log('obsidian-gantt: onunload');
    try { this.unregisterBases?.(); } catch {}
  }
}

