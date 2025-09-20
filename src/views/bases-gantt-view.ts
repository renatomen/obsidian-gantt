import type { Plugin } from 'obsidian';
import { loadLocalDhtmlx, renderDummyGantt } from '../gantt/dhtmlx-adapter';

/** Factory to create the ObsidianGantt Bases custom view. */
export function buildGanttViewFactory(plugin: Plugin) {
  return function createView(basesContainer: any) {
    let rootEl: HTMLElement | null = null;

    return {
      async load() {
        try {
          await loadLocalDhtmlx(plugin);
        } catch (e) {
          console.warn('obsidian-gantt: failed to load local DHTMLX assets', e);
        }
        const host: HTMLElement = basesContainer?.viewContainerEl ?? basesContainer?.containerEl ?? document.body;
        rootEl = host.createDiv ? host.createDiv({ cls: 'ogantt-root' }) : host.appendChild(Object.assign(document.createElement('div'), { className: 'ogantt-root' }));
        renderDummyGantt(rootEl);
      },
      unload() {
        if (rootEl) {
          rootEl.empty?.();
          rootEl.remove();
          rootEl = null;
        }
      },
      refresh() {
        if (rootEl) {
          // In a real implementation we would re-map and re-render data
          // Here keep simple: no-op or re-render dummy if needed
        }
      },
      destroy() {
        this.unload();
      },
    };
  };
}

