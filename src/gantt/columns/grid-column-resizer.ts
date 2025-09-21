/*
 * Custom grid column drag-resize for DHTMLX Gantt (free/GPL edition)
 *
 * Design goals:
 * - Depend only on public lifecycle events and documented CSS/data-attributes
 * - Re-attach after each render (onGanttReady/onGanttRender)
 * - Encapsulate DOM assumptions behind a small adapter surface
 * - Graceful no-op if structure differs in future versions
 */

export type CommitFn = (sizes: Record<string, number>) => void;

export type Disposable = { dispose: () => void };

export type ResizeOptions = {
  minWidth?: number;
  handleWidth?: number;
  handleClass?: string;
};

const DEFAULTS = {
  HANDLE_CLASS: 'ogantt-col-resize-handle',
  HANDLE_WIDTH: 6,
  MIN_WIDTH: 90,
};

const SELECTORS = {
  head: '.gantt_grid_scale',
  headCell: '.gantt_grid_head_cell',
};


type DhtmlxColumn = { name?: string; width?: number };
interface DhtmlxLike { config?: { columns?: DhtmlxColumn[] }; render?: () => void; attachEvent?: (name: string, cb: (...args: unknown[]) => unknown) => string | null; detachEvent?: (id: string) => void }

/** Read column name from header cell, with index fallback. */
function findColumnName(cell: HTMLElement, idx: number, columns: DhtmlxColumn[] | undefined): string | null {
  const byId = cell.getAttribute('data-column-id');
  if (byId) return byId;
  const byName = cell.getAttribute('data-column-name');
  if (byName) return byName;
  const byIdx = columns && columns[idx] && typeof columns[idx].name === 'string' ? columns[idx].name : null;
  return byIdx ?? null;
}

/** Build width map from gantt.config.columns. */
function extractSizes(columns: DhtmlxColumn[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of columns ?? []) {
    if (c && typeof c.name === 'string' && typeof c.width === 'number') {
      out[c.name] = c.width;
    }
  }
  return out;
}

function px(n: number): string { return `${Math.round(n)}px`; }

/** Attach handle for a single header cell. Returns function to remove it. */
function installHandle(
  gantt: DhtmlxLike,
  headCell: HTMLElement,
  colName: string,
  columnsRef: () => DhtmlxColumn[] | undefined,
  onCommit: CommitFn,
  minWidth: number,
  handleWidth: number,
  handleClass: string,
): () => void {
  headCell.style.position = headCell.style.position || 'relative';

  const handle = document.createElement('div');
  handle.className = handleClass;
  Object.assign(handle.style, {
    position: 'absolute',
    top: '0',
    right: '0',
    width: `${handleWidth}px`,
    height: '100%',
    cursor: 'col-resize',
    zIndex: '2',
  } as CSSStyleDeclaration);
  headCell.appendChild(handle);

  let startX = 0;
  let startW = 0;
  let raf = 0;
  let liveW = 0;

  const onMouseMove = (e: MouseEvent) => {
    const dx = e.clientX - startX;
    liveW = Math.max(minWidth, startW + dx);
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        headCell.style.width = px(liveW);
      });
    }
    e.preventDefault();
  };

  const onMouseUp = (_e: MouseEvent) => {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    if (raf) cancelAnimationFrame(raf);

    // Commit: update config.columns and re-render
    const cols = columnsRef() ?? [];
    for (const c of cols) {
      if (c && c.name === colName) c.width = Math.round(liveW || startW);
    }
    try { gantt.render?.(); } catch { /* optional */ }
    try { onCommit(extractSizes(cols)); } catch { /* noop */ }
  };

  const onMouseDown = (e: MouseEvent) => {
    // Initialize drag state using current rendered width
    const rect = headCell.getBoundingClientRect();
    startW = rect.width;
    startX = e.clientX;
    liveW = startW;
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
    e.preventDefault();
    e.stopPropagation();
  };

  handle.addEventListener('mousedown', onMouseDown);

  return () => {
    handle.removeEventListener('mousedown', onMouseDown);
    handle.remove();
  };
}

/** Remove any existing handles to avoid duplicates on reattach. */
function removeExistingHandles(root: ParentNode, handleClass: string): void {
  root.querySelectorAll(`.${handleClass}`).forEach((n) => (n as HTMLElement).remove());
}

/**
 * Enables custom header drag-resize. Safe to call multiple times; it will de-dupe per render.
 * Returns a disposer that removes lifecycle listeners and handles.
 */
export function enableCustomGridColumnResize(
  gantt: DhtmlxLike,
  containerEl: HTMLElement,
  onCommit: CommitFn,
  opts?: ResizeOptions,
): Disposable {
  const disposers: Array<() => void> = [];

  const handleClass = opts?.handleClass ?? DEFAULTS.HANDLE_CLASS;
  const minWidth = opts?.minWidth ?? DEFAULTS.MIN_WIDTH;
  const handleWidth = opts?.handleWidth ?? DEFAULTS.HANDLE_WIDTH;

  const attachIntoCurrentDom = () => {
    try {
      const head = containerEl.querySelector(SELECTORS.head) as HTMLElement | null;
      if (!head) return; // structure differs or not rendered yet

      removeExistingHandles(head, handleClass);

      const headerCells = Array.from(head.querySelectorAll<HTMLElement>(SELECTORS.headCell));
      const columnsRef = () => gantt?.config?.columns;

      headerCells.forEach((cell, idx) => {
        const name = findColumnName(cell, idx, columnsRef());
        if (!name || name === 'add') return; // skip non-resizable special column
        const disposeCell = installHandle(gantt, cell, name, columnsRef, onCommit, minWidth, handleWidth, handleClass);
        disposers.push(disposeCell);
      });
    } catch {
      // be resilient; no-op
    }
  };

  // Initial attach after init/render
  try { attachIntoCurrentDom(); } catch { /* noop */ }

  // Re-attach after each DHTMLX render
  let ev1: string | null = null;
  let ev2: string | null = null;
  try { ev1 = gantt.attachEvent?.('onGanttReady', () => attachIntoCurrentDom()) ?? null; } catch { /* noop */ }
  try { ev2 = gantt.attachEvent?.('onGanttRender', () => attachIntoCurrentDom()) ?? null; } catch { /* noop */ }

  return {
    dispose: () => {
      if (ev1) try { gantt.detachEvent?.(ev1); } catch { /* noop */ }
      if (ev2) try { gantt.detachEvent?.(ev2); } catch { /* noop */ }
      disposers.splice(0).forEach((fn) => { try { fn(); } catch { /* noop */ } });
      try { removeExistingHandles(containerEl, handleClass); } catch { /* noop */ }
    },
  };
}

