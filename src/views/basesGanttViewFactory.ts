import type { Plugin } from 'obsidian';
import type { BasesContainerLike, BasesViewLike } from './registerBasesGantt';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GanttMvp } from '../ui/GanttMvp';

// MVP: mount React + SVAR Gantt with dummy data
export function buildBasesGanttViewFactory(_plugin: Plugin): (container: BasesContainerLike) => BasesViewLike {
  return (container: BasesContainerLike): BasesViewLike => {
    let hostEl: HTMLElement | null = null;
    let reactRoot: Root | null = null;
    let ephemeral: { scrollTop?: number } = {};

    function mountReact() {
      if (!container.viewContainerEl) return;
      // Clear container
      container.viewContainerEl.empty?.();
      while (container.viewContainerEl.firstChild) {
        container.viewContainerEl.removeChild(container.viewContainerEl.firstChild);
      }
      // Host element for React
      hostEl = container.viewContainerEl.createDiv?.({ cls: 'ogantt-root' }) ?? document.createElement('div');
      if (!hostEl.isConnected) container.viewContainerEl.appendChild(hostEl);
      // Restore scroll if present
      if (typeof ephemeral.scrollTop === 'number') hostEl.scrollTop = ephemeral.scrollTop;
      // Mount React root
      reactRoot = createRoot(hostEl);
      reactRoot.render(React.createElement(GanttMvp));
    }

    return {
      async load() {
        try {
          // If Bases exposes controller, compute formulas before first paint
          await container.controller?.runQuery?.();
        } catch {}
        mountReact();
      },
      async unload() {
        // remove listeners if any
      },
      async destroy() {
        try { reactRoot?.unmount(); } catch {}
        if (hostEl?.parentElement) hostEl.parentElement.removeChild(hostEl);
        reactRoot = null;
        hostEl = null;
      },
      async refresh() {
        mountReact();
      },
      onResize() {
        // For real Gantt, remeasure / rerender if needed
      },
      onDataUpdated() {
        // For real Gantt, apply selective updates; MVP re-renders
        mountReact();
      },
      getEphemeralState() {
        if (!hostEl) return ephemeral;
        ephemeral.scrollTop = hostEl.scrollTop;
        return ephemeral;
      },
      setEphemeralState(state: any) {
        ephemeral = state ?? {};
        if (hostEl && typeof ephemeral.scrollTop === 'number') {
          hostEl.scrollTop = ephemeral.scrollTop;
        }
      },
    };
  };
}

