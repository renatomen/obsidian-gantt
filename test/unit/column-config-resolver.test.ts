import { resolveColumnLayoutFromBases } from '@gantt/columns/column-config-resolver';

function makeBasesContainer() {
  const properties: Record<string, unknown> = {
    'note.due': { getDisplayName: () => 'Due Date' },
    'file.name': { getDisplayName: () => 'File Name' },
    'priority': { getDisplayName: () => 'Priority' },
  };
  const query = {
    properties,
    getViewConfig: (key?: string) => {
      if (key === 'order') return ['note.due', 'file.name'];
      return undefined;
    },
  };
  const controller = {
    getViewConfig: (key?: string) => {
      if (key === 'obsidianGantt') return undefined;
      return { order: ['note.due', 'file.name'], columnSize: { 'note.due': 180 } };
    }
  };
  return { query, controller } as unknown as Record<string, unknown>;
}

describe('resolveColumnLayoutFromBases', () => {
  it('produces ordered columns with display names and widths from obsidianGantt', () => {
    const bases = makeBasesContainer();
    const layout = resolveColumnLayoutFromBases(bases);
    expect(layout.columns.map(c => c.id)).toEqual(['note.due', 'file.name']);
    expect(layout.columns.map(c => c.label)).toEqual(['Due Date', 'File Name']);
    expect(layout.columns[0].width).toBe(180);
    expect(layout.columns[1].width).toBeUndefined();
  });

  it('falls back to defaults when no order is present', () => {
    const bases = makeBasesContainer();
    // wipe out order config
    bases.query.getViewConfig = () => undefined;
    bases.controller.getViewConfig = () => ({ obsidianGantt: {} });

    const layout = resolveColumnLayoutFromBases(bases);
    expect(layout.columns[0].kind).toBe('builtin');
    expect(layout.columns[0].label).toBe('Task Name');
  });
});

