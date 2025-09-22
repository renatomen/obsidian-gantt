import type { FieldMappings } from './FieldMappings';
import type { SVARTask, GanttConfig } from '../data-sources/DataSourceAdapter';

function coerceDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  // moment.js or similar (obsidian exposes moment); dayjs/luxon have converters
  const anyV: any = v as any;
  try {
    if (anyV && typeof anyV.toDate === 'function') {
      const d = anyV.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : undefined;
    }
    if (anyV && typeof anyV.toJSDate === 'function') {
      const d = anyV.toJSDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : undefined;
    }
  } catch {}
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

export interface MapOptions {
  defaultDuration: number;
  missingStartBehavior: 'infer' | 'show' | 'hide';
  missingEndBehavior: 'infer' | 'show' | 'hide';
}

export function mapToSVARTasks(
  rawItems: any[],
  mapping: FieldMappings,
  config: Pick<GanttConfig, 'defaultDuration' | 'missingStartBehavior' | 'missingEndBehavior'>
): SVARTask[] {
  const opts: MapOptions = {
    defaultDuration: config.defaultDuration ?? 3,
    missingStartBehavior: config.missingStartBehavior ?? 'infer',
    missingEndBehavior: config.missingEndBehavior ?? 'infer',
  };

  const tasks: SVARTask[] = [];
  for (const item of rawItems) {
    const idVal = mapping.id ? (item?.[mapping.id]) : undefined;
    const textVal = mapping.text ? (item?.[mapping.text]) : undefined;

    const id = (idVal ?? item?.path ?? item?.file?.path ?? '').toString();
    const text = (textVal ?? item?.title ?? item?.file?.name ?? id).toString();

    let start = mapping.start ? coerceDate(item?.[mapping.start]) : undefined;
    let end = mapping.end ? coerceDate(item?.[mapping.end]) : undefined;
    let duration: number | undefined = undefined; // kept for future use but not applied now

    // Placeholder policy: never drop tasks. If one date is missing, mirror the provided one.
    // If both are missing, set both to today (00:00) so they render and can be edited by the user.
    if (!start && end) {
      start = end;
      (item as any).__missingDateStart = true;
    }

    if (!end && start) {
      end = start;
      (item as any).__missingDateEnd = true;
    }

    if (!start && !end) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      start = today;
      end = today;
      (item as any).__missingBothDates = true;
    }

    const parent = mapping.parent ? item?.[mapping.parent] : undefined;

    const t: SVARTask = {
      id,
      noteId: id, // preserve original note id for virtual duplicates
      text,
      start,
      end,
      duration: typeof item?.[mapping.duration!] === 'number' ? item[mapping.duration!] : undefined,
      progress: typeof item?.[mapping.progress!] === 'number' ? item[mapping.progress!] : undefined,
      parent: parent != null ? parent : undefined,
      type: (typeof item?.[mapping.type!] === 'string' ? item[mapping.type!] : undefined) as any,
    };

    // Attach multi-parents list for VirtualTaskManager to expand later
    const parentsKey = mapping.parents;
    if (parentsKey && Array.isArray(item?.[parentsKey])) {
      (t as any).__multiParents = item[parentsKey].slice();
    }

    tasks.push(t);
  }
  return tasks;
}

