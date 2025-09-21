import { parseInputToUTCDate, formatDateUTCToYMD, addDaysUTC } from '@utils/date-utils';

export type GanttTask = {
  id: string;
  text: string;
  start_date?: string;
  end_date?: string;
  duration?: number;
  progress?: number; // 0..1
  parent?: string;
  open?: boolean;
};

export type GanttLink = {
  id: string;
  source: string;
  target: string;
  type: '0' | '1' | '2' | '3'; // FS/SS/FF/SF (DHTMLX uses strings)
};

export type FieldMappings = Partial<{
  id: string;
  text: string;
  start: string;
  end: string;
  progress: string;
  tags: string;
  assignee: string;
  dependency: string;
  status: string;
  parent: string;
  parents: string;
}>;

export type GanttConfig = {
  viewMode: 'Day' | 'Week' | 'Month';
  show_today_marker: boolean;
  hide_task_names: boolean;
  showMissingDates: boolean;
  missingStartBehavior: 'infer' | 'show' | 'hide';
  missingEndBehavior: 'infer' | 'show' | 'hide';
  defaultDuration: number; // days
  showMissingDateIndicators: boolean;
  fieldMappings: FieldMappings;
};

export function mapItemsToGantt(items: Array<Record<string, unknown>>, config: GanttConfig): { tasks: GanttTask[]; links: GanttLink[]; warnings: string[] } {
  const warnings: string[] = [];
  const tasks: GanttTask[] = [];
  const links: GanttLink[] = [];

  const fm = config.fieldMappings ?? {};

  // Resolve simple keys and dotted paths like "file.path"
  const getVal = (it: Record<string, unknown>, key?: string): unknown => {
    if (!key) return undefined;
    if (key.indexOf('.') === -1) return (it as Record<string, unknown>)[key];
    let cur: unknown = it;
    for (const seg of key.split('.')) {
      if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg];
      } else {
        return undefined;
      }
    }
    return cur;
  };


  // Date utilities



  // Build indexes to resolve parent references reliably
  const idSet = new Set<string>();
  const nameToId = new Map<string, string>();
  for (const it of items ?? []) {
    const idSrc = getVal(it, fm.id);
    const sid = typeof idSrc === 'string' ? idSrc.trim() : (idSrc != null ? String(idSrc) : '');
    if (sid) {
      idSet.add(sid);
      const t = getVal(it, fm.text);
      if (typeof t === 'string' && t.trim()) nameToId.set(t.trim(), sid);
      const b = getVal(it, 'file.basename');
      if (typeof b === 'string' && b.trim()) nameToId.set(b.trim(), sid);
      const n = getVal(it, 'file.name');
      if (typeof n === 'string' && n.trim()) nameToId.set(n.trim(), sid);
    }
  }

  const resolveParent = (val: unknown): string | undefined => {
    if (val == null) return undefined;
    // Object with a path
    if (typeof val === 'object') {
      const anyVal = val as any;
      const p = anyVal?.path || anyVal?.file?.path || anyVal?.note?.path;
      if (typeof p === 'string' && idSet.has(p)) return p;
      return undefined;
    }
    if (typeof val === 'string') {
      let s = val.trim();
      // Wikilink [[target]] or [[target|alias]]
      const m = s.match(/^\[\[([^|\]]+)(?:\|[^\]]+)?\]\]$/);
      if (m) {
        const key = m[1].trim();
        if (idSet.has(key)) return key;
        const byName = nameToId.get(key) || nameToId.get(key.replace(/\.md$/i, ''));
        if (byName) return byName;
        return undefined;
      }
      // Direct path or name
      if (idSet.has(s)) return s;
      const byName2 = nameToId.get(s) || nameToId.get(s.replace(/\.md$/i, ''));
      if (byName2) return byName2;
    }
    return undefined;
  };

  for (const it of items ?? []) {
    // Required fields: id, text, start, end (by mapping keys). No implicit fallbacks to user property names.
    const idSource = getVal(it, fm.id);
    if (idSource == null || (typeof idSource === 'string' && idSource.trim().length === 0)) {
      warnings.push('Skipping item: missing required id value for mapped key');
      continue; // do not map without an id
    }
    const id = String(idSource);

    const textSource = getVal(it, fm.text);
    if (textSource == null || (typeof textSource === 'string' && textSource.trim().length === 0)) {
      warnings.push(`Skipping item ${id}: missing required text value for mapped key`);
      continue; // do not map without text
    }
    const text = String(textSource);

    const startRaw = getVal(it, fm.start);
    const endRaw = getVal(it, fm.end);

    let startDate = parseInputToUTCDate(startRaw);
    let endDate = parseInputToUTCDate(endRaw);

    // Missing date behaviors
    if (!endDate && startDate && config.missingEndBehavior === 'infer') {
      endDate = addDaysUTC(startDate, config.defaultDuration);
    }
    if (!startDate && endDate && config.missingStartBehavior === 'infer') {
      startDate = addDaysUTC(endDate, -config.defaultDuration);
    }

    // Handle case where both dates are missing
    if (!startDate && !endDate) {
      if (config.missingStartBehavior === 'infer' || config.missingEndBehavior === 'infer') {
        // Infer both dates starting from today
        const today = new Date();
        startDate = today;
        endDate = addDaysUTC(today, config.defaultDuration);

      } else if (config.showMissingDates) {
        warnings.push(`Task ${id} missing both start and end`);
      }
    }

    // Progress normalization
    const pRaw = getVal(it, fm.progress);
    let progress: number | undefined = undefined;
    if (typeof pRaw === 'number') {
      progress = pRaw > 1 ? pRaw / 100 : pRaw;
      progress = Math.max(0, Math.min(1, progress));
    }

    // Parent mapping - resolve to a valid id in this dataset, otherwise leave undefined
    let parent: string | undefined = undefined;
    const parentVal = getVal(it, fm.parent);
    const parentsVal = getVal(it, fm.parents);

    // Prefer explicit parent; otherwise first from parents list
    let candidate: string | undefined = resolveParent(parentVal);
    if (!candidate && Array.isArray(parentsVal) && parentsVal.length > 0) {
      candidate = resolveParent((parentsVal as unknown[])[0]);
    }

    // Only assign if it points to an existing id and is not self
    if (candidate && candidate !== id && idSet.has(candidate)) {
      parent = candidate;
    }

    const task: GanttTask = {
      id,
      text,
      start_date: startDate ? formatDateUTCToYMD(startDate) : undefined,
      end_date: endDate ? formatDateUTCToYMD(endDate) : undefined,
      progress,
      parent,
      open: true,
    };
    tasks.push(task);

    // Dependencies intentionally omitted for now per requirements; links remain empty
  }

  return { tasks, links, warnings };
}

// Tiny random ID fallback to avoid dragging larger deps just for tests
function cryptoRandomId(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') return g.crypto.randomUUID!();
  return `id_${Math.random().toString(36).slice(2, 10)}`;
}

