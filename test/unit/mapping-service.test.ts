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


});

