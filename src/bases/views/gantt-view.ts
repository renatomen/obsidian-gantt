import type { Plugin } from 'obsidian';
import type { BasesContainerLike } from '../types';
import { loadLocalDhtmlx, renderDummyGantt } from '../../gantt/dhtmlx-adapter';

/** Factory to create the Bases custom Gantt view (obsidian-gantt). */
export function buildGanttViewFactory(plugin: Plugin) {
  return function createView(basesContainer: BasesContainerLike) {
    let rootEl: HTMLElement | null = null;
    let ephemeral: { scrollTop?: number } = {};

    return {
      async load() {
        try {
          await basesContainer.controller?.runQuery?.();
        } catch { /* best effort */ }
        try {
          await loadLocalDhtmlx(plugin);
        } catch (e) {
          console.warn('obsidian-gantt: failed to load local DHTMLX assets', e);
        }
        const host: HTMLElement = (basesContainer?.viewContainerEl ?? basesContainer?.containerEl ?? document.body) as HTMLElement;
        // Reuse existing root if present to avoid multiple appends
        let existing = host.querySelector('.ogantt-root') as HTMLElement | null;
        if (rootEl && rootEl.isConnected) {
          existing = rootEl;
        }
        if (!existing) {
          const hostWithCreateDiv = host as unknown as { createDiv?: (opts: { cls?: string }) => HTMLElement };
          if (typeof hostWithCreateDiv.createDiv === 'function') {
            rootEl = hostWithCreateDiv.createDiv({ cls: 'ogantt-root' });
          } else {
            const div = document.createElement('div');
            div.className = 'ogantt-root';
            rootEl = host.appendChild(div);
          }
        } else {
          rootEl = existing;
        }
        // Fix height to prevent layout growth and allow internal scroll
        if (rootEl) {
          rootEl.style.height = '60vh';
          rootEl.style.overflow = 'auto';
        }
        // Only render if this root doesn't already contain a gantt container
        if (!rootEl?.querySelector('.gantt_container')) {
          renderDummyGantt(rootEl!);
        }
      },
      refresh() {
        // For MVP we keep refresh minimal; in future we will re-map data and re-render selectively
      },
      onDataUpdated() {
        // Placeholder for data event responses
      },
      onResize() {
        // Optional: propagate to gantt if needed
      },
      getEphemeralState() {
        if (rootEl) ephemeral.scrollTop = rootEl.scrollTop;
        return { ...ephemeral };
      },
      setEphemeralState(state: { scrollTop?: number }) {
        ephemeral = { ...state };
        if (rootEl && typeof state?.scrollTop === 'number') rootEl.scrollTop = state.scrollTop;
      },
      unload() {
        if (rootEl) {
          const maybeEmpty = (rootEl as unknown as { empty?: () => void }).empty;
          if (typeof maybeEmpty === 'function') {
            try { maybeEmpty.call(rootEl); } catch { /* noop */ }
          } else {
            // Fallback clear
            rootEl.textContent = '';
          }
          rootEl.remove();
          rootEl = null;
        }
      },
      destroy() {
        this.unload();
      },
    };
  };
}

