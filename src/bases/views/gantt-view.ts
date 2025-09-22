import type { Plugin, TFile } from 'obsidian';
import { parseYaml, stringifyYaml } from 'obsidian';
import type { BasesContainerLike } from '../types';
import { loadLocalDhtmlx } from '../../gantt/dhtmlx-adapter';
import { GanttService, type GanttLike } from '../../gantt/gantt-service';
import { mapItemsToGantt, type GanttConfig } from '../../mapping/mapping-service';
import { resolveColumnLayoutFromBases } from '../../gantt/columns/column-config-resolver';
import { BasesSettingsUpdater } from '../index';
import type { YAMLCodec } from '../settings/parser/yaml';
import { findBaseFence } from '../settings/parser/fenceLocator';



type BasesDataItem = {
  key: unknown;
  data: unknown;
  file?: unknown;
  path?: string;
  properties?: Record<string, unknown>;
  basesData: unknown;
};
type BasesViewLike = { type?: string; name?: string; data?: Record<string, unknown>; obsidianGantt?: unknown };


  // Shared across instances created from this factory: track per-instance identity and per-file fence usage
  const instanceRegistry = new Map<string, { file: TFile; fenceIndex?: number; viewIndex?: number; isBaseFile: boolean }>();
  const fileFenceState = new Map<string, { usedFenceIndices: Set<number> }>();

/** Factory to create the Bases custom Gantt view (obsidian-gantt). */
export function buildGanttViewFactory(plugin: Plugin) {
  return function createView(basesContainer: BasesContainerLike) {
    let rootEl: HTMLElement | null = null;
    let ephemeral: { scrollTop?: number } = {};
    let basesChangeHandler: (() => void) | null = null;

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
        return JSON.stringify(
          obj,
          (_k, v) => (typeof v === 'function' ? `[Function:${(v as { name?: string }).name || 'anon'}]` : v),
          2
        )?.slice(0, 4000) ?? '';
      } catch {
        return String(obj);
      }
    };

    // Persist column sizes into Bases YAML using standard `columnSize`
    const persistColumnSizes = async (sizes: Record<string, number>) => {
      type LooseObj = Record<string, unknown>;
      const get = <T = unknown>(obj: unknown, key: string): T | undefined => (obj && typeof obj === 'object') ? (obj as LooseObj)[key] as T : undefined;
      const call = (target: unknown, fnName: string, ...args: unknown[]): unknown => {
        const t = target as LooseObj | undefined;
        const fn = t?.[fnName] as ((...a: unknown[]) => unknown) | undefined;
        if (typeof fn === 'function') {
          try { return fn.apply(target as unknown, args); } catch { /* noop */ }
        }
        return undefined;
      };

      try {
        const controller = get<LooseObj>(basesContainer, 'controller');
        const query = get<LooseObj>(basesContainer, 'query');
        let wrote = false;

        // 1) Preferred: internal Bases APIs if available
        const trySetViewConfig = (t?: LooseObj): boolean => {
          if (!t) return false;
          const fn = (t as LooseObj)['setViewConfig'] as ((...a: unknown[]) => unknown) | undefined;
          if (typeof fn === 'function') {
            try { fn.call(t as unknown, 'columnSize', sizes); return true; } catch { /* try alt shape */ }
            try { fn.call(t as unknown, { columnSize: sizes }); return true; } catch { /* noop */ }
          }
          return false;
        };
        wrote = trySetViewConfig(controller) || trySetViewConfig(query);

        // 2) Use BasesSettingsUpdater utilities to write to .base files or code blocks
        if (!wrote) {


	          const app = plugin.app;
	          // Build YAML codec using Obsidian's YAML helpers (static import for runtime compatibility)
	          const yamlCodec: YAMLCodec = { parse: <T>(t: string) => parseYaml(t) as T, stringify: (o: unknown) => stringifyYaml(o) };
	          const updater = new BasesSettingsUpdater(app.vault, yamlCodec);

	          // Prefer per-instance mapping derived from DOM id to avoid YAML ids entirely
	          const instanceId = rootEl?.dataset?.oganttInstanceId;
	          const reg = instanceId ? instanceRegistry.get(instanceId) : undefined;
	          if (reg) {
	            try {
	              if (reg.isBaseFile) {
	                await updater.updateBaseFile({ file: reg.file, view: reg.viewIndex, columnSize: sizes });
	              } else {
	                await updater.updateBaseCodeBlock({ file: reg.file, fence: reg.fenceIndex ?? 0, view: reg.viewIndex, columnSize: sizes });
	              }
	              wrote = true;
	            } catch (e) {
	              console.debug('obsidian-gantt: instance-mapped write failed, will fall back', e);
	            }
	          }

	          // Secondary fallback: mapping stored on the Bases container (per-view instance)
	          if (!wrote) {
	            try {
	              const m = (basesContainer as unknown as { __oganttMapping?: { file: TFile; fenceIndex?: number; viewIndex?: number; isBaseFile: boolean } }).__oganttMapping;
	              if (m) {
	                if (m.isBaseFile) {
	                  await updater.updateBaseFile({ file: m.file, view: m.viewIndex, columnSize: sizes });
	                } else {
	                  await updater.updateBaseCodeBlock({ file: m.file, fence: m.fenceIndex ?? 0, view: m.viewIndex, columnSize: sizes });
	                }
	                wrote = true;
	              }
	            } catch { /* noop */ }
	          }


          const pathOf = (o: unknown, path: string): string | undefined => {
            const parts = path.split('.');
            let cur: unknown = o;
            for (const p of parts) {
              if (!cur || typeof cur !== 'object') return undefined;
              cur = (cur as LooseObj)[p];
            }
            return typeof cur === 'string' ? cur : undefined;
          };

          const filePath =
            pathOf(basesContainer, 'controller.file.path')
            || pathOf(basesContainer, 'query.file.path')
            || (() => { try { const f = app.workspace.getActiveFile?.(); return f?.path; } catch { return undefined; } })();

          if (filePath) {
            const abs = app.vault.getAbstractFileByPath(filePath);
            if (abs && 'stat' in abs) {
              const file = abs as TFile;
              const isBaseFile = file.path.toLowerCase().endsWith('.base');

              // Determine view selector robustly (prefer concrete index over name)
              const qObj = get<LooseObj>(basesContainer, 'query');
              const viewsArr = Array.isArray(qObj?.['views']) ? (qObj!['views'] as unknown as LooseObj[]) : [];
              const currentViewName = get<string>(basesContainer, 'viewName');
              let viewSel: string | number | undefined = undefined;
              if (viewsArr.length) {
                let idx = viewsArr.findIndex(v => {
                  const t = (v?.['type'] ?? v?.['viewType']) as string | undefined;
                  const name = v?.['name'] as string | undefined;
                  return (t === 'obsidianGantt' || t === 'obsidian-gantt') && (!currentViewName || name === currentViewName);
                });
                if (idx === -1) idx = viewsArr.findIndex(v => ((v?.['type'] ?? v?.['viewType']) === 'obsidianGantt' || (v?.['type'] ?? v?.['viewType']) === 'obsidian-gantt'));
                if (idx >= 0) viewSel = idx; else viewSel = undefined;
              }

              try {
                if (isBaseFile) {
                  await updater.updateBaseFile({ file, view: viewSel, columnSize: sizes });
                  wrote = true;
                } else {
                  // Try code block update with id if available; do NOT write or assume ids
                  const getViewConfig = qObj && typeof qObj['getViewConfig'] === 'function' ? (qObj['getViewConfig'] as (k?: string) => unknown) : undefined;
                  const fenceId = (() => {
                    try { return (getViewConfig ? (getViewConfig.call(qObj as unknown, 'id') as string | undefined) : undefined) || (qObj?.['id'] as string | undefined); } catch { return undefined; }
                  })();

                  if (typeof fenceId === 'string' && fenceId.trim()) {
                    await updater.updateBaseCodeBlock({ file, fence: { id: fenceId }, view: viewSel, columnSize: sizes });
                    wrote = true;
                  } else {
                    console.debug('obsidian-gantt: skip persisting columnSize for code block without id (no DOM mapping)');
                  }
                }
              } catch (err) {
                console.debug('obsidian-gantt: BasesSettingsUpdater write failed', err);
              }
            }
          }
        }

        if (wrote) {
          try { call(controller, 'runQuery'); } catch { /* optional refresh */ }
        } else {
          console.debug('obsidian-gantt: no supported API to persist columnSize; write skipped');
        }
      } catch (e) {
        console.warn('obsidian-gantt: failed to persist columnSize', e);
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

      const og = (
        selectedView?.obsidianGantt
        ?? selectedView?.data?.obsidianGantt
        ?? (selectedView?.data && selectedView?.data.fieldMappings ? selectedView.data : undefined)
        ?? ogFromQuery
        ?? ogFromControllerKey
        ?? ogFromControllerObj?.['obsidianGantt']
        ?? {}
      ) as Record<string, unknown>;
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

    // Extract optional table width from obsidianGantt.tableWidth in the selected Bases view
    const getTableWidthFromBases = (): number | undefined => {
      try {
        const bc = basesContainer as unknown as Record<string, unknown>;
        const q = asRecord(bc['query']);
        const c = asRecord(bc['controller']);
        const views = Array.isArray(q?.views) ? (q?.views as unknown as Array<Record<string, unknown>>) : undefined;
        const viewName = typeof bc['viewName'] === 'string' ? (bc['viewName'] as string) : undefined;
        let selected: Record<string, unknown> | undefined;
        if (views?.length) {
          selected = views.find(v => ((v.type === 'obsidianGantt' || v.type === 'obsidian-gantt') && (!viewName || v.name === viewName)))
                  || views.find(v => (v.type === 'obsidianGantt' || v.type === 'obsidian-gantt'))
                  || views.find(v => (v.viewType === 'obsidianGantt' || v.viewType === 'obsidian-gantt'));
        }
        const og = (
          (selected?.['obsidianGantt'] as Record<string, unknown> | undefined)
          ?? (asRecord(selected?.['data'])?.['obsidianGantt'] as Record<string, unknown> | undefined)
          ?? (q && typeof q['getViewConfig'] === 'function' ? (q['getViewConfig'] as (k: string) => unknown)('obsidianGantt') as Record<string, unknown> : undefined)
          ?? (c && typeof c['getViewConfig'] === 'function' ? (c['getViewConfig'] as (k?: string) => unknown)('obsidianGantt') as Record<string, unknown> : undefined)
          ?? (asRecord((c?.['getViewConfig'] as ((...a: unknown[]) => unknown) | undefined)?.())?.['obsidianGantt'] as Record<string, unknown> | undefined)
          ?? {} as Record<string, unknown>
        );
        const tw = (og['tableWidth'] as unknown) ?? (selected?.['tableWidth'] as unknown) ?? (asRecord(selected?.['data'])?.['tableWidth'] as unknown);
        const n = Number(tw);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
      } catch { return undefined; }
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

        // Build id -> props map for property column templates
        const getByPath = (obj: unknown, path: string): unknown => {
          if (!obj || !path) return undefined;
          const parts = path.split('.');
          let cur: unknown = obj;
          for (const p of parts) {
            if (cur == null || typeof cur !== 'object') return undefined;
            cur = (cur as Record<string, unknown>)[p];
          }
          return cur;
        };
        const idToProps = new Map<string | number, Record<string, unknown>>();
        const idPath = config.fieldMappings.id as string;
        for (const it of items) {
          const idVal = getByPath(it, idPath) as string | number | undefined;
          if (idVal != null) idToProps.set(idVal, it as Record<string, unknown>);
        }

        // Resolve column layout from Bases current configuration
        const columnLayout = resolveColumnLayoutFromBases(basesContainer);


        // Initialize GanttService if needed
        if (!ganttService) {
          const ganttGlobal = (window as unknown as { gantt?: unknown }).gantt;
          if (!ganttGlobal) {
            throw new Error('DHTMLX Gantt not loaded');
          }
          ganttService = new GanttService(ganttGlobal as GanttLike);
        }

        // Render the Gantt with column layout and props map
        const tableWidth = getTableWidthFromBases();
        ganttService.render(rootEl, tasks, links, { columns: columnLayout, idToProps, onColumnSizesChanged: persistColumnSizes, gridWidth: tableWidth });

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
        // Subscribe to Bases property/config changes for real-time updates
        const qRec = asRecord((basesContainer as unknown as Record<string, unknown>)['query']);
        if (qRec && typeof qRec['on'] === 'function' && !basesChangeHandler) {
          basesChangeHandler = () => { void renderGantt(); };
          try { (qRec['on'] as (ev: string, cb: () => void) => unknown)('change', basesChangeHandler); } catch { /* noop */ }
        }

        const host: HTMLElement = (basesContainer?.viewContainerEl ?? basesContainer?.containerEl ?? document.body) as HTMLElement;
        // Create or reuse a per-view root element stored on the basesContainer (avoid cross-view sharing)
        const bcWithRoot = basesContainer as unknown as { __oganttRootEl?: HTMLElement };
        if (bcWithRoot.__oganttRootEl && bcWithRoot.__oganttRootEl.isConnected) {
          rootEl = bcWithRoot.__oganttRootEl;
        } else {
          const hostWithCreateDiv = host as unknown as { createDiv?: (opts: { cls?: string }) => HTMLElement };
          if (typeof hostWithCreateDiv.createDiv === 'function') {
            rootEl = hostWithCreateDiv.createDiv({ cls: 'ogantt-root' });
          } else {
            const div = document.createElement('div');
            div.className = 'ogantt-root';
            rootEl = host.appendChild(div);
          }
          bcWithRoot.__oganttRootEl = rootEl;
        }
        // Assign a unique per-instance id on the root container and register mapping
        if (rootEl) {
          const iid = `og-` + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? (crypto as unknown as { randomUUID: () => string }).randomUUID() : Math.random().toString(36).slice(2, 10));
          rootEl.dataset.oganttInstanceId = iid;

          // Resolve file and selectors for persistence without writing YAML ids
          const pathOf = (o: unknown, path: string): string | undefined => {
            const parts = path.split('.');
            let cur: unknown = o;
            for (const p of parts) {
              if (!cur || typeof cur !== 'object') return undefined;
              cur = (cur as Record<string, unknown>)[p];
            }
            return typeof cur === 'string' ? cur : undefined;
          };

          const app = plugin.app;
          const filePath = pathOf(basesContainer, 'controller.file.path')
            || pathOf(basesContainer, 'query.file.path')
            || (() => { try { const f = app.workspace.getActiveFile?.(); return f?.path; } catch { return undefined; } })();

          if (filePath) {
            const abs = app.vault.getAbstractFileByPath(filePath);
            if (abs && 'stat' in abs) {
              const file = abs as TFile;
              const isBaseFile = file.path.toLowerCase().endsWith('.base');

              // Determine view index against query.views
              const qObj = (basesContainer as unknown as Record<string, unknown>)['query'] as Record<string, unknown> | undefined;
              const viewsArr = Array.isArray(qObj?.['views']) ? (qObj!['views'] as unknown as Array<Record<string, unknown>>) : [];
              const currentViewName = (basesContainer as unknown as Record<string, unknown>)['viewName'] as string | undefined;
              let viewIndex: number | undefined = undefined;
              if (viewsArr.length) {
                let idx = viewsArr.findIndex(v => {
                  const t = (v?.['type'] ?? v?.['viewType']) as string | undefined;
                  const name = v?.['name'] as string | undefined;
                  return (t === 'obsidianGantt' || t === 'obsidian-gantt') && (!currentViewName || name === currentViewName);
                });
                if (idx === -1) idx = viewsArr.findIndex(v => ((v?.['type'] ?? v?.['viewType']) === 'obsidianGantt' || (v?.['type'] ?? v?.['viewType']) === 'obsidian-gantt'));
                if (idx >= 0) viewIndex = idx;
              }

              let fenceIndex: number | undefined = undefined;
              if (!isBaseFile) {
                const state = fileFenceState.get(file.path) ?? { usedFenceIndices: new Set<number>() };
                fileFenceState.set(file.path, state);
                try {
                  const content = await app.vault.read(file);
                  const candidateIndices: number[] = [];
                  for (let i = 0; ; i++) {
                    const f = findBaseFence(content, i);
                    if (!f) break;
                    candidateIndices.push(i);
                  }
                  fenceIndex = candidateIndices.find(i => !state.usedFenceIndices.has(i));
                  if (typeof fenceIndex !== 'number') fenceIndex = 0;
                  state.usedFenceIndices.add(fenceIndex);
                } catch { /* ignore - best effort */ }
              }

              const mapping = { file, isBaseFile, fenceIndex, viewIndex } as { file: TFile; fenceIndex?: number; viewIndex?: number; isBaseFile: boolean };
              instanceRegistry.set(iid, mapping);
              // Store mapping on the Bases container too, so we can recover even if registry entry is lost
              try { (basesContainer as unknown as { __oganttMapping?: typeof mapping }).__oganttMapping = mapping; } catch { /* noop */ }
            }
          }

          // Trigger a post-mount paint to avoid blank containers
          requestAnimationFrame(() => { rootEl && (rootEl.style.opacity = '1'); });
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
        // Unsubscribe from Bases changes
        try {
          const qRec = asRecord((basesContainer as unknown as Record<string, unknown>)['query']);
          if (basesChangeHandler && typeof qRec?.['off'] === 'function') {
            (qRec['off'] as (ev: string, cb: () => void) => unknown)('change', basesChangeHandler);
          }
        } catch { /* noop */ }
        basesChangeHandler = null;

          }
          // Cleanup instance registry and release fence index if used
          {
            const iid = rootEl.dataset?.oganttInstanceId;
            if (iid) {
              const reg = instanceRegistry.get(iid);
              if (reg && !reg.isBaseFile && typeof reg.fenceIndex === 'number') {
                const st = fileFenceState.get(reg.file.path);
                st?.usedFenceIndices.delete(reg.fenceIndex);
              }
              instanceRegistry.delete(iid);
            }
            try { (basesContainer as unknown as { __oganttRootEl?: HTMLElement; __oganttMapping?: unknown }).__oganttRootEl = undefined; } catch { /* noop */ }
            try { (basesContainer as unknown as { __oganttRootEl?: HTMLElement; __oganttMapping?: unknown }).__oganttMapping = undefined; } catch { /* noop */ }
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

