import { validateGanttConfig, applyGanttDefaults } from '../../../src/utils/ValidationEngine';
import type { FieldMappings } from '../../../src/mapping/FieldMappings';

describe('ValidationEngine', () => {
  const baseFM: FieldMappings = { id: 'id', text: 'title' };

  it('validates minimal field mappings (id,text)', () => {
    const v = validateGanttConfig({ fieldMappings: baseFM, viewMode: 'Week' } as any);
    expect(v.ok).toBe(true);
  });

  it('rejects missing required fields', () => {
    const v = validateGanttConfig({ fieldMappings: { id: 'id' } as any } as any);
    expect(v.ok).toBe(false);
    expect(v.errors?.join(' ')).toMatch(/text is required/i);
  });

  it('applies sensible defaults', () => {
    const cfg = applyGanttDefaults({ fieldMappings: baseFM } as any);
    expect(cfg.viewMode).toBe('Week');
    expect(cfg.defaultDuration).toBeGreaterThan(0);
  });
});

