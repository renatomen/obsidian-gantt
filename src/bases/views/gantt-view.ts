import type { Plugin } from 'obsidian';
import type { BasesContainerLike } from '../types';
import { loadLocalDhtmlx } from '../../gantt/dhtmlx-adapter';
import { GanttService, type GanttLike } from '../../gantt/gantt-service';
import { mapItemsToGantt, type GanttConfig } from '../../mapping/mapping-service';

type BasesDataItem = {
  key: unknown;
  data: unknown;
  file?: unknown;
  path?: string;
  properties?: Record<string, unknown>;
  basesData: unknown;
};
type BasesViewLike = { type?: string; name?: string; data?: Record<string, unknown>; obsidianGantt?: unknown };


/** Factory to create the Bases custom Gantt view (obsidian-gantt). */
export function buildGanttViewFactory(plugin: Plugin) {
  return function createView(basesContainer: BasesContainerLike) {
    let rootEl: HTMLElement | null = null;
    let ephemeral: { scrollTop?: number } = {};
    let ganttService: GanttService | null = null;

    const asRecord = (v: unknown): Record<string, unknown> | undefined => (v && typeof v === 'object') ? v as Record<string, unknown> : undefined;

    // Extract data items from Bases results (following TaskNotes pattern)
    const extractDataItems = (): BasesDataItem[] => {
      const dataItems: BasesDataItem[] = [];
      const results = basesContainer?.results as Map<unknown, unknown> | undefined;

      if (results && results instanceof Map) {
        for (const [key, value] of results.entries()) {
          const item: BasesDataItem = {
            key,
            data: value,
            file: asRecord(value)?.file,
            path: (asRecord(asRecord(value)?.file)?.path as string) ?? (asRecord(value)?.path as string),
            properties: (asRecord(value)?.properties as Record<string, unknown>) ?? (asRecord(value)?.frontmatter as Record<string, unknown>),
            basesData: value
          };
          dataItems.push(item);
        }
      }

      return dataItems;
    };

    // Simple error renderer in the container
    const renderError = (message: string, details?: string[]) => {
      if (!rootEl) return;
      const list = (details && details.length)
        ? `<ul style="margin:8px 0 0 18px;">${details.map(d => `<li>${d}</li>`).join('')}</ul>`
        : '';
      rootEl.innerHTML = `
        <div class="ogantt-error" style="padding:12px 14px; margin:8px; border:1px solid var(--color-red, #d73a49); border-radius:6px; background: rgba(215,58,73,0.08); color: var(--text-normal);">
          <div style="font-weight:600; color: var(--color-red, #d73a49);">obsidian-gantt configuration error</div>
          <div style="margin-top:6px; line-height:1.4;">${message}</div>
          ${list}
          <div style="margin-top:8px; font-size:12px; opacity:0.8;">Open this view’s YAML and configure obsidianGantt.fieldMappings (id, text, start, end).</div>
        </div>`;
    };

    const safeJson = (obj: unknown): string => {
      try {
        return JSON.stringify(obj, (_k, v) => (typeof v === 'function' ? `[Function:${(v as Function).name||'anon'}]` : v), 2)?.slice(0, 4000) ?? '';
      } catch {
        return String(obj);
      }
    };

    const getObsGanttConfig = (): { ok: true; cfg: GanttConfig } | { ok: false; reason: string; missing?: string[] } => {
      // Try multiple surfaces observed in Bases implementations
      try { console.debug('obsidian-gantt: basesContainer keys', Object.keys(basesContainer as object)); } catch { /* intentionally empty: debug surface not available */ }
      const q = basesContainer?.query;
      const c = basesContainer?.controller;
      try { console.debug('obsidian-gantt: basesContainer.query keys', q ? Object.keys(q) : null); } catch { /* intentionally empty */ }
      try { console.debug('obsidian-gantt: basesContainer.controller keys', c ? Object.keys(c) : null); } catch { /* intentionally empty */ }

      const ogFromQuery = (q as unknown as { getViewConfig?: (key?: string) => unknown })?.getViewConfig?.('obsidianGantt');
      const ogFromControllerKey = c?.getViewConfig?.('obsidianGantt');
      const ogFromControllerObj = (c?.getViewConfig?.() as unknown) as Record<string, unknown> | undefined;

      // New: inspect query.views and current viewName
      const views = (q as unknown as { views?: unknown })?.views as unknown;
      const viewName = (() => { const v = (basesContainer as Record<string, unknown>)['viewName']; return typeof v === 'string' ? v : undefined; })();
      try { console.debug('obsidian-gantt: query.views length', Array.isArray(views) ? views.length : null); } catch { /* intentionally empty */ }
      try { console.debug('obsidian-gantt: current viewName', viewName ?? null); } catch { /* intentionally empty */ }
      let selectedView: BasesViewLike | undefined = undefined;
      if (Array.isArray(views)) {
        const vs = views as BasesViewLike[];
        selectedView = vs.find(v => (v?.type === 'obsidianGantt' || v?.type === 'obsidian-gantt') && (!viewName || v?.name === viewName))
          || vs.find(v => (v?.type === 'obsidianGantt' || v?.type === 'obsidian-gantt'));
      }
      try { console.debug('obsidian-gantt: selectedView keys', selectedView ? Object.keys(selectedView) : null); } catch { /* intentionally empty */ }

      console.debug('obsidian-gantt: debug getViewConfig surfaces', safeJson({
        fromQuery: ogFromQuery,
        fromControllerKey: ogFromControllerKey,
        controllerObjKeys: ogFromControllerObj ? Object.keys(ogFromControllerObj) : null,
        selectedViewType: selectedView?.type,
        hasSelectedObsGantt: !!selectedView?.obsidianGantt
      }));

      // Extra diagnostics: dump raw containers
      try { console.debug('obsidian-gantt: controller.getViewConfig() raw', safeJson(ogFromControllerObj)); } catch { /* intentionally empty */ }
      try { console.debug('obsidian-gantt: query.getViewConfig("obsidianGantt") raw', safeJson(ogFromQuery)); } catch { /* intentionally empty */ }
      try { console.debug('obsidian-gantt: controller.getViewConfig("obsidianGantt") raw', safeJson(ogFromControllerKey)); } catch { /* intentionally empty */ }
      try { console.debug('obsidian-gantt: query.views[selected] raw', safeJson(selectedView)); } catch { /* intentionally empty */ }
      try { console.debug('obsidian-gantt: selectedView.data keys', selectedView?.data ? Object.keys(selectedView.data) : null); } catch { /* intentionally empty */ }

      const og: Record<string, unknown> =
        selectedView?.obsidianGantt
        ?? selectedView?.data?.obsidianGantt
        ?? (selectedView?.data && selectedView?.data.fieldMappings ? selectedView.data : undefined)
        ?? ogFromQuery
        ?? ogFromControllerKey
        ?? (ogFromControllerObj as Record<string, unknown> | undefined)?.['obsidianGantt']
        ?? ({} as Record<string, unknown>);
      console.debug('obsidian-gantt: debug resolved obsidianGantt', safeJson(og));

      const fm = og['fieldMappings'] as Record<string, string> | undefined;
      if (!fm || typeof fm !== 'object') {
        console.debug('obsidian-gantt: debug fieldMappings missing or invalid', safeJson(fm));
        return { ok: false, reason: 'Missing obsidianGantt.fieldMappings block.' };
      }
      const required = ['id','text','start','end'];
      const missing = required.filter(k => typeof fm[k] !== 'string' || !String(fm[k]).trim());
      if (missing.length > 0) {
        console.debug('obsidian-gantt: debug missing required fieldMappings', missing);
        return { ok: false, reason: 'Required field mappings are missing:', missing };
      }

      const cfg: GanttConfig = {
        viewMode: (og['viewMode'] as 'Day'|'Week'|'Month') ?? 'Day',
        show_today_marker: Boolean((og['show_today_marker'] as unknown) ?? false),
        hide_task_names: Boolean((og['hide_task_names'] as unknown) ?? false),
        showMissingDates: Boolean((og['showMissingDates'] as unknown) ?? true),
        missingStartBehavior: (og['missingStartBehavior'] as 'infer'|'show'|'hide') ?? 'infer',
        missingEndBehavior: (og['missingEndBehavior'] as 'infer'|'show'|'hide') ?? 'infer',
        defaultDuration: Number.isFinite(og['defaultDuration'] as number) ? Number(og['defaultDuration']) : 5,
        showMissingDateIndicators: Boolean((og['showMissingDateIndicators'] as unknown) ?? true),
        fieldMappings: fm,
      };
      console.debug('obsidian-gantt: debug finalized cfg', safeJson(cfg));
      return { ok: true, cfg };
    };

    // Render Gantt with real data
    const renderGantt = async () => {
      if (!rootEl) return;

      try {
        // Extract data from Bases
        const dataItems = extractDataItems();

        // Transform to format expected by mapping service
        const items = dataItems.map(item => {
          const raw = (item.basesData && typeof item.basesData === 'object') ? (item.basesData as Record<string, unknown>) : {};
          const rawFile = (raw && (raw['file'] && typeof raw['file'] === 'object')) ? (raw['file'] as Record<string, unknown>) : {};
          const computedPath = item.path ?? String(item.key ?? '');
          const computedName = computedPath ? computedPath.split('/').pop() : String(item.key ?? '');

          // Compute standard file properties following TaskNotes pattern
          const computedBasename = computedName ? computedName.replace(/\.md$/i, '') : '';
          const computedFolder = computedPath ? computedPath.split('/').slice(0, -1).join('/') : '';

          // Expose built-ins for dotted mappings like "file.path", and pass through any system-provided fields
          const base: Record<string, unknown> = {
            file: {
              ...rawFile,
              path: rawFile.path ?? computedPath,
              name: rawFile.name ?? computedName,
              basename: rawFile.basename ?? computedBasename,
              folder: rawFile.folder ?? computedFolder,
            },
          };
          // Also pass through note if Bases provided it (for mappings like "note.ori")
          if (raw.note && typeof raw.note === 'object') {
            (base as Record<string, unknown>).note = raw.note as unknown;
          }

          // Merge user-defined properties last so mapped keys (e.g., title, start, due, etc.) are accessible
          const result = Object.assign({}, base, item.properties ?? {});
          return result;
        });

        // Load and validate obsidianGantt config from the Bases view
        const cfgRes = getObsGanttConfig();
        if (!cfgRes.ok) {
          renderError(cfgRes.reason, cfgRes.missing);
          return;
        }
        const config = cfgRes.cfg;

        // Map to Gantt format
        const { tasks, links, warnings } = mapItemsToGantt(items, config);

        if (warnings.length > 0) {
          console.warn('obsidian-gantt: mapping warnings:', warnings);
        }

        // Initialize GanttService if needed
        if (!ganttService) {
          const ganttGlobal = (window as unknown as { gantt?: unknown }).gantt;
          if (!ganttGlobal) {
            throw new Error('DHTMLX Gantt not loaded');
          }
          ganttService = new GanttService(ganttGlobal as GanttLike);
        }

        // Render the Gantt
        ganttService.render(rootEl, tasks, links);

        console.log(`obsidian-gantt: rendered ${tasks.length} tasks, ${links.length} links`);
      } catch (error) {
        console.error('obsidian-gantt: error rendering Gantt:', error);

        // Show error in UI
        rootEl.innerHTML = `
          <div style="padding: 20px; color: #d73a49; background: #ffeaea; border-radius: 4px; margin: 10px;">
            <strong>Error loading Gantt view:</strong><br>
            ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
        `;
      }
    };

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
        // Render Gantt with real data
        await renderGantt();
      },
      refresh() {
        // Re-render with updated data
        void renderGantt();
      },
      onDataUpdated() {
        // Re-render when data changes
        void renderGantt();
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

