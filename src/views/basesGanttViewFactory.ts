import type { Plugin } from 'obsidian';
import type { BasesContainerLike, BasesViewLike } from './registerBasesGantt';
import React from 'react';
import { mountReact } from '../ui/mountReact';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { GanttContainer } from '../components/GanttContainer';

// MVP: mount React + SVAR Gantt with dummy data, with error boundary and clean unmount
export function buildBasesGanttViewFactory(_plugin: Plugin): (container: BasesContainerLike) => BasesViewLike {
  return (container: BasesContainerLike): BasesViewLike => {
    let hostEl: HTMLElement | null = null;
    let unmount: (() => void) | null = null;
    let ephemeral: { scrollTop?: number } = {};

    function mount() {
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
      // Mount React subtree
      if (unmount) { try { unmount(); } catch {} }
      unmount = mountReact(hostEl, React.createElement(ErrorBoundary, null, React.createElement(GanttContainer)));
    }

    return {
      async load() {
        try {
          // If Bases exposes controller, compute formulas before first paint
          await container.controller?.runQuery?.();
        } catch {}
        mount();
      },
      async unload() {
        // remove listeners if any later
      },
      async destroy() {
        try { unmount?.(); } catch {}
        if (hostEl?.parentElement) hostEl.parentElement.removeChild(hostEl);
        unmount = null;
        hostEl = null;
      },
      async refresh() {
        mount();
      },
      onResize() {
        // For real Gantt, remeasure / rerender if needed
      },
      onDataUpdated() {
        // For real Gantt, apply selective updates; MVP re-renders
        mount();
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

