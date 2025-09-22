import type { SVARTask } from '../data-sources/DataSourceAdapter';

// Create virtual duplicates for tasks that have multiple parents while preserving original noteId
export function expandVirtualMultiParents(tasks: SVARTask[]): SVARTask[] {
  const out: SVARTask[] = [];
  for (const t of tasks) {
    const multi: unknown = (t as any).__multiParents;
    if (Array.isArray(multi) && multi.length > 1) {
      // First parent: use original task with first parent
      const [first, ...rest] = multi;
      out.push({ ...t, parent: first });
      // Other parents: push virtual copies with unique ids but same noteId
      rest.forEach((p, idx) => {
        out.push({
          ...t,
          id: `${t.id}::v${idx + 1}`,
          parent: p,
        });
      });
    } else if (Array.isArray(multi) && multi.length === 1) {
      out.push({ ...t, parent: multi[0] });
    } else {
      out.push(t);
    }
  }
  return out;
}

