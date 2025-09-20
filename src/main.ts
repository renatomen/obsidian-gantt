import { Plugin, requireApiVersion } from 'obsidian';
import { BasesRegistry } from './bases';



export default class ObsidianGanttPlugin extends Plugin {
  private bases: BasesRegistry | null = null;

  async onload() {
    console.log('obsidian-gantt: onload');
    try {
      if (requireApiVersion && requireApiVersion('1.9.12')) {
        // Early registration attempt (like TaskNotes)
        this.bases = new BasesRegistry(this);
        this.bases.registerWithRetry(5, 200);
      }
    } catch { /* noop */ }

    // Also register again once layout is ready (more generous retries)
    this.app.workspace.onLayoutReady(() => {
      try {
        if (!requireApiVersion || !requireApiVersion('1.9.12')) return;
        if (!this.bases) this.bases = new BasesRegistry(this);
        this.bases.registerWithRetry(20, 300);
      } catch { /* noop */ }
    });
  }

  onunload() {
    console.log('obsidian-gantt: onunload');
    this.bases?.unregister();
    this.bases = null;
  }

}

