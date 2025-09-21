/**
 * @jest-environment jsdom
 */

import { enableCustomGridColumnResize } from '@gantt/columns/grid-column-resizer';

describe('enableCustomGridColumnResize (free DHTMLX helper)', () => {
  function makeDom(columns: Array<{ name: string; width: number }>) {
    const container = document.createElement('div');
    const scale = document.createElement('div');
    scale.className = 'gantt_grid_scale';
    container.appendChild(scale);

    columns.forEach((c) => {
      const headCell = document.createElement('div');
      headCell.className = 'gantt_grid_head_cell';
      headCell.setAttribute('data-column-id', c.name);
      // JSDOM: mock layout width
      (headCell as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => ({ width: c.width, height: 20, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => {} } as unknown as DOMRect);
      scale.appendChild(headCell);
    });

    return container;
  }


it('attaches handles and commits width changes on mouse drag', () => {
    const gantt = {
      config: { columns: [ { name: 'note.due', width: 120 }, { name: 'file.name', width: 180 } ] },
      attachEvent: (_name: string, _fn: (...args: unknown[]) => unknown) => '1',
      detachEvent: (_id: string) => {},
      render: () => {},
    };

    const container = makeDom(gantt.config.columns);

    let committed: Record<string, number> | null = null;
    enableCustomGridColumnResize(gantt, container, (sizes) => { committed = sizes; });

    const handle = container.querySelector('.ogantt-col-resize-handle') as HTMLElement;
    expect(handle).toBeTruthy();

    // Start drag on first column; simulate +40px
    const down = new MouseEvent('mousedown', { bubbles: true, clientX: 100 });
    handle.dispatchEvent(down);

    const move = new MouseEvent('mousemove', { bubbles: true, clientX: 140 });
    document.dispatchEvent(move);

    const up = new MouseEvent('mouseup', { bubbles: true });
    document.dispatchEvent(up);

    // Width should update for the first column: 120 + 40 = 160
    expect(gantt.config.columns[0].width).toBe(160);
    expect(committed).not.toBeNull();
    expect(committed!['note.due']).toBe(160);
    expect(committed!['file.name']).toBe(180);
  });
});

