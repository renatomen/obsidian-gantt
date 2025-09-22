import type { Plugin } from 'obsidian';
import type { BasesContainerLike, BasesViewLike } from './registerBasesGantt';
import React from 'react';
import { mountReact } from '../ui/mountReact';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { GanttContainer } from '../components/GanttContainer';
import { BasesDataSource } from '../data-sources/BasesDataSource';
import type { GanttConfig, SVARTask } from '../data-sources/DataSourceAdapter';
import type { FieldMappings } from '../mapping/FieldMappings';
import { validateGanttConfig, applyGanttDefaults } from '../utils/ValidationEngine';

function readGanttConfig(container: BasesContainerLike): Partial<GanttConfig> | undefined {
  try {
    const qAny = container.query as any;
    const vc = qAny?.getViewConfig?.('obsidianGantt');
    if (vc) return vc as Partial<GanttConfig>;
  } catch {}
  try {
    const cAny = container.controller?.getViewConfig?.();
    const og = cAny?.obsidianGantt;
    if (og) return og as Partial<GanttConfig>;
  } catch {}
  return undefined;
}

// Phase 2: mount React + SVAR Gantt with real data via Bases adapter, with error boundary and clean unmount
export function buildBasesGanttViewFactory(_plugin: Plugin): (container: BasesContainerLike) => BasesViewLike {
  return (container: BasesContainerLike): BasesViewLike => {
    let hostEl: HTMLElement | null = null;
    let unmount: (() => void) | null = null;
    let ephemeral: { scrollTop?: number } = {};
    let tasks: SVARTask[] = [];
    let lastError: string | null = null;

    function render() {
      if (!container.viewContainerEl) return;
      container.viewContainerEl.empty?.();
      while (container.viewContainerEl.firstChild) {
        container.viewContainerEl.removeChild(container.viewContainerEl.firstChild);
      }
      hostEl = container.viewContainerEl.createDiv?.({ cls: 'ogantt-root' }) ?? document.createElement('div');
      if (!hostEl.isConnected) container.viewContainerEl.appendChild(hostEl);
      if (typeof ephemeral.scrollTop === 'number') hostEl.scrollTop = ephemeral.scrollTop;
      if (unmount) { try { unmount(); } catch {} }

      const element = lastError
        ? React.createElement('div', { className: 'ogantt-error' }, lastError)
        : React.createElement(GanttContainer, { tasks });

      unmount = mountReact(hostEl, React.createElement(ErrorBoundary, null, element));
    }

    async function recomputeAndRender() {
      lastError = null;
      try {
        const baseConfig = readGanttConfig(container) ?? {
          fieldMappings: defaultFieldMappings(),
          viewMode: 'Week',
          defaultDuration: 3,
          showMissingDates: true,
          missingStartBehavior: 'infer',
          missingEndBehavior: 'infer',
        } as Partial<GanttConfig>;
        const v = validateGanttConfig(baseConfig as any);
        if (!v.ok) {
          lastError = `Invalid obsidianGantt config: ${(v.errors || []).join('; ')}`;
          tasks = [];
          render();
          return;
        }
        const config = applyGanttDefaults(baseConfig as any);
        const adapter = new BasesDataSource(container);
        await adapter.initialize();
        const raw = await adapter.queryData(config);
        tasks = adapter.mapToSVARFormat(raw, config.fieldMappings as FieldMappings, config);
      } catch (e: any) {
        lastError = `Failed to load data: ${e?.message ?? e}`;
        tasks = [];
      }
      render();
    }

    return {
      async load() {
        await recomputeAndRender();
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
        await recomputeAndRender();
      },
      onResize() {
        // No-op for now
      },
      onDataUpdated() {
        void recomputeAndRender();
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

function defaultFieldMappings(): FieldMappings {
  return { id: 'path', text: 'title', start: 'scheduled', end: 'due', parent: 'parent', parents: 'parents' };
}

