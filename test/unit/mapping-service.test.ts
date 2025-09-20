import { mapItemsToGantt, type GanttConfig } from '../../src/mapping/mapping-service';

describe('mapping-service (PRD YAML spec)', () => {
  const baseConfig: GanttConfig = {
    viewMode: 'Day',
    fieldMappings: {
      id: 'id',
      text: 'title',
      start: 'start',
      end: 'due',
      progress: 'pct',
      dependency: 'dependency',
      parent: 'parent',
      parents: 'in',
    },
    show_today_marker: false,
    hide_task_names: false,
    showMissingDates: true,
    missingStartBehavior: 'infer',
    missingEndBehavior: 'infer',
    defaultDuration: 5,
    showMissingDateIndicators: true,
  };

  it('normalizes progress from 0..100 to 0..1', () => {
    const items = [
      { id: 'T1', title: 'Task 1', start: '2024-01-01', due: '2024-01-02', pct: 50 },
      { id: 'T2', title: 'Task 2', start: '2024-01-01', due: '2024-01-03', pct: 0.2 }, // already 0..1
      { id: 'T3', title: 'Task 3', start: '2024-01-01', due: '2024-01-04', pct: 120 }, // clamp
    ];

    const { tasks } = mapItemsToGantt(items as Array<Record<string, unknown>>, baseConfig);

    expect(tasks.find(t => t.id === 'T1')!.progress).toBeCloseTo(0.5, 5);
    expect(tasks.find(t => t.id === 'T2')!.progress).toBeCloseTo(0.2, 5);
    expect(tasks.find(t => t.id === 'T3')!.progress).toBeCloseTo(1, 5);
  });

  it('infers end from start when missingEndBehavior = infer', () => {
    const items = [
      { id: 'T1', title: 'Task 1', start: '2024-01-01', pct: 10 },
    ];

    const { tasks } = mapItemsToGantt(items as Array<Record<string, unknown>>, baseConfig);

    // PRD: end = start + defaultDuration
    expect(tasks[0].start_date).toBe('2024-01-01');
    expect(tasks[0].end_date).toBe('2024-01-06'); // +5 days
  });

  it('infers start from end when missingStartBehavior = infer', () => {
    const items = [
      { id: 'T2', title: 'Task 2', due: '2024-01-10', pct: 0 },
    ];

    const { tasks } = mapItemsToGantt(items as Array<Record<string, unknown>>, baseConfig);

    expect(tasks[0].end_date).toBe('2024-01-10');
    expect(tasks[0].start_date).toBe('2024-01-05'); // -5 days
  });

  it('prefers parent over parents[0] when both provided; falls back to parents[0]', () => {
    const items = [
      { id: 'C1', title: 'Child 1', start: '2024-01-01', due: '2024-01-02', parent: 'P', in: ['A', 'B'] },
      { id: 'C2', title: 'Child 2', start: '2024-01-01', due: '2024-01-02', in: ['A', 'B'] },
    ];

    const { tasks } = mapItemsToGantt(items as Array<Record<string, unknown>>, baseConfig);

    expect(tasks.find(t => t.id === 'C1')!.parent).toBe('P');
    expect(tasks.find(t => t.id === 'C2')!.parent).toBe('A');
  });

  it('parses dependencies from comma-separated string or array into FS links', () => {
    const items = [
      { id: 'T1', title: 'Task 1', start: '2024-01-01', due: '2024-01-02', dependency: 'A, B' },
      { id: 'T2', title: 'Task 2', start: '2024-01-03', due: '2024-01-04', dependency: ['C', 'D'] },
    ];

    const { links } = mapItemsToGantt(items as Array<Record<string, unknown>>, baseConfig);

    const byTarget = (target: string) => links.filter(l => l.target === target);
    const t1Links = byTarget('T1');
    const t2Links = byTarget('T2');

    expect(t1Links.map(l => l.source).sort()).toEqual(['A','B']);
    expect(t1Links.every(l => l.type === '0')).toBe(true);

    expect(t2Links.map(l => l.source).sort()).toEqual(['C','D']);
    expect(t2Links.every(l => l.type === '0')).toBe(true);
  });
});

