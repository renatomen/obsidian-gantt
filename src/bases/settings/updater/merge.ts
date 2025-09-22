import type { BasesView, ColumnSizePatch } from '../model/types';

export function mergeColumnSize(target: BasesView, patch?: ColumnSizePatch): void {
  if (!patch) return;
  const next: Record<string, number> = { ...(target.columnSize ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) continue; // validate numeric positive
    next[k] = Math.round(n);
  }
  target.columnSize = next;
}

