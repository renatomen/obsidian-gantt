import type { ColumnLayout, ColumnSpec } from './column-types';
import type { BasesContainer } from '@bases/api';

function humanize(id: string): string {
  const last = id.includes('.') ? id.split('.').pop()! : id;
  return last
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Build an index from Bases query.properties to normalize ids and get display names. */
function buildPropertyIndex(query: unknown): Map<string, string> {
  const map: Map<string, string> = new Map();
  const props = (query as Record<string, unknown> | undefined)?.properties as Record<string, unknown> | undefined;
  if (props && typeof props === 'object') {
    for (const id of Object.keys(props)) {
      map.set(id, id);
      const last = id.includes('.') ? id.split('.').pop()! : id;
      map.set(last, id);
      const val = props[id] as { getDisplayName?: () => string } | unknown;
      const dn = (val && typeof (val as { getDisplayName?: unknown }).getDisplayName === 'function')
        ? (val as { getDisplayName: () => string }).getDisplayName()
        : undefined;
      if (typeof dn === 'string' && dn.trim()) map.set(dn.toLowerCase(), id);
    }
  }
  return map;
}

function normalizeToId(token: string | undefined, index: Map<string, string>): string | undefined {
  if (!token) return undefined;
  return index.get(token) || index.get(token.toLowerCase()) || token;
}

function getViewConfig(controller: unknown, query: unknown): Record<string, unknown> {
  // Start with whatever the controller exposes
  const base = (controller && typeof (controller as { getViewConfig?: () => unknown }).getViewConfig === 'function')
    ? (controller as { getViewConfig: () => unknown }).getViewConfig()
    : {};
  let fullCfg: Record<string, unknown> = (base && typeof base === 'object') ? { ...(base as Record<string, unknown>) } : {};

  // If the Bases query carries a views[] array (common in embedded/codeblock mode),
  // merge the selected Gantt view's root properties and its data object onto fullCfg.
  try {
    const qRec = query as Record<string, unknown> | undefined;
    const views = Array.isArray(qRec?.views) ? (qRec!.views as Array<Record<string, unknown>>) : undefined;
    if (views && views.length) {
      const selected = views.find((v) => (v?.type === 'obsidianGantt' || v?.type === 'obsidian-gantt'))
        ?? views.find((v) => (v?.viewType === 'obsidianGantt' || v?.viewType === 'obsidian-gantt'));
      if (selected && typeof selected === 'object') {
        const data = (selected.data && typeof selected.data === 'object') ? (selected.data as Record<string, unknown>) : {};
        fullCfg = { ...selected, ...data, ...fullCfg };
      }
    }
  } catch {
    // ignore
  }

  return fullCfg;
}

function getOrder(_controller: unknown, query: unknown, fullCfg: Record<string, unknown>, index: Map<string, string>): string[] | undefined {
  let orderUnknown: unknown;
  try {
    const getViewConfig = (query && typeof (query as { getViewConfig?: (k: string) => unknown }).getViewConfig === 'function')
      ? (query as { getViewConfig: (k: string) => unknown }).getViewConfig
      : undefined;
    orderUnknown = getViewConfig ? getViewConfig.call(query as unknown, 'order') : undefined;
  } catch {
    // ignore
  }
  const colsObj = (fullCfg['columns'] && typeof fullCfg['columns'] === 'object') ? (fullCfg['columns'] as Record<string, unknown>) : undefined;
  const fallbackOrder = (fullCfg['order'] as unknown) ?? (colsObj?.['order'] as unknown);
  const order = (Array.isArray(orderUnknown) ? orderUnknown : Array.isArray(fallbackOrder) ? fallbackOrder : undefined) as string[] | undefined;
  if (!Array.isArray(order) || order.length === 0) return undefined;
  return order.map((t) => normalizeToId(t, index)).filter((v): v is string => !!v);
}

function getColumnWidths(_controller: unknown, query: unknown, fullCfg: Record<string, unknown>): Record<string, number> | undefined {
  // Prefer standard Bases key: columnSize
  try {
    const getViewConfig = (query && typeof (query as { getViewConfig?: (k: string) => unknown }).getViewConfig === 'function')
      ? (query as { getViewConfig: (k: string) => unknown }).getViewConfig
      : undefined;
    const fromQuery = getViewConfig ? getViewConfig.call(query as unknown, 'columnSize') : undefined;
    if (fromQuery && typeof fromQuery === 'object') return fromQuery as Record<string, number>;
  } catch {/* noop */}
  // Check merged fullCfg (which includes selectedView root and data)
  const widths = fullCfg?.['columnSize'] as Record<string, number> | undefined;
  if (widths && typeof widths === 'object') return widths;
  const data = (fullCfg['data'] && typeof fullCfg['data'] === 'object') ? (fullCfg['data'] as Record<string, unknown>) : undefined;
  const dataWidths = data?.['columnSize'] as Record<string, number> | undefined;
  if (dataWidths && typeof dataWidths === 'object') return dataWidths;
  // Legacy/alternate fallback: obsidianGantt.columnWidths (non-standard)
  const og = fullCfg?.['obsidianGantt'] as Record<string, unknown> | undefined;
  const legacy = og?.['columnWidths'] as Record<string, number> | undefined;
  return legacy;
}

/** Default columns when Bases provides no order: Task Name, Start, Duration. */
function defaultLayout(): ColumnLayout {
  const columns: ColumnSpec[] = [
    { kind: 'builtin', id: 'builtin:text', label: 'Task Name', builtinKey: 'text', width: 220 },
    { kind: 'builtin', id: 'builtin:start_date', label: 'Start', builtinKey: 'start_date', width: 140 },
    { kind: 'builtin', id: 'builtin:duration', label: 'Duration', builtinKey: 'duration', width: 120 },
  ];
  return { columns };
}

function normalizeWidthKeys(widths: Record<string, number>, index: Map<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(widths)) {
    const v = widths[k] as number;
    const nn = normalizeToId(k, index)
      || normalizeToId(k.replace(/^note\./, ''), index)
      || k;
    out[nn] = v;
  }
  return out;
}

export function resolveColumnLayoutFromBases(basesContainer: BasesContainer): ColumnLayout {
  const bc = basesContainer as unknown as Record<string, unknown>;
  const controller = (bc['controller'] as unknown) ?? basesContainer;
  const query = (bc['query'] as unknown) ?? (controller as Record<string, unknown> | undefined)?.['query'];
  if (!controller) return defaultLayout();

  const index = buildPropertyIndex(query);
  const fullCfg = getViewConfig(controller, query);
  const order = getOrder(controller, query, fullCfg, index);
  const rawWidths = getColumnWidths(controller, query, fullCfg) ?? {};
  const widths = normalizeWidthKeys(rawWidths, index);
  const props = (query as Record<string, unknown> | undefined)?.['properties'] as Record<string, unknown> | undefined;

  if (!order || order.length === 0) return defaultLayout();

  const columns: ColumnSpec[] = order.map((id) => {
    const val = props && props[id];
    const label = (val && typeof (val as { getDisplayName?: unknown }).getDisplayName === 'function')
      ? (val as { getDisplayName: () => string }).getDisplayName()
      : humanize(id);
    const width = widths?.[id];
    return {
      kind: 'property',
      id,
      label,
      width: typeof width === 'number' ? width : undefined,
      propertyKey: id,
    } satisfies ColumnSpec;
  });

  return { columns };
}

