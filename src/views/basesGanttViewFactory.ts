import type { Plugin } from 'obsidian';
import type { BasesContainerLike, BasesViewLike } from './registerBasesGantt';

// For MVP we render a simple placeholder and wire lifecycle.
// When SVAR React Gantt is installed, we will mount a React component here.
export function buildBasesGanttViewFactory(plugin: Plugin): (container: BasesContainerLike) => BasesViewLike {
  return (container: BasesContainerLike): BasesViewLike => {
    let rootEl: HTMLElement | null = null;
    let ephemeral: { scrollTop?: number } = {};

    function renderDummyGantt() {
      if (!container.viewContainerEl) return;
      // Clear
      container.viewContainerEl.empty?.();
      while (container.viewContainerEl.firstChild) {
        container.viewContainerEl.removeChild(container.viewContainerEl.firstChild);
      }
      // Root
      rootEl = container.viewContainerEl.createDiv?.({ cls: 'ogantt-root' }) ?? document.createElement('div');
      if (!rootEl.isConnected) container.viewContainerEl.appendChild(rootEl);

      // Header
      const header = document.createElement('div');
      header.textContent = 'Obsidian Gantt (MVP)';
      header.className = 'ogantt-header';

      // Timeline placeholder
      const timeline = document.createElement('div');
      timeline.className = 'ogantt-timeline';
      timeline.style.border = '1px solid var(--background-modifier-border)';
      timeline.style.height = '240px';
      timeline.style.display = 'grid';
      timeline.style.placeItems = 'center';
      timeline.textContent = 'SVAR Gantt will render here (dummy data placeholder)';

      rootEl.appendChild(header);
      rootEl.appendChild(timeline);
    }

    return {
      async load() {
        try {
          // If Bases exposes controller, compute formulas before first paint
          await container.controller?.runQuery?.();
        } catch {}
        renderDummyGantt();
      },
      async unload() {
        // remove listeners if any
      },
      async destroy() {
        if (rootEl?.parentElement) rootEl.parentElement.removeChild(rootEl);
        rootEl = null;
      },
      async refresh() {
        renderDummyGantt();
      },
      onResize() {
        // For real Gantt, remeasure / rerender if needed
      },
      onDataUpdated() {
        // For real Gantt, apply selective updates; MVP re-renders
        renderDummyGantt();
      },
      getEphemeralState() {
        if (!rootEl) return ephemeral;
        ephemeral.scrollTop = rootEl.scrollTop;
        return ephemeral;
      },
      setEphemeralState(state: any) {
        ephemeral = state ?? {};
        if (rootEl && typeof ephemeral.scrollTop === 'number') {
          rootEl.scrollTop = ephemeral.scrollTop;
        }
      },
    };
  };
}

