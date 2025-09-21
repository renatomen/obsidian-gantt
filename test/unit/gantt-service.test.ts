import { GanttService } from '../../src/gantt/gantt-service';
import type { GanttTask } from '../../src/mapping/mapping-service';

describe('GanttService', () => {
  it('initializes gantt and parses provided tasks (links optional)', () => {
    const init = jest.fn();
    const parse = jest.fn();
    const gantt = { init, parse };

    const svc = new GanttService(gantt);

    // Avoid relying on DOM environment: provide a host with an existing inner container
    const inner = { className: 'gantt_container', style: { height: '' } } as unknown as HTMLElement;
    const host = {
      querySelector: (sel: string) => (sel === '.gantt_container' ? (inner as unknown as Element) : null),
    } as unknown as HTMLElement;

    const tasks: GanttTask[] = [
      { id: 'A', text: 'Task A', start_date: '2024-01-01', end_date: '2024-01-03' },
      { id: 'B', text: 'Task B', start_date: '2024-01-04', end_date: '2024-01-05' },
    ];

    svc.render(host, tasks as unknown as Array<Record<string, unknown>>);

    expect(inner).toBeTruthy();
    expect(inner.style.height).toBe('100%');

    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(inner);

    expect(parse).toHaveBeenCalledTimes(1);
    const payload = (parse.mock.calls[0]![0]) as { data: unknown[]; links?: unknown[] };
    expect(payload.data).toHaveLength(2);
    expect(Array.isArray(payload.links ?? [])).toBe(true);
  });

  it('sets DHTMLX date parsing format to %Y-%m-%d before parsing', () => {
    const init = jest.fn();
    const parse = jest.fn();
    const config: Record<string, unknown> = {};
    const gantt = { init, parse, config };

    const svc = new GanttService(gantt);

    const inner = { className: 'gantt_container', style: { height: '' } } as unknown as HTMLElement;
    const host = {
      querySelector: (sel: string) => (sel === '.gantt_container' ? (inner as unknown as Element) : null),
    } as unknown as HTMLElement;

    const tasks: GanttTask[] = [
      { id: 'A', text: 'Task A', start_date: '2025-08-20', end_date: '2025-08-21' },
    ];

    svc.render(host, tasks as unknown as Array<Record<string, unknown>>);

    expect(config.date_format).toBe('%Y-%m-%d');
    expect(config.xml_date).toBe('%Y-%m-%d');
  });
});

