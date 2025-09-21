import { GanttService } from '@gantt/gantt-service';
import type { ColumnLayout } from '@gantt/columns/column-types';
/* eslint-env jest */

describe('GanttService column templates', () => {
  it('applies builtin and property column templates', () => {
    const recorded: { initCalled: boolean; parsed: unknown } = { initCalled: false, parsed: null };
    const mockGantt: { config: Record<string, unknown>; init: () => void; parse: (payload: unknown) => void } = {
      config: {},
      init: () => { recorded.initCalled = true; },
      parse: (payload: unknown) => { recorded.parsed = payload; },
    };

    const svc = new GanttService(mockGantt);

    const layout: ColumnLayout = {
      columns: [
        { kind: 'builtin', id: 'builtin:text', label: 'Task Name', builtinKey: 'text', width: 200 },
        { kind: 'property', id: 'note.due', label: 'Due', propertyKey: 'note.due', width: 120 },
      ],
    };

    const idToProps = new Map<string | number, Record<string, unknown>>();
    idToProps.set(1, { note: { due: '2025-01-01' } });

    const tasks = [{ id: 1, text: 'Task A' }];

    // Provide a host with an existing inner container to avoid DOM requirements
    const inner = { className: 'gantt_container', style: { height: '' } } as unknown as HTMLElement;
    const host = {
      querySelector: (sel: string) => (sel === '.gantt_container' ? (inner as unknown as Element) : null),
    } as unknown as HTMLElement;

    svc.render(host, tasks as Array<Record<string, unknown>>, [], { columns: layout, idToProps });

    const cols = (mockGantt.config as Record<string, unknown>)['columns'] as Array<{ label?: string; tree?: boolean; template: (t: Record<string, unknown>) => string }>;
    expect(cols).toHaveLength(2);
    expect(cols[0].label).toBe('Task Name');
    expect(cols[0].tree).toBe(true);
    expect(cols[0].template({ text: 'X' })).toBe('X');

    expect(cols[1].label).toBe('Due');
    expect(cols[1].template({ id: 1 })).toBe('2025-01-01');
  });
});

