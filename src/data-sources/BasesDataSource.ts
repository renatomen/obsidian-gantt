import type { DataSourceAdapter, GanttConfig, SVARTask } from './DataSourceAdapter';
import type { FieldMappings } from '../mapping/FieldMappings';
import type { BasesContainerLike } from '../views/registerBasesGantt';
import { validateGanttConfig, applyGanttDefaults } from '../utils/ValidationEngine';
import { mapToSVARTasks } from '../mapping/DataMapper';
import { expandVirtualMultiParents } from '../mapping/VirtualTaskManager';

export class BasesDataSource implements DataSourceAdapter {
  readonly type = 'bases' as const;
  readonly renderContext = 'bases-view' as const;

  constructor(private container: BasesContainerLike) {}

  async initialize(): Promise<void> {
    // nothing yet
  }

  async queryData(_config: GanttConfig): Promise<any[]> {
    try { await this.container.controller?.runQuery?.(); } catch {}
    const results = this.container.results;
    if (!results || !(results instanceof Map)) return [];
    const items: any[] = [];
    for (const [, v] of results) {
      items.push(normalizeBasesItem(v));
    }
    return items;
  }

  validateConfig(config: GanttConfig): { ok: boolean; errors?: string[] } {
    const v = validateGanttConfig(config);
    return v;
  }

  mapToSVARFormat(rawData: any[], fieldMappings: FieldMappings, config?: Partial<GanttConfig>): SVARTask[] {
    const effective = applyGanttDefaults({ ...(config||{}), fieldMappings });
    const mapped = mapToSVARTasks(rawData, fieldMappings, effective);
    return expandVirtualMultiParents(mapped);
  }

  dispose(): void {}
}

function normalizeBasesItem(v: any): any {
  // Try to extract a stable id/path and properties
  const path = v?.path ?? v?.file?.path ?? v?.file?.basename ?? v?.id;
  // Merge properties/frontmatter if present
  const properties = v?.properties ?? v?.frontmatter ?? {};
  const title = properties?.title ?? v?.title ?? v?.file?.name ?? path;
  const formula = v?.formulaResults?.cachedFormulaOutputs ?? {};
  return { path, title, ...properties, ...formula };
}

