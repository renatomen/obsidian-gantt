import { mapToSVARTasks } from '../../../src/mapping/DataMapper';
import type { FieldMappings } from '../../../src/mapping/FieldMappings';

const fm: FieldMappings = { id: 'pid', text: 'title', start: 'start', end: 'end', duration: 'dur', parent: 'parent', parents: 'parents' };

describe('DataMapper', () => {
  it('maps basic fields', () => {
    const raw = [{ pid: 'a', title: 'A', start: '2025-01-01', end: '2025-01-03' }];
    const tasks = mapToSVARTasks(raw, fm, { defaultDuration: 3, missingStartBehavior: 'infer', missingEndBehavior: 'infer' });
    expect(tasks[0].id).toBe('a');
    expect(tasks[0].text).toBe('A');
    expect(tasks[0].start).toBeInstanceOf(Date);
    expect(tasks[0].end).toBeInstanceOf(Date);
  });

  it('fills placeholders when one date missing (no inference)', () => {
    const raw = [{ pid: 'b', title: 'B', start: '2025-01-01' }];
    const [t] = mapToSVARTasks(raw, fm, { defaultDuration: 2, missingStartBehavior: 'infer', missingEndBehavior: 'infer' });
    expect(t.start).toBeInstanceOf(Date);
    expect(t.end).toBeInstanceOf(Date);
    expect(t.start?.getTime()).toBe(t.end?.getTime());
  });

  it('creates virtual parents list hook', () => {
    const raw = [{ pid: 'c', title: 'C', parents: ['p1', 'p2'] }];
    const [t] = mapToSVARTasks(raw, fm, { defaultDuration: 2, missingStartBehavior: 'infer', missingEndBehavior: 'infer' });
    expect((t as any).__multiParents).toEqual(['p1', 'p2']);
  });

  it('fills placeholders when both dates missing', () => {
    const raw = [{ pid: 'x', title: 'X' }];
    const [t] = mapToSVARTasks(raw, fm, { defaultDuration: 2, missingStartBehavior: 'infer', missingEndBehavior: 'infer' });
    expect(t.start).toBeInstanceOf(Date);
    expect(t.end).toBeInstanceOf(Date);
    expect(t.start?.getTime()).toBe(t.end?.getTime());
  });
});

