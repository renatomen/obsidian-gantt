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

  const getVal = (it: Record<string, unknown>, key?: string): unknown => (key ? (it as Record<string, unknown>)[key] : undefined);

  const dateToIso = (d: Date): string => d.toISOString().slice(0, 10);
  const parseDate = (s: unknown): Date | undefined => {
    if (typeof s !== 'string' || !s) return undefined;
    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d;
  };
  const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

  for (const it of items ?? []) {
    const idSource = getVal(it, fm.id) ?? (it as Record<string, unknown>)['id'] ?? (it as Record<string, unknown>)['path'];
    const id = String(idSource ?? cryptoRandomId());
    const textSource = getVal(it, fm.text) ?? (it as Record<string, unknown>)['title'] ?? (it as Record<string, unknown>)['name'];
    const text = String(textSource ?? id);

    const startRaw = getVal(it, fm.start);
    const endRaw = getVal(it, fm.end);

    let startDate = parseDate(startRaw);
    let endDate = parseDate(endRaw);

    // Missing date behaviors
    if (!endDate && startDate && config.missingEndBehavior === 'infer') {
      endDate = addDays(startDate, config.defaultDuration);
    }
    if (!startDate && endDate && config.missingStartBehavior === 'infer') {
      startDate = addDays(endDate, -config.defaultDuration);
    }

    if (!startDate && !endDate) {
      if (config.showMissingDates) {
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

    // Parent mapping
    let parent: string | undefined = undefined;
    const parentVal = getVal(it, fm.parent);
    const parentsVal = getVal(it, fm.parents);
    if (typeof parentVal === 'string' && parentVal.trim()) {
      parent = parentVal;
    } else if (Array.isArray(parentsVal) && parentsVal.length > 0) {
      const first = (parentsVal as unknown[])[0];
      if (typeof first === 'string' && (first as string).trim()) parent = first as string;
    }

    const task: GanttTask = {
      id,
      text,
      start_date: startDate ? dateToIso(startDate) : undefined,
      end_date: endDate ? dateToIso(endDate) : undefined,
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

