export type { GanttTask, GanttLink } from '@mapping/mapping-service';
import type { ColumnLayout, ColumnSpec } from '@gantt/columns/column-types';
import { enableCustomGridColumnResize } from '@gantt/columns/grid-column-resizer';

export type GanttLike = {
  init?: (el: HTMLElement) => void;
  parse?: (payload: { data: Array<Record<string, unknown>>; links?: Array<Record<string, unknown>> }) => void;
  config?: Record<string, unknown>;
  render?: () => void; // optional, not all bundles expose it
};

export type RenderOptions = {
  columns?: ColumnLayout;
  idToProps?: Map<string | number, Record<string, unknown>>;
  onColumnSizesChanged?: (sizes: Record<string, number>) => void;
  gridWidth?: number; // desired grid (table) width in px; enables independent horizontal scroll when set
};

function getByPath(obj: unknown, path: string): unknown {
  if (!obj || !path || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

type DhtmlxCol = { name: string; label?: string; width?: number; tree?: boolean; template?: (task: Record<string, unknown>) => string };

function mapToDhtmlxColumns(layout: ColumnLayout | undefined, idToProps?: Map<string | number, Record<string, unknown>>): DhtmlxCol[] | undefined {
  if (!layout) return undefined;

  const toTemplate = (spec: ColumnSpec) => {
    if (spec.kind === 'builtin') {
      const key = spec.builtinKey!;
      return (task: Record<string, unknown>) => {
        const v = (task as Record<string, unknown>)[key as string] as unknown;
        return v == null ? '' : String(v);
      };
    }
    // property column
    const propKey = spec.propertyKey!;
    return (task: Record<string, unknown>) => {
      const idVal = (task as Record<string, unknown>)['id'] as string | number | undefined;
      const props = idVal != null ? idToProps?.get(idVal) : undefined;
      const v = getByPath(props ?? {}, propKey);
      return v == null ? '' : String(v);
    };
  };

  return layout.columns.map((c, idx) => ({
    name: c.id,
    label: c.label,
    width: c.width,
    tree: idx === 0 && (c.kind === 'builtin' && c.builtinKey === 'text'),
    template: toTemplate(c),
  }));
}

/** Thin facade over the DHTMLX gantt global for DI and testability. */
export class GanttService {
  private readonly gantt: GanttLike;

  constructor(gantt: GanttLike) {
    this.gantt = gantt;
  }

  /** Ensure a child container with the class expected by DHTMLX exists. */
  private ensureInnerContainer(containerEl: HTMLElement): HTMLElement {
    const el = (containerEl.querySelector('.gantt_container') as HTMLElement | null)
      ?? containerEl.appendChild(Object.assign(document.createElement('div'), { className: 'gantt_container' }));
    el.style.height = '100%';
    return el;
  }

  /** Render tasks into the provided container. Links are optional and can be omitted for now. */
  render(
    containerEl: HTMLElement,
    tasks: Array<Record<string, unknown>>,
    links: Array<Record<string, unknown>> = [],
    options?: RenderOptions,
  ): void {
    const inner = this.ensureInnerContainer(containerEl);

    // Ensure DHTMLX uses the same date format we emit (YYYY-MM-DD)
    if (this.gantt.config) {
      // Common DHTMLX settings for parsing dates from JSON payload
      // Some versions use `date_format`, others use `xml_date` during parse
      (this.gantt.config as Record<string, unknown>)['date_format'] = '%Y-%m-%d';
      (this.gantt.config as Record<string, unknown>)['xml_date'] = '%Y-%m-%d';

      // Apply column config if provided
      const cols = mapToDhtmlxColumns(options?.columns, options?.idToProps);
      if (cols) {
        (this.gantt.config as Record<string, unknown>)['columns'] = cols as unknown as Array<Record<string, unknown>>;
      }

      // Apply independent grid layout when a grid width is provided
      const w = typeof options?.gridWidth === 'number' && isFinite(options.gridWidth) ? Math.max(1, Math.floor(options.gridWidth)) : undefined;
      if (w) {
        // prevent auto-fit so columns may exceed the grid width and overflow inside the scrollable grid
        (this.gantt.config as Record<string, unknown>)['autofit'] = false;
        // layout with separate scrollbars for grid and timeline
        (this.gantt.config as Record<string, unknown>)['layout'] = {
          css: 'gantt_container',
          cols: [
            {
              width: w,
              rows: [
                { view: 'grid', scrollX: 'gridScroll', scrollable: true, scrollY: 'scrollVer' },
                { view: 'scrollbar', id: 'gridScroll' }
              ]
            },
            { resizer: true, width: 1 },
            {
              rows: [
                { view: 'timeline', scrollX: 'scrollHor', scrollY: 'scrollVer' },
                { view: 'scrollbar', id: 'scrollHor' }
              ]
            },
            { view: 'scrollbar', id: 'scrollVer' }
          ]
        } as unknown as Record<string, unknown>;
      }
    }

    this.gantt.init?.(inner);

    // Hook column resize event if available (PRO) and callback provided
    const extractSizes = (): Record<string, number> => {
      try {
        const sizes: Record<string, number> = {};
        const cfg = this.gantt.config as Record<string, unknown> | undefined;
        const cols = (cfg?.['columns'] as Array<Record<string, unknown>> | undefined) ?? [];
        for (const c of cols) {
          const name = c?.['name'] as unknown;
          const width = c?.['width'] as unknown;
          if (typeof name === 'string' && typeof width === 'number') sizes[name] = width;
        }
        return sizes;
      } catch { return {}; }
    };
    const ganttEvents = this.gantt as unknown as { attachEvent?: (name: string, cb: (...args: unknown[]) => unknown) => unknown };
    if (typeof options?.onColumnSizesChanged === 'function' && typeof ganttEvents?.attachEvent === 'function') {
      try {
        ganttEvents.attachEvent('onColumnResizeEnd', ((...args: unknown[]) => {
          try {
            const col = args[1] as { name?: string } | unknown;
            const w = args[2] as number;
            const sizes = extractSizes();
            const name = (col && typeof col === 'object') ? (col as { name?: string }).name : undefined;
            if (name && typeof w === 'number') sizes[name] = w;
            options.onColumnSizesChanged!(sizes);
          } catch { /* noop */ }
          return true;
        }) as (...args: unknown[]) => unknown);
      } catch { /* ignore if event unsupported in free edition */ }
    }

    this.gantt.parse?.({ data: tasks, links });

    // Free edition fallback: attach custom header drag-resize handles
    if (typeof options?.onColumnSizesChanged === 'function') {
      try {
        const ganttLikeForResizer = this.gantt as unknown as {
          config?: { columns?: Array<{ name?: string; width?: number }> };
          render?: () => void;
          attachEvent?: (name: string, cb: (...args: unknown[]) => unknown) => string | null;
          detachEvent?: (id: string) => void;
        };
        enableCustomGridColumnResize(ganttLikeForResizer, inner, options.onColumnSizesChanged, { minWidth: 90 });
      } catch { /* noop */ }
    }
  }
}
